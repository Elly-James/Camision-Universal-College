from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, mail
from models import Job, User, IPNRegistration
from flask_mail import Message
import requests
import uuid
from datetime import datetime, timezone
import logging
import time
import os
from werkzeug.utils import secure_filename

payments_bp = Blueprint('payments', __name__)

logger = logging.getLogger(__name__)

PESAPAL_URLS = {
    'sandbox': {
        'auth': 'https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken',
        'register_ipn': 'https://cybqa.pesapal.com/pesapalv3/api/URLSetup/RegisterIPN',
        'submit_order': 'https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest',
        'get_transaction_status': 'https://cybqa.pesapal.com/pesapalv3/api/Transactions/GetTransactionStatus'
    },
    'live': {
        'auth': 'https://pay.pesapal.com/v3/api/Auth/RequestToken',
        'register_ipn': 'https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN',
        'submit_order': 'https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest',
        'get_transaction_status': 'https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus'
    }
}

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'zip'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_pesapal_token():
    consumer_key = current_app.config.get('PESAPAL_CONSUMER_KEY', 'not_set')
    consumer_secret = current_app.config.get('PESAPAL_CONSUMER_SECRET', 'not_set')
    logger.info(f"Attempting authentication with consumer_key: {consumer_key[:5]}...")
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    payload = {
        'consumer_key': consumer_key,
        'consumer_secret': consumer_secret
    }
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                PESAPAL_URLS[current_app.config['PESAPAL_ENVIRONMENT']]['auth'],
                json=payload,
                headers=headers,
                timeout=10
            )
            logger.info(f"Auth response status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            logger.debug(f"Authentication response: {data}")
            if 'token' in data:
                return data['token']
            else:
                logger.error(f"No token in response: {data}")
                return None
        except requests.RequestException as e:
            logger.error(f"Auth attempt {attempt + 1}/{max_retries} failed: {str(e)} - Response: {getattr(e.response, 'text', 'No response')}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                return None

def send_payment_email(to_email, admin_email, job, payment_type, status, amount, order_tracking_id=None):
    subject = f"Payment {status} for Job #{job.id if job else 'N/A'}"
    body = f"""
    Job ID: {job.id if job else 'N/A'}
    Title: {job.title if job else 'Untitled'}
    Payment Type: {payment_type}
    Amount: {amount} USD
    Status: {status}
    Order Tracking ID: {order_tracking_id or 'N/A'}
    Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}
    """
    msg = Message(subject, recipients=[to_email, admin_email], body=body)
    try:
        mail.send(msg)
        logger.info(f"Payment email sent to {to_email} and {admin_email}")
    except Exception as e:
        logger.error(f"Failed to send payment email: {str(e)}")

@payments_bp.route('/register-ipn', methods=['POST'])
@jwt_required()
def register_ipn():
    user_id = get_jwt_identity()
    if not user_id:
        logger.error("Invalid user identity in IPN registration")
        return jsonify({'error': 'Invalid user identity'}), 400
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        logger.error(f"Unauthorized IPN registration attempt by user ID: {user_id}")
        return jsonify({'error': 'Unauthorized'}), 403

    token = get_pesapal_token()
    if not token:
        logger.error("Failed to authenticate with Pesapal during IPN registration")
        return jsonify({'error': 'Failed to authenticate with Pesapal'}), 500

    ipn_url = current_app.config.get('PESAPAL_IPN_URL', f"{current_app.config['FRONTEND_URL']}/api/payments/ipn")
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    payload = {
        'url': ipn_url,
        'ipn_notification_type': 'GET'
    }
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                PESAPAL_URLS[current_app.config['PESAPAL_ENVIRONMENT']]['register_ipn'],
                json=payload,
                headers=headers,
                timeout=10
            )
            logger.info(f"IPN registration response status: {response.status_code}, text: {response.text}")
            response.raise_for_status()
            data = response.json()
            logger.info(f"IPN registration response: {data}")

            if 'status' not in data or data['status'] != '200':
                logger.error(f"IPN registration failed with status: {data.get('status')} - Response: {data}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return jsonify({'error': 'IPN registration failed', 'details': data}), 500

            ipn_registration = IPNRegistration.query.filter_by(url=ipn_url).first()
            if not ipn_registration:
                ipn_registration = IPNRegistration(
                    ipn_id=data['ipn_id'],
                    url=ipn_url,
                    ipn_status='Active'
                )
                db.session.add(ipn_registration)
            else:
                ipn_registration.ipn_id = data['ipn_id']
                ipn_registration.ipn_status = 'Active'
            db.session.commit()
            logger.info(f"IPN registered successfully: ID={ipn_registration.ipn_id}, URL={ipn_url}")
            return jsonify({
                'ipn_id': ipn_registration.ipn_id,
                'url': ipn_url,
                'status': 'success'
            }), 200
        except requests.RequestException as e:
            logger.error(f"IPN registration attempt {attempt + 1}/{max_retries} failed: {str(e)} - Response: {getattr(e.response, 'text', 'No response')}")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            return jsonify({'error': 'Failed to register IPN', 'details': str(e)}), 500

@payments_bp.route('/initiate-upfront', methods=['POST'])
@jwt_required()
def initiate_upfront():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        logger.error(f"User not found for payment initiation: ID={user_id}")
        return jsonify({'error': 'User not found'}), 404
    
    data = request.form
    logger.info(f"Upfront payment data received: {data}")
    return handle_new_job_payment(data, user)

@payments_bp.route('/initiate-completion', methods=['POST'])
@jwt_required()
def initiate_completion():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        logger.error(f"User not found for payment initiation: ID={user_id}")
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    logger.info(f"Completion payment data received: {data}")
    if 'job_id' not in data:
        return jsonify({'error': 'job_id required for completion payment'}), 400
    return handle_completion_payment(data['job_id'], user, data)

def handle_new_job_payment(data, user):
    required_fields = ['pages', 'title', 'subject', 'instructions', 'deadline', 'totalAmount']
    for field in required_fields:
        if field not in data:
            logger.error(f"Missing required field in payment initiation: {field}")
            return jsonify({'error': f'{field} is required'}), 400

    try:
        pages = int(data['pages'])
        education_level = data.get('education_level', data.get('writerLevel', 'highschool')).lower()
        total_amount = float(data['totalAmount'])
        rates = {"highschool": 6, "college": 9, "bachelors": 12, "masters": 15, "phd": 18}
        calculated_total = pages * rates.get(education_level, 6)
        if abs(calculated_total - total_amount) > 0.01:
            logger.error(f"Total amount mismatch: calculated={calculated_total}, provided={total_amount}")
            return jsonify({'error': 'Total amount mismatch'}), 400
        initial_amount = total_amount * 0.25
    except ValueError:
        logger.error("Invalid pages or totalAmount value")
        return jsonify({'error': 'Pages and totalAmount must be valid numbers'}), 400

    try:
        deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
        if not deadline.tzinfo:
            deadline = deadline.replace(tzinfo=timezone.utc)
        
        job = Job(
            user_id=user.id,
            client_name=user.name,
            client_email=user.email,
            subject=data['subject'],
            title=data['title'],
            pages=pages,
            deadline=deadline,
            instructions=data['instructions'],
            cited_resources=int(data.get('citedResources', 0)),
            formatting_style=data.get('formattingStyle', 'APA'),
            writer_level=data.get('writerLevel', 'PHD'),
            spacing=data.get('spacing', 'double'),
            total_amount=total_amount,
            status='Pending Payment',
            payment_status='Pending'
        )
        
        db.session.add(job)
        db.session.flush()
        
        file_paths = []
        if 'files' in request.files:
            files = request.files.getlist('files')
            job_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], f"job_{job.id}")
            os.makedirs(job_folder, exist_ok=True)
            for file in files:
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    filename = f"initial-{datetime.now().timestamp()}-{filename}"
                    file_path = os.path.join(job_folder, filename)
                    file.save(file_path)
                    file_paths.append(os.path.join(f"job_{job.id}", filename))
            job.files = file_paths

        token = get_pesapal_token()
        if not token:
            logger.error("Failed to authenticate with Pesapal")
            db.session.rollback()
            return jsonify({'error': 'Failed to authenticate with Pesapal'}), 500

        ipn_registration = IPNRegistration.query.filter_by(ipn_status='Active').first()
        if not ipn_registration:
            logger.error("No active IPN registration found")
            db.session.rollback()
            return jsonify({'error': 'IPN not registered. Contact admin.'}), 500

        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        merchant_reference = f"JOB-{job.id}-{int(datetime.utcnow().timestamp())}"
        
        payload = {
            'id': merchant_reference,
            'currency': 'USD',
            'amount': initial_amount,
            'description': f"25% payment for job: {data['title']}",
            'callback_url': f"{current_app.config['FRONTEND_URL']}/payment-callback?job_id={job.id}",
            'notification_id': ipn_registration.ipn_id,
            'billing_address': {
                'email_address': user.email,
                'phone_number': data.get('phone_number', ''),
                'country_code': data.get('country_code', 'KE'),
                'first_name': user.name.split()[0] if user.name else '',
                'last_name': user.name.split()[-1] if user.name else ''
            }
        }
        
        logger.info(f"Submitting Pesapal payload: {payload}")
        response = requests.post(
            PESAPAL_URLS[current_app.config['PESAPAL_ENVIRONMENT']]['submit_order'],
            json=payload,
            headers=headers,
            timeout=10
        )
        logger.info(f"Pesapal response status: {response.status_code}, text: {response.text}")
        response.raise_for_status()
        payment_data = response.json()
        
        if payment_data.get('error'):
            error_msg = payment_data['error'].get('message', 'Payment initiation failed')
            logger.error(f"Pesapal error: {error_msg}")
            db.session.rollback()
            return jsonify({'error': error_msg}), 400
        
        if 'redirect_url' not in payment_data:
            logger.error(f"Invalid response from Pesapal: {payment_data}")
            db.session.rollback()
            return jsonify({'error': 'Invalid response from payment gateway'}), 500
        
        job.order_tracking_id = payment_data.get('order_tracking_id')
        job.merchant_reference = merchant_reference
        db.session.commit()
        
        send_payment_email(user.email, current_app.config['PESAPAL_ADMIN_EMAIL'], job, 'Upfront', 'Pending', initial_amount, payment_data.get('order_tracking_id'))
        
        return jsonify({
            'redirect_url': payment_data['redirect_url'],
            'order_tracking_id': payment_data.get('order_tracking_id'),
            'job_id': job.id
        }), 200
        
    except requests.RequestException as e:
        logger.error(f"Failed to initiate payment: {str(e)} - Response: {getattr(e.response, 'text', 'No response')}")
        db.session.rollback()
        send_payment_email(user.email, current_app.config['PESAPAL_ADMIN_EMAIL'], None, 'Upfront', 'Failed', initial_amount)
        return jsonify({'error': 'Failed to initiate payment', 'details': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

def handle_completion_payment(job_id, user, data):
    job = Job.query.get(job_id)
    if not job or job.user_id != user.id or job.payment_status != 'Partial':
        logger.error(f"Invalid job or payment status for completion job ID: {job_id}, user ID: {user.id}, status: {job.payment_status if job else 'None'}")
        return jsonify({'error': 'Invalid job or already paid'}), 400

    remaining_amount = job.total_amount * 0.75
    
    token = get_pesapal_token()
    if not token:
        logger.error("Failed to authenticate with Pesapal")
        return jsonify({'error': 'Failed to authenticate with Pesapal'}), 500

    ipn_registration = IPNRegistration.query.filter_by(ipn_status='Active').first()
    if not ipn_registration:
        logger.error("No active IPN registration found")
        return jsonify({'error': 'IPN not registered'}), 500

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    merchant_reference = f"JOB-{job.id}-COMPLETE-{int(datetime.utcnow().timestamp())}"
    
    payload = {
        'id': merchant_reference,
        'currency': 'USD',
        'amount': remaining_amount,
        'description': f"75% payment for completed job: {job.title}",
        'callback_url': f"{current_app.config['FRONTEND_URL']}/payment-callback?job_id={job.id}&type=completion",
        'notification_id': ipn_registration.ipn_id,
        'billing_address': {
            'email_address': job.client_email,
            'phone_number': data.get('phone_number', ''),
            'country_code': data.get('country_code', 'KE'),
            'first_name': job.client_name.split()[0] if job.client_name else '',
            'last_name': job.client_name.split()[-1] if job.client_name else ''
        }
    }
    
    logger.info(f"Submitting Pesapal payload for completion: {payload}")
    try:
        response = requests.post(
            PESAPAL_URLS[current_app.config['PESAPAL_ENVIRONMENT']]['submit_order'],
            json=payload,
            headers=headers,
            timeout=10
        )
        logger.info(f"Pesapal response status: {response.status_code}, text: {response.text}")
        response.raise_for_status()
        payment_data = response.json()
        
        if payment_data.get('error'):
            error_msg = payment_data['error'].get('message', 'Payment initiation failed')
            logger.error(f"Pesapal error: {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        if 'redirect_url' not in payment_data:
            logger.error(f"Invalid response from Pesapal: {payment_data}")
            return jsonify({'error': 'Invalid response from payment gateway'}), 500
        
        job.completion_tracking_id = payment_data.get('order_tracking_id')
        job.completion_reference = merchant_reference
        db.session.commit()
        
        send_payment_email(job.client_email, current_app.config['PESAPAL_ADMIN_EMAIL'], job, 'Completion', 'Pending', remaining_amount, payment_data.get('order_tracking_id'))
        
        return jsonify({
            'redirect_url': payment_data['redirect_url'],
            'order_tracking_id': payment_data.get('order_tracking_id'),
            'job_id': job.id
        }), 200
        
    except requests.RequestException as e:
        logger.error(f"Failed to initiate completion payment: {str(e)} - Response: {getattr(e.response, 'text', 'No response')}")
        send_payment_email(job.client_email, current_app.config['PESAPAL_ADMIN_EMAIL'], job, 'Completion', 'Failed', remaining_amount)
        return jsonify({'error': 'Failed to initiate completion payment', 'details': str(e)}), 500

@payments_bp.route('/ipn', methods=['GET', 'POST'])
def handle_ipn():
    if request.method == 'GET':
        data = request.args
    else:
        data = request.get_json()
    
    logger.info(f"IPN notification received: {data}")
    
    order_tracking_id = data.get('OrderTrackingId')
    order_merchant_reference = data.get('OrderMerchantReference')
    notification_type = data.get('OrderNotificationType')
    
    if not order_tracking_id or notification_type != 'IPNCHANGE':
        logger.error(f"Invalid IPN data: OrderTrackingId={order_tracking_id}, OrderNotificationType={notification_type}")
        return jsonify({'error': 'Invalid IPN data'}), 400

    job = None
    if order_merchant_reference and order_merchant_reference.startswith('JOB-'):
        try:
            job_id = int(order_merchant_reference.split('-')[1])
            job = Job.query.get(job_id)
        except (ValueError, IndexError):
            logger.error(f"Invalid merchant reference format: {order_merchant_reference}")
    
    if not job:
        job = Job.query.filter(
            (Job.order_tracking_id == order_tracking_id) | 
            (Job.completion_tracking_id == order_tracking_id)
        ).first()
    
    if not job:
        logger.error(f"Job not found for OrderTrackingId: {order_tracking_id}, MerchantReference: {order_merchant_reference}")
        return jsonify({'error': 'Job not found'}), 404

    token = get_pesapal_token()
    if not token:
        logger.error("Failed to authenticate with Pesapal for IPN processing")
        return jsonify({'error': 'Failed to authenticate with Pesapal'}), 500

    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    try:
        response = requests.get(
            f"{PESAPAL_URLS[current_app.config['PESAPAL_ENVIRONMENT']]['get_transaction_status']}?orderTrackingId={order_tracking_id}",
            headers=headers,
            timeout=10
        )
        logger.info(f"Transaction status response status: {response.status_code}, text: {response.text}")
        response.raise_for_status()
        status_data = response.json()
        logger.info(f"Transaction status response: {status_data}")

        payment_status = status_data.get('payment_status_description')
        payment_method = status_data.get('payment_method', 'Unknown')
        amount = status_data.get('amount', 0)
        
        payment_type = 'completion' if order_tracking_id == job.completion_tracking_id else 'upfront'
        
        if payment_status == 'Completed':
            if payment_type == 'upfront' and job.payment_status == 'Pending':
                job.payment_status = 'Partial'
                job.status = 'In Progress'
                job.order_tracking_id = order_tracking_id
                db.session.commit()
                logger.info(f"25% payment completed for job {job.id}")
                
            elif payment_type == 'completion' and job.payment_status == 'Partial':
                job.payment_status = 'Completed'
                db.session.commit()
                logger.info(f"75% payment completed for job {job.id}")
                
            send_payment_email(
                job.client_email,
                current_app.config['PESAPAL_ADMIN_EMAIL'],
                job,
                'Upfront' if payment_type == 'upfront' else 'Completion',
                'Success',
                amount,
                order_tracking_id
            )
            
        elif payment_status in ['Failed', 'Invalid']:
            amount = job.total_amount * (0.75 if payment_type == 'completion' else 0.25)
            send_payment_email(
                job.client_email,
                current_app.config['PESAPAL_ADMIN_EMAIL'],
                job,
                'Completion' if payment_type == 'completion' else 'Upfront',
                'Failed',
                amount,
                order_tracking_id
            )

        return jsonify({
            'orderNotificationType': notification_type,
            'orderTrackingId': order_tracking_id,
            'orderMerchantReference': order_merchant_reference,
            'status': 200
        }), 200
        
    except requests.RequestException as e:
        logger.error(f"Failed to process IPN: {str(e)} - Response: {getattr(e.response, 'text', 'No response')}")
        return jsonify({'error': 'Failed to process IPN', 'details': str(e)}), 500

@payments_bp.route('/status/<order_tracking_id>', methods=['GET'])
@jwt_required()
def get_payment_status(order_tracking_id):
    user_id = get_jwt_identity()
    job = Job.query.filter(
        (Job.order_tracking_id == order_tracking_id) | 
        (Job.completion_tracking_id == order_tracking_id)
    ).first()
    
    if not job or job.user_id != user_id:
        logger.error(f"Unauthorized or job not found for OrderTrackingId: {order_tracking_id}, user ID: {user_id}")
        return jsonify({'error': 'Job not found or unauthorized'}), 404

    token = get_pesapal_token()
    if not token:
        logger.error("Failed to authenticate with Pesapal for payment status check")
        return jsonify({'error': 'Failed to authenticate with Pesapal'}), 500

    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    try:
        response = requests.get(
            f"{PESAPAL_URLS[current_app.config['PESAPAL_ENVIRONMENT']]['get_transaction_status']}?orderTrackingId={order_tracking_id}",
            headers=headers,
            timeout=10
        )
        logger.info(f"Payment status response status: {response.status_code}, text: {response.text}")
        response.raise_for_status()
        data = response.json()
        logger.info(f"Payment status retrieved: {data}")
        return jsonify({
            'payment_status': data.get('payment_status_description'),
            'confirmation_code': data.get('confirmation_code'),
            'amount': data.get('amount'),
            'currency': data.get('currency')
        }), 200
    except requests.RequestException as e:
        logger.error(f"Failed to get payment status: {str(e)} - Response: {getattr(e.response, 'text', 'No response')}")
        return jsonify({'error': 'Failed to get payment status', 'details': str(e)}), 500
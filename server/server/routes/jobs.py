from flask import Blueprint, request, jsonify, g, current_app
from flask_socketio import emit
from datetime import datetime, timezone
import jwt
import logging
import os
from werkzeug.utils import secure_filename
import requests
from extensions import db, socketio
from models import Job, User, Message
from sqlalchemy import and_, or_

jobs_bp = Blueprint('jobs', __name__)

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'zip'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def sanitize_filename(filename):
    return filename.replace('..', '.')

@jobs_bp.route('', methods=['POST', 'OPTIONS'])
def create_job():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role != 'client':
            logger.error(f"Unauthorized job creation attempt by user ID: {user.id}")
            return jsonify({"error": "Only clients can create jobs"}), 403

        try:
            data = request.form
            files = request.files.getlist('files')
            
            # Validate required fields
            required_fields = ['subject', 'title', 'pages', 'deadline', 'instructions', 'totalAmount']
            for field in required_fields:
                if field not in data:
                    return jsonify({"error": f"{field} is required"}), 400

            # Parse and validate deadline
            deadline_str = data.get('deadline')
            try:
                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                if not deadline.tzinfo:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                
                current_time = datetime.now(timezone.utc)
                if deadline < current_time:
                    return jsonify({
                        "error": "Deadline must be in the future",
                        "details": {
                            "deadline": deadline.isoformat(),
                            "current_time": current_time.isoformat()
                        }
                    }), 400
            except ValueError as ve:
                logger.error(f"Invalid deadline format: {str(ve)}")
                return jsonify({
                    "error": "Invalid deadline format. Use ISO 8601 format",
                    "details": str(ve)
                }), 400

            # Validate numeric fields
            try:
                pages = int(data['pages'])
                total_amount = float(data['totalAmount'])
                cited_resources = int(data.get('citedResources', 0))
                if pages <= 0 or total_amount <= 0:
                    raise ValueError
            except ValueError:
                return jsonify({"error": "Pages and totalAmount must be positive numbers"}), 400

            # Calculate rates based on education level
            education_level = data.get('writerLevel', 'highschool').lower()
            rates = {
                'highschool': 6,
                'college': 9,
                'bachelors': 12,
                'masters': 15,
                'phd': 18
            }
            calculated_total = pages * rates.get(education_level, 6)
            
            if abs(calculated_total - total_amount) > 0.01:
                return jsonify({
                    "error": "Total amount doesn't match calculated amount",
                    "details": f"Calculated: ${calculated_total}, Provided: ${total_amount}"
                }), 400

            # Prepare payment data (no job creation here)
            payment_data = {
                'pages': pages,
                'education_level': education_level,
                'title': data['title'],
                'subject': data['subject'],
                'deadline': deadline.isoformat(),
                'instructions': data['instructions'],
                'phone_number': data.get('phone_number', ''),
                'country_code': data.get('country_code', 'KE'),
                'citedResources': cited_resources,
                'formattingStyle': data.get('formattingStyle', 'APA'),
                'writerLevel': data.get('writerLevel', 'PHD'),
                'spacing': data.get('spacing', 'double'),
                'totalAmount': total_amount,
                # Files handled in payments.py
            }
            
            # Send files with payment request
            files_data = [('files', (file.filename, file, file.mimetype)) for file in files if file and allowed_file(file.filename)]
            payment_response = requests.post(
                f"{request.host_url}api/payments/initiate-upfront",
                data=payment_data,
                files=files_data,
                headers={'Authorization': f'Bearer {token}'}
            )
            if payment_response.status_code != 200:
                return jsonify({'error': 'Payment initiation failed', 'details': payment_response.json()}), 400

            payment_response_data = payment_response.json()
            logger.info(f"Job creation initiated with payment, redirect to: {payment_response_data['redirect_url']}")
            return jsonify({
                'message': 'Job creation initiated, redirect to Pesapal for payment',
                'job_id': payment_response_data.get('job_id'),
                'redirect_url': payment_response_data['redirect_url'],
                'order_tracking_id': payment_response_data.get('order_tracking_id')
            }), 200

        except Exception as e:
            logger.error(f"Job creation failed: {str(e)}", exc_info=True)
            return jsonify({
                "error": "Failed to create job",
                "details": str(e)
            }), 500

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@jobs_bp.route('', methods=['GET', 'OPTIONS'])
def get_jobs():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role == 'admin':
            jobs = Job.query.filter(Job.payment_status != 'Pending').all()
        else:
            jobs = Job.query.filter_by(user_id=user.id).all()

        logger.info(f"Jobs retrieved for user ID: {user.id}, count: {len(jobs)}")
        return jsonify([{
            **job.to_dict(),
            'client_name': job.client_name,
            'client_email': job.client_email,
            'payment_status': job.payment_status
        } for job in jobs])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@jobs_bp.route('/<int:job_id>', methods=['GET', 'OPTIONS'])
def get_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        job = db.session.get(Job, job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404

        if user.role != 'admin' and job.user_id != user.id:
            logger.error(f"Unauthorized job access attempt by user ID: {user.id} for job ID: {job_id}")
            return jsonify({"error": "Unauthorized"}), 403

        admin = User.query.filter_by(role='admin').first()
        if not admin:
            return jsonify({"error": "Admin not found"}), 404

        messages = Message.query.filter(
            or_(
                and_(Message.sender_id == job.user_id, Message.recipient_id == admin.id),
                and_(Message.sender_id == admin.id, Message.recipient_id == job.user_id)
            )
        ).filter(
            or_(
                and_(user.role == 'admin', ~Message.admin_deleted),
                and_(user.role == 'client', ~Message.client_deleted)
            )
        ).order_by(Message.created_at).all()

        message_files = []
        for message in messages:
            if message.files:
                message_files.extend(message.files)

        all_files = (job.files or []) + (job.completed_files or []) + message_files

        logger.info(f"Job retrieved: {job_id}")
        return jsonify({
            **job.to_dict(),
            'client_name': job.client_name,
            'client_email': job.client_email,
            'messages': [msg.to_dict() for msg in messages],
            'all_files': all_files,
            'payment_status': job.payment_status
        })
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Failed to retrieve job {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to retrieve job", "details": str(e)}), 500

@jobs_bp.route('/<int:job_id>', methods=['PUT', 'OPTIONS'])
def update_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role != 'admin':
            logger.error(f"Unauthorized job update attempt by user ID: {user.id}")
            return jsonify({"error": "Only admins can update jobs"}), 403

        job = db.session.get(Job, job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404

        data = request.get_json()
        if 'status' in data:
            job.status = data['status']
            if data['status'] == 'Completed' and job.payment_status == 'Partial':
                payment_data = {
                    'job_id': job.id,
                    'phone_number': '',
                    'country_code': 'KE'
                }
                payment_response = requests.post(
                    f"{request.host_url}api/payments/initiate-completion",
                    json=payment_data,
                    headers={'Authorization': f'Bearer {token}'}
                )
                if payment_response.status_code != 200:
                    return jsonify({'error': 'Completion payment initiation failed', 'details': payment_response.json()}), 400
            if data['status'] == 'Completed':
                job.completed = True
            db.session.commit()
            socketio.emit('job_updated', job.to_dict(), namespace='/jobs')
            logger.info(f"Job updated: {job_id}, new status: {job.status}")

        return jsonify(job.to_dict())
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
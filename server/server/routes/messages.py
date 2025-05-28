from flask import Blueprint, request, jsonify, g, current_app
from flask_socketio import emit
from datetime import datetime
import jwt
import logging
import os
from werkzeug.utils import secure_filename
from extensions import db, socketio
from models import Job, User, Message
from sqlalchemy import and_, or_

messages_bp = Blueprint('messages', __name__)

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@messages_bp.route('/api/jobs/<int:job_id>/messages', methods=['POST', 'OPTIONS'])
def send_job_message(job_id):
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        g.current_user = db.session.get(User, data['user_id'])
        if not g.current_user:
            return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        job = db.session.get(Job, job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404

        if user.role != 'admin' and job.user_id != user.id:
            logger.error(f"Unauthorized message attempt by user ID: {user.id} for job ID: {job_id}")
            return jsonify({"error": "Unauthorized"}), 403

        try:
            data = request.form
            content = data.get('content', '')
            completed_files = request.files.getlist('completed_files') if user.role == 'admin' else []
            additional_files = request.files.getlist('files') if user.role == 'client' else []

            if not content and not completed_files and not additional_files:
                return jsonify({"error": "Message content or files required"}), 400

            job_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], f"job_{job_id}")
            os.makedirs(job_folder, exist_ok=True)

            completed_file_paths = []
            for file in completed_files:
                if file and file.filename:
                    if not allowed_file(file.filename):
                        return jsonify({"error": f"File type not allowed for {file.filename}"}), 400
                    filename = secure_filename(file.filename)
                    filename = f"completed-{datetime.now().timestamp()}-{filename}"
                    file_path = os.path.join(job_folder, filename)
                    file.save(file_path)
                    completed_file_paths.append(os.path.join(f"job_{job_id}", filename))

            additional_file_paths = []
            for file in additional_files:
                if file and file.filename:
                    if not allowed_file(file.filename):
                        return jsonify({"error": f"File type not allowed for {file.filename}"}), 400
                    filename = secure_filename(file.filename)
                    filename = f"additional-{datetime.now().timestamp()}-{filename}"
                    file_path = os.path.join(job_folder, filename)
                    file.save(file_path)
                    additional_file_paths.append(os.path.join(f"job_{job_id}", filename))

            recipient_id = job.user_id if user.role == 'admin' else User.query.filter_by(role='admin').first().id
            if not recipient_id:
                return jsonify({"error": "Recipient not found"}), 404

            message = Message(
                job_id=None,  # Treat as general message
                sender_id=user.id,
                recipient_id=recipient_id,
                sender_role=user.role,
                content=content if content else None,
                files=completed_file_paths + additional_file_paths
            )

            db.session.add(message)

            if user.role == 'admin' and completed_file_paths:
                if not job.completed_files:
                    job.completed_files = []
                job.completed_files.extend(completed_file_paths)
                job.status = 'Completed'
                job.completed = True
            elif user.role == 'client' and additional_file_paths:
                if not job.files:
                    job.files = []
                job.files.extend(additional_file_paths)

            db.session.commit()

            socketio.emit('new_general_message', {
                **message.to_dict(),
                'client_id': job.user_id,
                'sender_role': user.role
            }, namespace='/messages')

            socketio.emit('job_updated', job.to_dict(), namespace='/jobs')

            return jsonify(message.to_dict()), 201

        except Exception as e:
            logger.error(f"Job message sending failed: {str(e)}", exc_info=True)
            db.session.rollback()
            return jsonify({"error": "Failed to send message", "details": str(e)}), 500

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@messages_bp.route('/api/jobs/<int:job_id>/messages', methods=['GET', 'OPTIONS'])
def get_job_messages(job_id):
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        g.current_user = db.session.get(User, data['user_id'])
        if not g.current_user:
            return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        job = db.session.get(Job, job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404

        if user.role != 'admin' and job.user_id != user.id:
            logger.error(f"Unauthorized message access attempt by user ID: {user.id} for job ID: {job_id}")
            return jsonify({"error": "Unauthorized"}), 403

        admin = User.query.filter_by(role='admin').first()
        if not admin:
            return jsonify({"error": "Admin not found"}), 404

        messages = Message.query.filter(
            or_(
                and_(Message.sender_id == job.user_id, Message.recipient_id == admin.id),
                and_(Message.sender_id == admin.id, Message.recipient_id == job.user_id)
            ),
            or_(
                and_(user.role == 'admin', ~Message.admin_deleted),
                and_(user.role == 'client', ~Message.client_deleted)
            )
        ).order_by(Message.created_at).all()

        logger.info(f"Messages retrieved for job ID: {job_id}, count: {len(messages)}")
        return jsonify([msg.to_dict() for msg in messages])

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Failed to retrieve messages for job ID: {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to retrieve messages", "details": str(e)}), 500

@messages_bp.route('/api/messages', methods=['POST', 'OPTIONS'])
def send_message():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        g.current_user = db.session.get(User, data['user_id'])
        if not g.current_user:
            return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        try:
            data = request.form
            content = data.get('content', '')
            files = request.files.getlist('files')

            if not content and not files:
                return jsonify({"error": "Message content or files required"}), 400

            recipient = User.query.filter_by(role='admin').first() if user.role != 'admin' else User.query.get(data.get('recipient_id'))
            if not recipient:
                return jsonify({"error": "Recipient not found"}), 404

            file_paths = []
            if files:
                temp_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'temp')
                os.makedirs(temp_folder, exist_ok=True)
                for file in files:
                    if file and file.filename:
                        if not allowed_file(file.filename):
                            return jsonify({"error": f"File type not allowed for {file.filename}"}), 400
                        filename = secure_filename(file.filename)
                        filename = f"msg-{datetime.now().timestamp()}-{filename}"
                        file_path = os.path.join(temp_folder, filename)
                        file.save(file_path)
                        file_paths.append(os.path.join('temp', filename))

            message = Message(
                sender_id=user.id,
                recipient_id=recipient.id,
                sender_role=user.role,
                content=content if content else None,
                files=file_paths
            )

            db.session.add(message)
            db.session.commit()

            socketio.emit('new_general_message', {
                **message.to_dict(),
                'client_id': user.id if user.role != 'admin' else recipient.id
            }, namespace='/messages')

            return jsonify(message.to_dict()), 201

        except Exception as e:
            logger.error(f"General message sending failed: {str(e)}", exc_info=True)
            db.session.rollback()
            return jsonify({"error": "Failed to send message", "details": str(e)}), 500

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@messages_bp.route('/api/messages/<int:message_id>', methods=['PUT', 'OPTIONS'])
def edit_message(message_id):
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        g.current_user = db.session.get(User, data['user_id'])
        if not g.current_user:
            return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        message = db.session.get(Message, message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        if message.sender_id != user.id:
            logger.error(f"Unauthorized message edit attempt by user ID: {user.id} for message ID: {message_id}")
            return jsonify({"error": "Unauthorized"}), 403

        data = request.get_json()
        content = data.get('content', '')
        if not content:
            return jsonify({"error": "Message content required"}), 400

        message.content = content
        message.updated_at = datetime.utcnow()
        db.session.commit()

        socketio.emit('message_updated', {
            **message.to_dict(),
            'client_id': message.recipient_id if user.role == 'admin' else message.sender_id
        }, namespace='/messages')

        logger.info(f"Message edited by user ID: {user.id}, message ID: {message_id}")
        return jsonify(message.to_dict()), 200

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Message editing failed: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to edit message", "details": str(e)}), 500

@messages_bp.route('/api/messages/<int:message_id>', methods=['DELETE', 'OPTIONS'])
def delete_message(message_id):
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')  # Fixed to include DELETE
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        message = db.session.get(Message, message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        # Allow deletion by sender or admin
        if message.sender_id != user.id and user.role != 'admin':
            logger.error(f"Unauthorized message delete attempt by user ID: {user.id} for message ID: {message_id}")
            return jsonify({"error": "Unauthorized"}), 403

        # Mark as deleted for the requesting user
        if user.role == 'admin':
            message.admin_deleted = True
        else:
            message.client_deleted = True

        # Delete message if both sides have marked it deleted
        if message.client_deleted and message.admin_deleted:
            db.session.delete(message)

        db.session.commit()

        socketio.emit('message_deleted', {
            'message_id': message_id,
            'client_id': message.recipient_id if user.role == 'admin' else message.sender_id
        }, namespace='/messages')

        logger.info(f"Message marked as deleted by user ID: {user.id}, message ID: {message_id}")
        return jsonify({"message": "Message deleted successfully"}), 200

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Message deletion failed: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to delete message", "details": str(e)}), 500

@messages_bp.route('/api/messages', methods=['GET', 'OPTIONS'])
def get_general_messages():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        g.current_user = db.session.get(User, data['user_id'])
        if not g.current_user:
            return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            return jsonify({"error": "Admin not found"}), 404

        messages = Message.query.filter(
            or_(
                and_(Message.sender_id == user.id, Message.recipient_id == admin.id),
                and_(Message.sender_id == admin.id, Message.recipient_id == user.id)
            ),
            or_(
                and_(user.role == 'admin', ~Message.admin_deleted),
                and_(user.role == 'client', ~Message.client_deleted)
            )
        ).order_by(Message.created_at).all()

        logger.info(f"General messages retrieved for user ID: {user.id}, count: {len(messages)}")
        return jsonify([msg.to_dict() for msg in messages])

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Failed to retrieve general messages: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to retrieve messages", "details": str(e)}), 500

@messages_bp.route('/api/messages/clear', methods=['POST', 'OPTIONS'])
def clear_chat_history():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', current_app.config.get('FRONTEND_URL', 'http://localhost:5173'))
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')  # Fixed to include POST
        response.headers.add('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        admin = User.query.filter_by(role='admin').first()
        if not admin:
            return jsonify({"error": "Admin not found"}), 404

        # Fetch messages between the user and admin
        messages = Message.query.filter(
            or_(
                and_(Message.sender_id == user.id, Message.recipient_id == admin.id),
                and_(Message.sender_id == admin.id, Message.recipient_id == user.id)
            )
        ).all()

        # Mark messages as deleted for the requesting user
        for message in messages:
            if user.role == 'admin':
                message.admin_deleted = True
            else:
                message.client_deleted = True

            # Delete message if both sides have marked it deleted
            if message.client_deleted and message.admin_deleted:
                db.session.delete(message)

        db.session.commit()

        # Emit a single event to notify the frontend of cleared history
        socketio.emit('message_deleted', {
            'message_id': None,  # Indicate full history clear
            'client_id': user.id
        }, namespace='/messages')

        logger.info(f"Chat history cleared for user ID: {user.id}")
        return jsonify({"message": "Chat history cleared successfully"}), 200

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"Chat history clearing failed: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to clear chat history", "details": str(e)}), 500
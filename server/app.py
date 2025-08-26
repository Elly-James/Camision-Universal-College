import eventlet
eventlet.monkey_patch()  # Must be at the top before any other imports

from flask import Flask, request, jsonify, send_from_directory, g
from flask_socketio import SocketIO, emit, disconnect
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import jwt
import logging
import os
from config import config
from extensions import db, cors, bcrypt, mail, jwt as jwt_manager
from flask_migrate import Migrate
from models import User, Job, Message, ResetToken
from werkzeug.utils import secure_filename
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import and_, or_
import time
from threading import Thread
from server.routes.auth import auth_bp
from server.routes.jobs import jobs_bp
from server.routes.payments import payments_bp

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Allowed file extensions for uploads
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'zip'}

def create_app(config_name='development'):
    """Application factory function"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Override database URI if not set in config (fallback to env)
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        logger.error("DATABASE_URL is not set")
        raise ValueError("DATABASE_URL is not set")

    # Ensure upload folder is set
    app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'Uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
    
    # Initialize extensions
    initialize_extensions(app)
    
    # Configure logging
    configure_logging(app)
    
    # Initialize Flask-Migrate
    migrate = Migrate(app, db)
    
    # Initialize rate limiter
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"]
    )
    
    # Store limiter in app for use in decorators
    app.limiter = limiter
    
    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(auth_bp, url_prefix='/auth', name='auth_legacy')  # Unique name for /auth prefix
    app.register_blueprint(jobs_bp, url_prefix='/api/jobs')
    app.register_blueprint(payments_bp, url_prefix='/api/payments')
    
    # Start background cleanup tasks
    start_cleanup_tasks(app)
    
    return app

def initialize_extensions(app):
    """Initialize Flask extensions"""
    cors.init_app(app, resources={r"/*": {"origins": app.config.get('FRONTEND_URL', 'http://localhost:5173')}}, 
                  supports_credentials=True)
    db.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    jwt_manager.init_app(app)
    
    # Configure JWT
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
    
    # Configure SQLAlchemy for thread safety
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 5,
        'max_overflow': 10,
        'pool_timeout': 30,
        'pool_pre_ping': True
    }

def configure_logging(app):
    """Configure application logging"""
    if app.config['DEBUG']:
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.INFO)
    
    # Log database connection info
    logger.info(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cleanup_old_files(app):
    """Periodically clean up old uploaded files"""
    while True:
        try:
            with app.app_context():
                cutoff_time = time.time() - (30 * 24 * 60 * 60)  # 30 days ago
                upload_folder = app.config['UPLOAD_FOLDER']
                for root, dirs, files in os.walk(upload_folder):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if os.path.getmtime(file_path) < cutoff_time:
                            try:
                                os.remove(file_path)
                                logger.info(f"Deleted old file: {file_path}")
                            except Exception as e:
                                logger.error(f"Failed to delete file {file_path}: {str(e)}")
        except Exception as e:
            logger.error(f"File cleanup failed: {str(e)}")
        time.sleep(24 * 60 * 60)  # Run once a day

def cleanup_old_reset_tokens(app):
    """Periodically clean up expired reset tokens"""
    while True:
        try:
            with app.app_context():
                ResetToken.query.filter(ResetToken.expires_at < datetime.utcnow()).delete()
                db.session.commit()
                logger.info("Cleaned up expired reset tokens")
        except Exception as e:
            logger.error(f"Reset token cleanup failed: {str(e)}")
        time.sleep(24 * 60 * 60)  # Run once a day

def start_cleanup_tasks(app):
    """Start background cleanup tasks"""
    file_cleanup_thread = Thread(target=cleanup_old_files, args=(app,), daemon=True)
    token_cleanup_thread = Thread(target=cleanup_old_reset_tokens, args=(app,), daemon=True)
    file_cleanup_thread.start()
    token_cleanup_thread.start()
    logger.info("Started background cleanup tasks")

# Create the application
app = create_app(os.getenv('FLASK_ENV', 'development'))

# Initialize SocketIO with async_mode explicitly set
socketio = SocketIO(
    app,
    async_mode='eventlet',
    cors_allowed_origins=[os.getenv('FRONTEND_URL', 'http://localhost:5173')],
    cors_credentials=True,
    logger=True,
    engineio_logger=True
)

# Session cleanup
@app.after_request
def cleanup_session(response):
    try:
        db.session.commit()
    except:
        db.session.rollback()
    finally:
        db.session.remove()
    return response

# Routes
@app.route('/')
def index():
    return jsonify({"message": "Welcome to the Academic Assistance API!"})

@app.route('/api/messages', methods=['POST', 'OPTIONS'])
def send_message():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role == 'admin':
            return jsonify({"error": "Admins can only message through job details"}), 403

        try:
            data = request.form
            content = data.get('content', '')
            files = request.files.getlist('files')

            if not content and not files:
                return jsonify({"error": "Message content or files required"}), 400

            # Assume admin as recipient for client messages
            recipient = User.query.filter_by(role='admin').first()
            if not recipient:
                return jsonify({"error": "Admin not found"}), 404

            # Handle file uploads
            file_paths = []
            if files:
                temp_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'temp')
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
                'client_id': user.id
            }, namespace='/messages')
            return jsonify(message.to_dict()), 201

        except Exception as e:
            logger.error(f"General message sending failed: {str(e)}")
            db.session.rollback()
            return jsonify({"error": "Failed to send message", "details": str(e)}), 500

    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/messages/<int:message_id>', methods=['PUT', 'OPTIONS'])
def edit_message(message_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        message = db.session.get(Message, message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 400

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
    except Exception as e:
        logger.error(f"Message editing failed: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to edit message", "details": str(e)}), 500
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/messages/<int:message_id>', methods=['DELETE', 'OPTIONS'])
def delete_message(message_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        message = db.session.get(Message, message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404

        # Only allow deletion by sender or admin
        if message.sender_id != user.id and user.role != 'admin':
            logger.error(f"Unauthorized message delete attempt by user ID: {user.id} for message ID: {message_id}")
            return jsonify({"error": "Unauthorized"}), 403

        # Mark message as deleted for the requesting user
        if user.role == 'admin':
            message.admin_deleted = True
        else:
            message.client_deleted = True

        # Delete message from database only if both sides have deleted it
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
        logger.error(f"Message deletion failed: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to delete message", "details": str(e)}), 500

@app.route('/api/messages', methods=['GET', 'OPTIONS'])
def get_messages():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
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
            )
        ).filter(
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
        logger.error(f"Failed to retrieve messages for user ID: {user.id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to retrieve messages", "details": str(e)}), 500

@app.route('/api/jobs/<int:job_id>/messages', methods=['POST', 'OPTIONS'])
def send_job_message(job_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
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

            job_folder = os.path.join(app.config['UPLOAD_FOLDER'], f"job_{job_id}")
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

            # Determine recipient (admin for client messages, client for admin messages)
            recipient_id = job.user_id if user.role == 'admin' else User.query.filter_by(role='admin').first().id
            if not recipient_id:
                return jsonify({"error": "Recipient not found"}), 404

            message = Message(
                job_id=job_id,  # Associate message with the job
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

@app.route('/api/jobs/<int:job_id>/messages', methods=['GET', 'OPTIONS'])
def get_job_messages(job_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
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
            )
        ).filter(
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

@app.route('/Uploads/<path:filename>', methods=['GET', 'OPTIONS'])
def get_file(filename):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    try:
        token = token.split(' ')[1]
        data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            logger.error(f"User not found for file download: {filename}")
            return jsonify({'error': 'User not found'}), 404

        # Normalize path to prevent directory traversal
        filename = os.path.normpath(filename).replace('\\', '/')
        if filename.startswith('/') or '..' in filename:
            logger.error(f"Invalid file path: {filename}")
            return jsonify({"error": "Invalid file path"}), 400

        path_parts = filename.split('/')
        if len(path_parts) < 2 and path_parts[0] != 'temp':
            logger.error(f"Invalid file path format: {filename}")
            return jsonify({"error": "Invalid file path format"}, 400)

        job_id = None
        if path_parts[0].startswith('job_'):
            job_id_str = path_parts[0].replace('job_', '')
            if not job_id_str.isdigit():
                logger.error(f"Invalid job ID in file path: {filename}")
                return jsonify({"error": "Invalid job ID in file path"}, 400)
            job_id = int(job_id_str)

        if user.role == 'admin' or path_parts[0] == 'temp':
            try:
                return send_from_directory(
                    app.config['UPLOAD_FOLDER'],
                    filename,
                    as_attachment=True,
                    download_name=path_parts[-1]
                )
            except FileNotFoundError:
                logger.error(f"File not found: {filename}")
                return jsonify({"error": f"File not found: {filename}"}, 404)

        if not job_id:
            logger.error(f"Invalid file path for client: {filename}")
            return jsonify({"error": "Invalid file path"}, 400)

        job = db.session.get(Job, job_id)
        if not job:
            logger.error(f"Job not found for file: {filename}, job_id: {job_id}")
            return jsonify({"error": "Job not found"}, 404)
        if job.user_id != user.id:
            logger.error(f"Unauthorized file access attempt by user ID: {user.id} for filename: {filename}")
            return jsonify({"error": "Unauthorized"}, 403)
            
        try:
            return send_from_directory(
                app.config['UPLOAD_FOLDER'],
                filename,
                as_attachment=True,
                download_name=path_parts[-1]
            )
        except FileNotFoundError:
            logger.error(f"File not found: {filename}")
            return jsonify({"error": f"File not found: {filename}"}, 404)
        
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        logger.error(f"File download error: {str(e)}")
        return jsonify({"error": "Failed to download file", "details": str(e)}), 500

# SocketIO events
@socketio.on('connect', namespace='/jobs')
def handle_job_connect(auth):
    from flask import request
    token = request.args.get('token')
    if not token:
        logger.error("SocketIO /jobs connect: Missing token")
        disconnect()
        return

    with app.app_context():
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            user = db.session.get(User, data['user_id'])
            if not user:
                logger.error("SocketIO /jobs connect: User not found")
                disconnect()
                return
            logger.info(f"Client connected to /jobs namespace, user ID: {user.id}")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            logger.error(f"SocketIO /jobs connect: Invalid token - {str(e)}")
            disconnect()

@socketio.on('connect', namespace='/messages')
def handle_message_connect(auth):
    from flask import request
    token = request.args.get('token')
    if not token:
        logger.error("SocketIO /messages connect: Missing token")
        disconnect()
        return

    with app.app_context():
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            user = db.session.get(User, data['user_id'])
            if not user:
                logger.error("SocketIO /messages connect: User not found")
                disconnect()
                return
            logger.info(f"Client connected to /messages namespace, user ID: {user.id}")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            logger.error(f"SocketIO /messages connect: Invalid token - {str(e)}")
            disconnect()

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, host='0.0.0.0')
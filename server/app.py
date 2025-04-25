import os
from flask import Flask, request, jsonify, send_from_directory, g
from datetime import datetime, timedelta
from dotenv import load_dotenv
import jwt
import uuid
import logging
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from config import config
from extensions import db, cors, bcrypt, mail, jwt as jwt_manager
from flask_migrate import Migrate
from models import User, Job, Message, ResetToken

# Set up logging
logging.basicConfig(level=logging.WARNING)  # Reduced verbosity
logger = logging.getLogger(__name__)

def create_app(config_name='development'):
    """Application factory function"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Override database URI if not set in config (fallback to env)
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        logger.error("No database URI provided. Please set DATABASE_URL in .env")
        raise ValueError("DATABASE_URL is not set")

    # Ensure upload folder is set
    app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')
    
    # Initialize extensions
    initialize_extensions(app)
    
    # Configure logging
    configure_logging(app)
    
    # Initialize Flask-Migrate
    migrate = Migrate(app, db)
    
    # Setup database
    setup_database(app)
    
    return app

def initialize_extensions(app):
    """Initialize Flask extensions"""
    cors.init_app(app, resources={r"/*": {"origins": app.config.get('FRONTEND_URL', '*')}}, 
                  supports_credentials=True)
    db.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)
    jwt_manager.init_app(app)
    
    # Configure JWT
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

def configure_logging(app):
    """Configure application logging"""
    if app.config['DEBUG']:
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.WARNING)
    
    # Log database connection info
    logger.info(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")

def setup_database(app):
    """Setup database connection and ensure connectivity"""
    try:
        # Verify database connection
        with app.app_context():
            connection = db.engine.connect()
            connection.close()
            logger.info("Database connection established successfully")
            
            # Create tables if they don't exist
            # db.create_all()
            
            # Log registered models
            logger.info("SQLAlchemy metadata tables: %s", db.Model.metadata.tables.keys())
            
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise

# Create the application
app = create_app(os.getenv('FLASK_ENV', 'development'))

# Create upload folder
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Import seed function
from seed import seed_database

# Helper function to generate JWT tokens
def generate_tokens(user):
    access_token = jwt.encode({
        'user_id': user.id,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm='HS256')

    refresh_token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }, app.config['SECRET_KEY'], algorithm='HS256')

    return access_token, refresh_token

# Session cleanup
@app.after_request
def cleanup_session(response):
    """Remove the database session after each request"""
    try:
        db.session.commit()  # Commit any pending transactions
    except:
        db.session.rollback()  # Rollback on error
    finally:
        db.session.remove()  # Remove the session
    return response

# Routes
@app.route('/')
def index():
    return jsonify({"message": "Welcome to the Academic Assistance API!"})

@app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Register attempt with data: {data}")
    if not data.get('email') or not data.get('password') or not data.get('username'):
        logger.error("Missing required fields in register request")
        return jsonify({"error": "Email, username, and password are required"}), 400

    if not '@' in data['email'] or not '.' in data['email']:
        logger.error(f"Invalid email format: {data['email']}")
        return jsonify({"error": "Invalid email format"}), 400

    try:
        if User.query.filter_by(email=data['email']).first():
            logger.error(f"Email already registered: {data['email']}")
            return jsonify({"error": "Email already registered"}), 400

        if User.query.filter_by(username=data['username']).first():
            logger.error(f"Username already taken: {data['username']}")
            return jsonify({"error": "Username already taken"}), 400

        user = User(
            email=data['email'],
            username=data['username'],
            name=data.get('username', 'User'),
            role='client'
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        access_token, refresh_token = generate_tokens(user)
        
        logger.info(f"User registered successfully: {data['email']}")
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        }), 201
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Registration failed", "details": str(e)}), 500

@app.route('/auth/login', methods=['POST', 'OPTIONS'])
@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Login attempt with data: {data}")
    if not data.get('email') or not data.get('password'):
        logger.error("Missing email or password in login request")
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = User.query.filter_by(email=data['email']).first()
        if not user:
            user = User.query.filter_by(username=data['email']).first()

        if not user or not user.check_password(data['password']):
            logger.error(f"Invalid credentials for: {data['email']}")
            return jsonify({"error": "Invalid credentials"}), 401

        if user.email == 'ellyjames1999@gmail.com':
            user.role = 'admin'
        else:
            user.role = 'client'
        db.session.commit()

        access_token, refresh_token = generate_tokens(user)
        
        g.current_user = user  # Cache user
        logger.info(f"User logged in successfully: {data['email']}")
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        })
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        return jsonify({"error": "Login failed", "details": str(e)}), 500

@app.route('/auth/me', methods=['GET'])
@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        g.current_user = user  # Cache user
        return jsonify({
            'user': user.to_dict(),
            'role': user.role
        }), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/auth/google', methods=['POST', 'OPTIONS'])
@app.route('/api/auth/google', methods=['POST', 'OPTIONS'])
def google_login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Google login attempt with data: {data}")
    if not data or not data.get('credential'):
        logger.error("No credential provided in Google login request")
        return jsonify({"error": "Google credential is required"}), 400

    try:
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        logger.info(f"Google OAuth config - Client ID: {client_id}")
        if not client_id:
            logger.error("Missing Google Client ID")
            return jsonify({"error": "Server configuration error"}), 500

        logger.info("Verifying Google ID token")
        id_info = id_token.verify_oauth2_token(
            data['credential'],
            google_requests.Request(),
            client_id
        )

        email = id_info.get('email')
        if not email:
            logger.error("No email in ID token")
            return jsonify({"error": "Email not provided by Google"}), 400

        name = id_info.get('name', 'Google User')
        user = User.query.filter_by(email=email).first()

        if not user:
            logger.info(f"Creating new user with email: {email}")
            user = User(
                email=email,
                username=email.split('@')[0],
                name=name,
                role='client',
                password_hash=None
            )
            db.session.add(user)
            db.session.commit()

        if user.email == 'ellyjames1999@gmail.com':
            user.role = 'admin'
        else:
            user.role = 'client'
        db.session.commit()

        access_token, refresh_token = generate_tokens(user)

        g.current_user = user  # Cache user
        logger.info(f"Google login successful for user: {email}")
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        })

    except ValueError as ve:
        logger.error(f"Token verification failed: {str(ve)}")
        return jsonify({
            "error": "Invalid Google token",
            "details": str(ve)
        }), 400
    except Exception as e:
        logger.error(f"Google login error: {str(e)}")
        return jsonify({
            "error": "Failed to process Google login",
            "details": str(e)
        }), 500

@app.route('/api/auth/apple', methods=['POST', 'OPTIONS'])
def apple_login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Apple login attempt with data: {data}")
    if not data or not data.get('id_token'):
        logger.error("No ID token provided in Apple login request")
        return jsonify({"error": "Apple ID token is required"}), 400

    try:
        id_token_str = data['id_token']
        decoded = jwt.decode(id_token_str, options={"verify_signature": False})
        apple_public_keys = requests.get('https://appleid.apple.com/auth/keys').json()
        key = None
        for k in apple_public_keys['keys']:
            if k['kid'] == decoded['kid']:
                key = k
                break

        if not key:
            logger.error("Failed to find matching Apple public key")
            return jsonify({"error": "Failed to find matching Apple public key"}), 400

        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(key)
        decoded = jwt.decode(id_token_str, public_key, algorithms=['RS256'], audience=os.getenv('APPLE_CLIENT_ID'))

        email = decoded.get('email')
        if not email:
            logger.error("No email in Apple ID token")
            return jsonify({"error": "Email not provided by Apple"}), 400

        name = 'Apple User'
        user = User.query.filter_by(email=email).first()

        if not user:
            logger.info(f"Creating new user with email: {email}")
            user = User(
                email=email,
                username=email.split('@')[0],
                name=name,
                role='client',
                password_hash=None
            )
            db.session.add(user)
            db.session.commit()

        if user.email == 'ellyjames1999@gmail.com':
            user.role = 'admin'
        else:
            user.role = 'client'
        db.session.commit()

        access_token, refresh_token = generate_tokens(user)

        g.current_user = user  # Cache user
        logger.info(f"Apple login successful for user: {email}")
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        })

    except Exception as e:
        logger.error(f"Apple login error: {str(e)}")
        return jsonify({"error": "Failed to process Apple login", "details": str(e)}), 500

@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    logger.info("User logged out successfully")
    return jsonify({"message": "Successfully logged out"}), 200

@app.route('/api/auth/refresh', methods=['POST', 'OPTIONS'])
def refresh():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        g.current_user = user  # Cache user
        access_token, _ = generate_tokens(user)
        logger.info(f"Token refreshed for user ID: {user.id}")
        return jsonify({'access_token': access_token})
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/auth/forgot-password', methods=['POST', 'OPTIONS'])
def forgot_password():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Forgot password request for email: {data.get('email')}")
    if not data.get('email'):
        logger.error("Missing email in forgot password request")
        return jsonify({"error": "Email is required"}), 400

    try:
        user = User.query.filter_by(email=data['email']).first()
        if not user:
            logger.error(f"Email not found: {data['email']}")
            return jsonify({"error": "Email not found"}), 404

        token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=1)

        reset_token = ResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at
        )
        db.session.add(reset_token)
        db.session.commit()

        reset_url = f"http://localhost:5173/reset-password?token={token}"
        msg = Message(
            subject="Password Reset Request",
            recipients=[user.email],
            body=f"""
            You requested a password reset for your Camison Universal College account.
            
            Click the link below to reset your password:
            {reset_url}
            
            This link will expire in 1 hour.
            """
        )
        try:
            mail.send(msg)
            logger.info(f"Password reset email sent to: {user.email}")
        except Exception as e:
            logger.error(f"Failed to send reset email: {str(e)}")
            return jsonify({"error": "Failed to send reset email", "details": str(e)}), 500

        return jsonify({"message": "Password reset link sent to your email"}), 200
    except Exception as e:
        logger.error(f"Forgot password failed: {str(e)}")
        return jsonify({"error": "Failed to process forgot password", "details": str(e)}), 500

@app.route('/api/auth/reset-password', methods=['POST', 'OPTIONS'])
def reset_password():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Reset password attempt with token: {data.get('token')}")
    if not data.get('token') or not data.get('password'):
        logger.error("Missing token or password in reset password request")
        return jsonify({"error": "Token and new password are required"}), 400

    try:
        reset_token = ResetToken.query.filter_by(token=data['token']).first()
        if not reset_token:
            logger.error("Invalid or expired token")
            return jsonify({"error": "Invalid or expired token"}), 400

        if reset_token.expires_at < datetime.utcnow():
            db.session.delete(reset_token)
            db.session.commit()
            logger.error("Token has expired")
            return jsonify({"error": "Token has expired"}), 400

        user = db.session.get(User, reset_token.user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        user.set_password(data['password'])
        db.session.delete(reset_token)
        db.session.commit()

        logger.info(f"Password reset successfully for user: {user.email}")
        return jsonify({"message": "Password reset successfully"}), 200
    except Exception as e:
        logger.error(f"Reset password failed: {str(e)}")
        return jsonify({"error": "Failed to reset password", "details": str(e)}), 500

@app.route('/api/jobs', methods=['POST', 'OPTIONS'])
def create_job():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role != 'client':
            logger.error(f"Unauthorized job creation attempt by user ID: {user.id}")
            return jsonify({"error": "Only clients can create jobs"}), 403

        data = request.form
        files = request.files.getlist('files')
        logger.info(f"Creating job for user ID: {user.id}")
        if not all([data.get('subject'), data.get('title'), data.get('pages'), data.get('deadline'), data.get('instructions')]):
            logger.error("Missing required job fields")
            return jsonify({"error": "All required fields must be provided"}), 400

        file_paths = []
        for file in files:
            if file:
                filename = f"{datetime.now().timestamp()}-{file.filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                file_paths.append(filename)

        job = Job(
            user_id=user.id,
            client_name=user.name,
            subject=data['subject'],
            title=data['title'],
            pages=int(data['pages']),
            deadline=datetime.fromisoformat(data['deadline']),
            instructions=data['instructions'],
            cited_resources=int(data.get('citedResources', 0)),
            formatting_style=data.get('formattingStyle', 'APA'),
            writer_level=data.get('writerLevel', 'PHD'),
            spacing=data.get('spacing', 'double'),
            total_amount=float(data['totalAmount']),
            status='Pending',
            files=file_paths,
            completed_files=[],
            client_email=user.email
        )

        db.session.add(job)
        db.session.commit()

        admin_email = os.getenv('ADMIN_EMAIL', 'ellyjames1999@gmail.com')
        msg = Message(
            subject=f"New Job Posted: {job.title}",
            recipients=[admin_email],
            body=f"""
            A new job has been posted by {user.email}.
            
            Details:
            Subject: {job.subject}
            Title: {job.title}
            Pages: {job.pages}
            Deadline: {job.deadline}
            Total Amount: ${job.total_amount}
            Instructions: {job.instructions}
            Files: {len(file_paths)} attached
            """
        )
        try:
            mail.send(msg)
            logger.info(f"Job notification email sent to admin: {admin_email}")
        except Exception as e:
            logger.error(f"Failed to send job notification email: {str(e)}")

        logger.info(f"Job created successfully: {job.title}")
        return jsonify(job.to_dict()), 201
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/jobs', methods=['GET', 'OPTIONS'])
def get_jobs():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role == 'admin':
            jobs = Job.query.all()
        else:
            jobs = Job.query.filter_by(user_id=user.id).all()

        logger.info(f"Jobs retrieved for user ID: {user.id}")
        return jsonify([{
            **job.to_dict(),
            'client_name': job.client_name,
            'client_email': job.client_email
        } for job in jobs])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/jobs/<int:job_id>', methods=['GET', 'OPTIONS'])
def get_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
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

        logger.info(f"Job retrieved: {job_id}")
        return jsonify({
            **job.to_dict(),
            'client_name': job.client_name,
            'client_email': job.client_email,
            'messages': [msg.to_dict() for msg in job.messages]
        })
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/api/jobs/<int:job_id>', methods=['PUT', 'OPTIONS'])
def update_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        job = db.session.get(Job, job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404

        if user.role != 'admin':
            logger.error(f"Unauthorized job update attempt by user ID: {user.id}")
            return jsonify({"error": "Only admins can update jobs"}), 403

        data = request.get_json()
        if 'status' in data:
            job.status = data['status']
            if data['status'] == 'Completed':
                job.completed = True
            db.session.commit()

        logger.info(f"Job updated: {job_id}")
        return jsonify(job.to_dict())
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

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
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
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

        data = request.form
        content = data.get('content', '')
        completed_files = request.files.getlist('completed_files')

        logger.info(f"Sending message for job ID: {job_id}")
        if not content and not completed_files:
            logger.error("Missing message content or completed files")
            return jsonify({"error": "Message content or completed files required"}), 400

        file_paths = []
        for file in completed_files:
            if file:
                filename = f"completed-{datetime.now().timestamp()}-{file.filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                file_paths.append(filename)

        message = Message(
            job_id=job_id,
            sender_id=user.id,
            sender_role=user.role,
            content=content,
            files=file_paths
        )

        db.session.add(message)
        
        if file_paths:
            job.completed_files.extend(file_paths)
            job.status = 'Completed'
            job.completed = True
        
        db.session.commit()

        if user.role == 'admin':
            client = db.session.get(User, job.user_id)
            msg = Message(
                subject=f"Update on Your Job: {job.title}",
                recipients=[client.email],
                body=f"""
                You have a new message regarding your job "{job.title}".
                
                Message: {content}
                Completed Files: {len(file_paths)} attached
                View details: http://localhost:5173/client-dashboard
                """
            )
            try:
                mail.send(msg)
                logger.info(f"Message notification email sent to: {client.email}")
            except Exception as e:
                logger.error(f"Failed to send message notification email: {str(e)}")

        logger.info(f"Message sent for job ID: {job_id}")
        return jsonify(message.to_dict()), 201
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
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
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

        messages = Message.query.filter_by(job_id=job_id).order_by(Message.created_at).all()
        return jsonify([msg.to_dict() for msg in messages])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

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
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        data = request.form
        content = data.get('content', '')

        if not content:
            logger.error("Missing message content")
            return jsonify({"error": "Message content required"}), 400

        message = Message(
            sender_id=user.id,
            sender_role=user.role,
            content=content,
            files=[]
        )

        db.session.add(message)
        db.session.commit()

        if user.role == 'client':
            admin_email = os.getenv('ADMIN_EMAIL', 'ellyjames1999@gmail.com')
            msg = Message(
                subject=f"New Message from Client: {user.email}",
                recipients=[admin_email],
                body=f"""
                You have a new message from {user.email}.
                
                Message: {content}
                View details: http://localhost:5173/admin-dashboard
                """
            )
            try:
                mail.send(msg)
                logger.info(f"Message notification email sent to admin: {admin_email}")
            except Exception as e:
                logger.error(f"Failed to send message notification email: {str(e)}")

        if user.role == 'admin':
            clients = User.query.filter_by(role='client').all()
            for client in clients:
                msg = Message(
                    subject="New Message from Admin",
                    recipients=[client.email],
                    body=f"""
                    You have a new message from the admin.
                    
                    Message: {content}
                    View details: http://localhost:5173/client-dashboard
                    """
                )
                try:
                    mail.send(msg)
                    logger.info(f"Message notification email sent to: {client.email}")
                except Exception as e:
                    logger.error(f"Failed to send message notification email: {str(e)}")

        logger.info(f"Message sent by user ID: {user.id}")
        return jsonify(message.to_dict()), 201
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

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
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        messages = Message.query.filter((Message.job_id.is_(None))).order_by(Message.created_at).all()
        return jsonify([msg.to_dict() for msg in messages])
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@app.route('/uploads/<filename>', methods=['GET', 'OPTIONS'])
def get_file(filename):
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        if not hasattr(g, 'current_user'):
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user = db.session.get(User, data['user_id'])
            if not g.current_user:
                return jsonify({'error': 'User not found'}), 404

        user = g.current_user
        if user.role == 'admin':
            return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
        
        job = Job.query.filter(
            (Job.user_id == user.id) & 
            ((Job.files.contains(filename)) | (Job.completed_files.contains(filename)))
        ).first()
        
        if not job:
            logger.error(f"Unauthorized file access attempt by user ID: {user.id} for filename: {filename}")
            return jsonify({"error": "Unauthorized"}), 403
            
        logger.info(f"File retrieved: {filename}")
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

if __name__ == '__main__':
    app.run(debug=True, port=5000)
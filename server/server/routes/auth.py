from flask import Blueprint, request, jsonify, g, current_app
from datetime import datetime, timedelta
import jwt
import uuid
import logging
import requests
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from flask_mail import Message
from extensions import db, bcrypt, mail
from models import User, ResetToken

auth_bp = Blueprint('auth', __name__)

logger = logging.getLogger(__name__)

# Helper function to generate JWT tokens
def generate_tokens(user):
    access_token = jwt.encode({
        'sub': user.id,  # Added for flask-jwt-extended
        'user_id': user.id,  # Kept for backward compatibility
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

    refresh_token = jwt.encode({
        'sub': user.id,  # Added for flask-jwt-extended
        'user_id': user.id,  # Kept for backward compatibility
        'exp': datetime.utcnow() + timedelta(days=30)
    }, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

    return access_token, refresh_token

@auth_bp.after_request
def cleanup_session(response):
    try:
        db.session.commit()
    except Exception as e:
        logger.error(f"Session commit failed: {str(e)}")
        db.session.rollback()
    finally:
        db.session.remove()
    return response

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Register attempt with data: {data}")
    if not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400

    if '@' not in data['email'] or '.' not in data['email']:
        return jsonify({"error": "Invalid email format"}), 400

    try:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email already registered"}), 400

        user = User(
            email=data['email'],
            name=data.get('email', 'User').split('@')[0],  # Use email prefix as name
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

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Login attempt with data: {data}")
    if not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = User.query.filter_by(email=data['email']).first()
        if not user or not user.check_password(data['password']):
            return jsonify({"error": "Invalid credentials"}), 401

        admin_email = os.getenv('ADMIN_EMAIL')
        if not admin_email:
            return jsonify({"error": "Server configuration error: ADMIN_EMAIL not set"}), 500

        if user.email == admin_email:
            user.role = 'admin'
        else:
            user.role = 'client'
        db.session.commit()

        access_token, refresh_token = generate_tokens(user)
        
        g.current_user = user
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

@auth_bp.route('/me', methods=['GET', 'OPTIONS'])
def get_current_user():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        g.current_user = user
        return jsonify({
            'user': user.to_dict(),
            'role': user.role
        }), 200
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@auth_bp.route('/google', methods=['POST', 'OPTIONS'])
def google_login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Google login attempt with data: {data}")
    if not data or not data.get('credential'):
        return jsonify({"error": "Google credential is required"}), 400

    try:
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        if not client_id:
            return jsonify({"error": "Server configuration error"}), 500

        id_info = id_token.verify_oauth2_token(
            data['credential'],
            google_requests.Request(),
            client_id
        )

        email = id_info.get('email')
        if not email:
            return jsonify({"error": "Email not provided by Google"}), 400

        name = id_info.get('name', 'Google User')
        user = User.query.filter_by(email=email).first()

        if not user:
            user = User(
                email=email,
                name=name,
                role='client',
                password_hash=None
            )
            db.session.add(user)
            db.session.commit()

        admin_email = os.getenv('ADMIN_EMAIL')
        if not admin_email:
            return jsonify({"error": "Server configuration error: ADMIN_EMAIL not set"}), 500

        if user.email == admin_email:
            user.role = 'admin'
        else:
            user.role = 'client'
        db.session.commit()

        access_token, refresh_token = generate_tokens(user)

        g.current_user = user
        logger.info(f"Google login successful for user: {email}")
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        })

    except ValueError as ve:
        logger.error(f"Token verification failed: {str(ve)}")
        return jsonify({"error": "Invalid Google token", "details": str(ve)}), 400
    except Exception as e:
        logger.error(f"Google login error: {str(e)}")
        return jsonify({"error": "Failed to process Google login", "details": str(e)}), 500

@auth_bp.route('/apple', methods=['POST', 'OPTIONS'])
def apple_login():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Apple login attempt with data: {data}")
    if not data or not data.get('id_token'):
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
            return jsonify({"error": "Failed to find matching Apple public key"}), 400

        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(key)
        decoded = jwt.decode(id_token_str, public_key, algorithms=['RS256'], audience=os.getenv('APPLE_CLIENT_ID'))

        email = decoded.get('email')
        if not email:
            return jsonify({"error": "Email not provided by Apple"}), 400

        name = 'Apple User'
        user = User.query.filter_by(email=email).first()

        if not user:
            user = User(
                email=email,
                name=name,
                role='client',
                password_hash=None
            )
            db.session.add(user)
            db.session.commit()

        admin_email = os.getenv('ADMIN_EMAIL')
        if not admin_email:
            return jsonify({"error": "Server configuration error: ADMIN_EMAIL not set"}), 500

        if user.email == admin_email:
            user.role = 'admin'
        else:
            user.role = 'client'
        db.session.commit()

        access_token, refresh_token = generate_tokens(user)

        g.current_user = user
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

@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    logger.info("User logged out successfully")
    return jsonify({"message": "Successfully logged out"}), 200

@auth_bp.route('/refresh', methods=['POST', 'OPTIONS'])
def refresh():
    if request.method == 'OPTIONS':
        return '', 200

    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return jsonify({'error': 'Token missing or invalid'}), 401

    token = token.split(' ')[1]
    try:
        data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        user = db.session.get(User, data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        g.current_user = user
        access_token, _ = generate_tokens(user)
        logger.info(f"Token refreshed for user ID: {user.id}")
        return jsonify({'access_token': access_token})
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@auth_bp.route('/forgot-password', methods=['POST', 'OPTIONS'])
def forgot_password():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Forgot password request for email: {data.get('email')}")
    if not data.get('email'):
        return jsonify({"error": "Email is required"}), 400

    try:
        user = User.query.filter_by(email=data['email']).first()
        if not user:
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

        reset_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/reset-password?token={token}"
        msg = Message(
            subject="Password Reset Request for Camison Universal College",
            recipients=[user.email],
            body=f"""
Dear {user.name or user.email.split('@')[0]},

You have requested to reset your password for your Camison Universal College account.

Please click the following link to reset your password:
{reset_url}

This link will expire in 1 hour. If you did not request this, please ignore this email or contact support.

Best regards,
Camison Universal College Team
            """
        )
        try:
            mail.send(msg)
            logger.info(f"Password reset email sent to: {user.email}")
        except Exception as e:
            logger.error(f"Failed to send reset email to {user.email}: {str(e)}")
            return jsonify({"error": "Failed to send reset email", "details": str(e)}), 500

        return jsonify({"message": "Password reset link sent to your email. Please check your inbox (and spam folder if needed)."}), 200
    except Exception as e:
        logger.error(f"Forgot password failed: {str(e)}")
        return jsonify({"error": "Failed to process forgot password", "details": str(e)}), 500

@auth_bp.route('/reset-password', methods=['POST', 'OPTIONS'])
def reset_password():
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json()
    logger.info(f"Reset password attempt with token: {data.get('token')}")
    if not data.get('token') or not data.get('password'):
        return jsonify({"error": "Token and new password are required"}), 400

    try:
        reset_token = ResetToken.query.filter_by(token=data['token']).first()
        if not reset_token:
            return jsonify({"error": "Invalid or expired token"}), 400

        if reset_token.expires_at < datetime.utcnow():
            db.session.delete(reset_token)
            db.session.commit()
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
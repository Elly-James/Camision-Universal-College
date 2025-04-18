import os
from flask import Flask, request, jsonify, send_from_directory
from datetime import datetime, timedelta
from dotenv import load_dotenv
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt,
    create_refresh_token
)
from extensions import db, migrate, cors, jwt, bcrypt, mail
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests
import jwt as pyjwt
import stripe
from flask_mail import Message

def create_app():
    app = Flask(__name__)
    
    load_dotenv()
    
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL').replace('postgres://', 'postgresql://')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
    app.config['JWT_BLACKLIST_ENABLED'] = True
    app.config['JWT_BLACKLIST_TOKEN_CHECKS'] = ['access', 'refresh']
    app.config['UPLOAD_FOLDER'] = 'uploads'
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')
    app.config['STRIPE_SECRET_KEY'] = os.getenv('STRIPE_SECRET_KEY')
    
    stripe.api_key = app.config['STRIPE_SECRET_KEY']
    
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": os.getenv('FRONTEND_URL', 'http://localhost:3000')}})
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)

    # Ensure uploads directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Token blacklist storage (in-memory for simplicity)
    blacklisted_tokens = set()

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload['jti']
        return jti in blacklisted_tokens

    @app.route('/')
    def index():
        return jsonify({"message": "Welcome to the Learner Handler API! Use /api endpoints to interact with the API."})

    # AUTHENTICATION ROUTES
    @app.route('/api/auth/register', methods=['POST'])
    def register():
        from models import User
        data = request.get_json()
        
        if not data.get('email') or not data.get('password') or not data.get('username'):
            return jsonify({"error": "Email, username, and password are required"}), 400

        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email already registered"}), 400

        if User.query.filter_by(username=data['username']).first():
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
        
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        }), 201

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        from models import User
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400

        user = User.query.filter_by(email=data['email']).first()
        if not user:
            user = User.query.filter_by(username=data['email']).first()

        if not user or not user.check_password(data['password']):
            return jsonify({"error": "Invalid credentials"}), 401

        if data.get('role') and user.role != data['role']:
            return jsonify({"error": "Invalid role"}), 401

        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'role': user.role,
            'user': user.to_dict()
        })

    @app.route('/api/auth/me', methods=['GET'])
    @jwt_required()
    def get_current_user():
        from models import User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        return jsonify({
            'user': user.to_dict(),
            'role': user.role
        })

    @app.route('/api/auth/google', methods=['POST'])
    def google_login():
        from models import User
        data = request.get_json()
        
        if not data or not data.get('code'):
            return jsonify({"error": "Google authorization code is required"}), 400

        try:
            client_id = os.getenv('GOOGLE_CLIENT_ID')
            client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
            redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:3000')
            
            token_url = "https://oauth2.googleapis.com/token"
            token_data = {
                'code': data['code'],
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code',
            }
            
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }

            token_response = requests.post(
                token_url,
                data=token_data,
                headers=headers,
                timeout=10
            )

            token_response_json = token_response.json()
            if token_response.status_code != 200:
                return jsonify({
                    "error": "Failed to authenticate with Google",
                    "details": token_response_json.get('error_description', 'Unknown error')
                }), 400

            id_token_str = token_response_json.get('id_token')
            if not id_token_str:
                return jsonify({"error": "Invalid response from Google"}), 400

            id_info = id_token.verify_oauth2_token(
                id_token_str,
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
                    username=email.split('@')[0],
                    name=name,
                    role='client',
                    password_hash=None
                )
                db.session.add(user)
                db.session.commit()

            access_token = create_access_token(identity=user.id)
            refresh_token = create_refresh_token(identity=user.id)

            return jsonify({
                'access_token': access_token,
                'refresh_token': refresh_token,
                'role': user.role,
                'user': user.to_dict()
            })

        except Exception as e:
            return jsonify({
                "error": "Failed to process Google login",
                "details": str(e)
            }), 500

    @app.route('/api/auth/apple', methods=['POST'])
    def apple_login():
        from models import User
        data = request.get_json()

        if not data or not data.get('id_token'):
            return jsonify({"error": "Apple ID token is required"}), 400

        try:
            id_token_str = data['id_token']
            decoded = pyjwt.decode(id_token_str, options={"verify_signature": False})
            apple_public_keys = requests.get('https://appleid.apple.com/auth/keys').json()
            key = None
            for k in apple_public_keys['keys']:
                if k['kid'] == decoded['kid']:
                    key = k
                    break

            if not key:
                return jsonify({"error": "Failed to find matching Apple public key"}), 400

            from pyjwt.algorithms import RSAAlgorithm
            public_key = RSAAlgorithm.from_jwk(key)
            decoded = pyjwt.decode(id_token_str, public_key, algorithms=['RS256'], audience=os.getenv('APPLE_CLIENT_ID'))

            email = decoded.get('email')
            if not email:
                return jsonify({"error": "Email not provided by Apple"}), 400

            name = 'Apple User'
            user = User.query.filter_by(email=email).first()

            if not user:
                user = User(
                    email=email,
                    username=email.split('@')[0],
                    name=name,
                    role='client',
                    password_hash=None
                )
                db.session.add(user)
                db.session.commit()

            access_token = create_access_token(identity=user.id)
            refresh_token = create_refresh_token(identity=user.id)

            return jsonify({
                'access_token': access_token,
                'refresh_token': refresh_token,
                'role': user.role,
                'user': user.to_dict()
            })

        except Exception as e:
            return jsonify({"error": "Failed to process Apple login", "details": str(e)}), 500

    @app.route('/api/auth/logout', methods=['POST'])
    @jwt_required()
    def logout():
        jti = get_jwt()['jti']
        blacklisted_tokens.add(jti)
        return jsonify({"message": "Successfully logged out"}), 200

    @app.route('/api/auth/refresh', methods=['POST'])
    @jwt_required(refresh=True)
    def refresh():
        current_user = get_jwt_identity()
        new_token = create_access_token(identity=current_user)
        return jsonify({'access_token': new_token})

    # PAYMENT ROUTES
    @app.route('/api/create-payment-intent', methods=['POST'])
    @jwt_required()
    def create_payment_intent():
        try:
            data = request.get_json()
            amount = data.get('amount')
            if not amount or amount <= 0:
                return jsonify({"error": "Invalid amount"}), 400

            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency='usd',
                payment_method_types=['card'],
            )

            return jsonify({
                'client_secret': intent['client_secret']
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # JOB ROUTES
    @app.route('/api/jobs', methods=['POST'])
    @jwt_required()
    def create_job():
        from models import Job, User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        if user.role != 'client':
            return jsonify({"error": "Only clients can create jobs"}), 403

        data = request.form
        files = request.files.getlist('files')
        payment_intent_id = data.get('payment_intent_id')

        if not payment_intent_id:
            return jsonify({"error": "Payment intent ID is required"}), 400

        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            if payment_intent.status != 'succeeded':
                return jsonify({"error": "Payment not successful"}), 400
        except stripe.error.StripeError as e:
            return jsonify({"error": "Invalid payment intent"}), 400

        if not all([data.get('subject'), data.get('title'), data.get('pages'), data.get('deadline'), data.get('instructions')]):
            return jsonify({"error": "All required fields must be provided"}), 400

        file_paths = []
        for file in files:
            if file:
                filename = f"{datetime.now().timestamp()}-{file.filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                file_paths.append(filename)

        job = Job(
            user_id=user_id,
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
            client_email=user.email
        )

        db.session.add(job)
        db.session.commit()

        # Send email notification to admin
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
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
        except Exception as e:
            print(f"Failed to send email: {e}")

        return jsonify(job.to_dict()), 201

    @app.route('/api/jobs', methods=['GET'])
    @jwt_required()
    def get_jobs():
        from models import Job, User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)

        if user.role == 'admin':
            jobs = Job.query.all()
        else:
            jobs = Job.query.filter_by(user_id=user_id).all()

        return jsonify([job.to_dict() for job in jobs])

    @app.route('/api/jobs/<int:job_id>', methods=['GET'])
    @jwt_required()
    def get_job(job_id):
        from models import Job, User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        job = Job.query.get_or_404(job_id)

        if user.role != 'admin' and job.user_id != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        return jsonify(job.to_dict())

    @app.route('/api/jobs/<int:job_id>', methods=['PUT'])
    @jwt_required()
    def update_job(job_id):
        from models import Job, User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        job = Job.query.get_or_404(job_id)

        if user.role != 'admin':
            return jsonify({"error": "Only admins can update job status"}), 403

        data = request.get_json()
        if 'status' in data:
            job.status = data['status']
            job.completed = (data['status'] == 'Completed')
            db.session.commit()

        return jsonify(job.to_dict())

    @app.route('/api/jobs/<int:job_id>/messages', methods=['POST'])
    @jwt_required()
    def send_message(job_id):
        from models import Job, Message, User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        job = Job.query.get_or_404(job_id)

        if user.role != 'admin' and job.user_id != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        data = request.form
        content = data.get('content', '')
        completed_files = request.files.getlist('completed_files')

        if not content and not completed_files:
            return jsonify({"error": "Message content or completed files required"}), 400

        file_paths = job.completed_files or []
        for file in completed_files:
            if file:
                filename = f"completed-{datetime.now().timestamp()}-{file.filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                file_paths.append(filename)

        message = Message(
            job_id=job_id,
            sender_id=user_id,
            sender_role=user.role,
            content=content
        )

        db.session.add(message)
        job.completed_files = file_paths
        if completed_files:
            job.status = 'Completed'
            job.completed = True
        db.session.commit()

        # Send email notification to client if admin sends a message
        if user.role == 'admin':
            client = User.query.get(job.user_id)
            msg = Message(
                subject=f"Update on Your Job: {job.title}",
                recipients=[client.email],
                body=f"""
                You have a new message regarding your job "{job.title}".
                
                Message: {content}
                Completed Files: {len(completed_files)} attached
                View details: http://localhost:3000/client-dashboard
                """
            )
            try:
                mail.send(msg)
            except Exception as e:
                print(f"Failed to send email: {e}")

        return jsonify(message.to_dict()), 201

    @app.route('/uploads/<filename>', methods=['GET'])
    @jwt_required()
    def get_file(filename):
        from models import Job, User
        user_id = get_jwt_identity()
        user = User.query.get_or_404(user_id)
        if user.role != 'admin' and not Job.query.filter_by(user_id=user_id).filter(
            (Job.files.contains(filename)) | (Job.completed_files.contains(filename))
        ).first():
            return jsonify({"error": "Unauthorized"}), 403
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    return app

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
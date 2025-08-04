from extensions import db, bcrypt
from datetime import datetime

class User(db.Model):
    """User model for storing user information."""
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=True, index=True)  # Changed to nullable=True as username is no longer required
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(50), default='client')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    jobs = db.relationship('Job', backref='user', lazy=True)
    messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy=True)
    received_messages = db.relationship('Message', foreign_keys='Message.recipient_id', backref='recipient', lazy=True)
    reset_tokens = db.relationship('ResetToken', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password) if self.password_hash else False

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,  # May be None if not set during registration
            'name': self.name,
            'role': self.role,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Job(db.Model):
    """Job model for storing job order details."""
    __tablename__ = 'job'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    client_name = db.Column(db.String(120), nullable=True)
    client_email = db.Column(db.String(120), nullable=True)
    subject = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    pages = db.Column(db.Integer, nullable=False)
    deadline = db.Column(db.DateTime, nullable=False, index=True)
    instructions = db.Column(db.Text, nullable=False)
    cited_resources = db.Column(db.Integer, default=0)
    formatting_style = db.Column(db.String(50), default='APA')
    writer_level = db.Column(db.String(50), default='PHD')
    spacing = db.Column(db.String(50), default='double')
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='Pending', index=True)
    files = db.Column(db.JSON, default=list)
    completed_files = db.Column(db.JSON, default=list)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'client_name': self.client_name,
            'client_email': self.client_email,
            'subject': self.subject,
            'title': self.title,
            'pages': self.pages,
            'deadline': self.deadline.isoformat(),
            'instructions': self.instructions,
            'cited_resources': self.cited_resources,
            'formatting_style': self.formatting_style,
            'writer_level': self.writer_level,
            'spacing': self.spacing,
            'total_amount': self.total_amount,
            'status': self.status,
            'files': self.files,
            'completed_files': self.completed_files,
            'completed': self.completed,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class ResetToken(db.Model):
    """ResetToken model for storing password reset tokens."""
    __tablename__ = 'reset_token'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    token = db.Column(db.String(36), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'expires_at': self.expires_at.isoformat(),
            'created_at': self.created_at.isoformat()
        }

class Message(db.Model):
    """Message model for storing communication between users."""
    __tablename__ = 'message'
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True, index=True)
    sender_role = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=True)
    files = db.Column(db.JSON, default=list)
    client_deleted = db.Column(db.Boolean, default=False)
    admin_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'job_id': self.job_id,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'sender_role': self.sender_role,
            'content': self.content,
            'files': self.files,
            'client_deleted': self.client_deleted,
            'admin_deleted': self.admin_deleted,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
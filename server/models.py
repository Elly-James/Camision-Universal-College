from extensions import db, bcrypt
from datetime import datetime

class User(db.Model):
    """User model for storing user information."""
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(50), default='client')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    jobs = db.relationship('Job', backref='user', lazy=True)
    messages = db.relationship('Message', backref='sender', lazy=True)
    reset_tokens = db.relationship('ResetToken', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password) if self.password_hash else False

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'name': self.name,
            'role': self.role,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Job(db.Model):
    """Job model for storing job order details."""
    __tablename__ = 'job'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    client_name = db.Column(db.String(120), nullable=True)  # Changed to nullable=True
    client_email = db.Column(db.String(120), nullable=True)  # Changed to nullable=True
    subject = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    pages = db.Column(db.Integer, nullable=False)
    deadline = db.Column(db.DateTime, nullable=False)
    instructions = db.Column(db.Text, nullable=False)
    cited_resources = db.Column(db.Integer, default=0)
    formatting_style = db.Column(db.String(50), default='APA')
    writer_level = db.Column(db.String(50), default='PHD')
    spacing = db.Column(db.String(50), default='double')
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='Pending')
    files = db.Column(db.JSON, default=list)
    completed_files = db.Column(db.JSON, default=list)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = db.relationship('Message', backref='job', lazy=True, cascade='all, delete-orphan')

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
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token = db.Column(db.String(36), unique=True, nullable=False)
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
    """Message model for storing communication related to jobs."""
    __tablename__ = 'message'
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'))
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sender_role = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=True)  # Changed to nullable=True
    files = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'job_id': self.job_id,
            'sender_id': self.sender_id,
            'sender_role': self.sender_role,
            'content': self.content,
            'files': self.files,
            'created_at': self.created_at.isoformat()
        }
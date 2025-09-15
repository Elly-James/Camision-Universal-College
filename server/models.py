from extensions import db, bcrypt
from datetime import datetime
import pytz

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(50), default='client')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))
    
    jobs = db.relationship('Job', backref='user', lazy=True)
    messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy=True)
    received_messages = db.relationship('Message', foreign_keys='Message.recipient_id', backref='recipient', lazy=True)
    reset_tokens = db.relationship('ResetToken', backref='user', lazy=True)
    blogs = db.relationship('Blog', backref='author', lazy=True)

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
    payment_status = db.Column(db.String(50), default='Pending', index=True)
    order_tracking_id = db.Column(db.String(36), nullable=True)
    completion_tracking_id = db.Column(db.String(36), nullable=True)
    merchant_reference = db.Column(db.String(100), nullable=True)
    completion_reference = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), default='Pending Payment', index=True)
    files = db.Column(db.JSON, default=list)
    completed_files = db.Column(db.JSON, default=list)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))

    __table_args__ = (
        db.CheckConstraint('payment_status IN (\'Pending\', \'Partial\', \'Completed\')', name='check_payment_status'),
    )

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
            'payment_status': self.payment_status,
            'order_tracking_id': self.order_tracking_id,
            'completion_tracking_id': self.completion_tracking_id,
            'merchant_reference': self.merchant_reference,
            'completion_reference': self.completion_reference,
            'status': self.status,
            'files': self.files,
            'completed_files': self.completed_files,
            'completed': self.completed,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class ResetToken(db.Model):
    __tablename__ = 'reset_token'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    token = db.Column(db.String(36), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'expires_at': self.expires_at.isoformat(),
            'created_at': self.created_at.isoformat()
        }

class Message(db.Model):
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
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC), index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))

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

class IPNRegistration(db.Model):
    __tablename__ = 'ipn_registration'
    id = db.Column(db.Integer, primary_key=True)
    ipn_id = db.Column(db.String(36), unique=True, nullable=False, index=True)
    url = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC))
    ipn_status = db.Column(db.String(50), default='Active')

    def to_dict(self):
        return {
            'id': self.id,
            'ipn_id': self.ipn_id,
            'url': self.url,
            'created_at': self.created_at.isoformat(),
            'ipn_status': self.ipn_status
        }

class Blog(db.Model):
    __tablename__ = 'blog'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(255), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    url = db.Column(db.String(255), nullable=True)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC), index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'image': self.image,
            'email': self.email,
            'url': self.url,
            'author_id': self.author_id,
            'author_name': self.author.name,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
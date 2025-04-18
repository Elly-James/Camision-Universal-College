from datetime import datetime
from extensions import db, bcrypt

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(20), nullable=False, default='client')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
        if password:
            self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        if not self.password_hash:
            return False
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'name': self.name,
            'role': self.role
        }

class Job(db.Model):
    __tablename__ = 'jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    pages = db.Column(db.Integer, nullable=False)
    deadline = db.Column(db.DateTime, nullable=False)
    instructions = db.Column(db.Text, nullable=False)
    cited_resources = db.Column(db.Integer, default=0)
    formatting_style = db.Column(db.String(50), default='APA')
    writer_level = db.Column(db.String(50), default='PHD')
    spacing = db.Column(db.String(20), default='double')
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='Pending')
    completed = db.Column(db.Boolean, default=False)
    files = db.Column(db.JSON, default=list)
    completed_files = db.Column(db.JSON, default=list)
    client_email = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
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
            'completed': self.completed,
            'files': self.files,
            'completed_files': self.completed_files,
            'client_email': self.client_email,
            'created_at': self.created_at.isoformat(),
            'messages': [msg.to_dict() for msg in Message.query.filter_by(job_id=self.id).all()]
        }

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    sender_role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'job_id': self.job_id,
            'sender_id': self.sender_id,
            'sender_role': self.sender_role,
            'content': self.content,
            'created_at': self.created_at.isoformat()
        }
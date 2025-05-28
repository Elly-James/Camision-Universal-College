from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
import logging
from flask_socketio import SocketIO

# Initialize Flask extensions
db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
mail = Mail()
socketio = SocketIO()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
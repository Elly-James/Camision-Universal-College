# from flask_sqlalchemy import SQLAlchemy
# from flask_migrate import Migrate
# from flask_cors import CORS
# from flask_jwt_extended import JWTManager
# from flask_bcrypt import Bcrypt
# from flask_mail import Mail

# db = SQLAlchemy()
# migrate = Migrate()
# cors = CORS()
# jwt = JWTManager()
# bcrypt = Bcrypt()
# mail = Mail()



from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
import logging

# Initialize Flask extensions
db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
cors = CORS()
mail = Mail()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from flask import Flask
from extensions import db
import logging
from sqlalchemy import create_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://camison_user:smokingmirror@/camison_univ_college'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    logger.info(f"Testing connection with URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    try:
        engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
        conn = engine.connect()
        logger.info("Successfully connected to database")
        conn.close()
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
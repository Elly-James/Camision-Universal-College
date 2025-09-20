# config.py - Updated to support multiple admin emails

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'Uploads')
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB upload limit
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    # Admin emails configuration - support multiple emails
    ADMIN_EMAILS = [email.strip() for email in os.getenv('ADMIN_EMAILS', '').split(',') if email.strip()]
    
    # Mail configuration
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_USERNAME')
    
    # JWT configuration
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Pesapal configuration
    PESAPAL_CONSUMER_KEY = os.getenv('PESAPAL_CONSUMER_KEY')
    PESAPAL_CONSUMER_SECRET = os.getenv('PESAPAL_CONSUMER_SECRET')
    PESAPAL_ENVIRONMENT = os.getenv('PESAPAL_ENVIRONMENT', 'sandbox')  # 'sandbox' or 'live'
    PESAPAL_ADMIN_EMAIL = os.getenv('PESAPAL_ADMIN_EMAIL', 'admin@example.com')  # Admin email for notifications

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False  # Log SQL queries
    # Increase rate limits for development
    RATE_LIMITS = ["1000 per day", "200 per hour"]

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 10,
        'max_overflow': 20,
    }
    RATE_LIMITS = ["1000 per day", "200 per hour"]

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig
}
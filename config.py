import os
from dotenv import load_dotenv

load_dotenv()  # Load variables from .env

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", os.urandom(24))
    SESSION_TYPE = "filesystem"
    SESSION_PERMANENT = False
    BABEL_DEFAULT_LOCALE = "en"
    BABEL_SUPPORTED_LOCALES = [
        'en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'ru',
        'pt', 'ur', 'id', 'de', 'ja', 'sw', 'pa', 'nl'
    ]
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    PI_API_KEY = os.getenv("PI_API_KEY") # Add Pi Network API Key
class DevConfig(Config):
    DEBUG = True

class ProdConfig(Config):
    DEBUG = False

# blueprints/payments/__init__.py
from flask import Blueprint

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

# Import routes after blueprint creation to avoid circular imports
from . import routes
from flask import Flask, request, session, redirect, url_for, render_template, jsonify # Add jsonify
from config import DevConfig
from dotenv import load_dotenv
from flask_session import Session
from flask_babel import Babel, _  # Ensure `_` is imported for translations
from pymongo import MongoClient
import os
import logging  # Added for better error handling
from blueprints.utils.geo import geo_bp
from flask_cors import CORS


# 🌱 Load environment
load_dotenv()

# 🔌 MongoDB
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise ValueError("MONGO_URI is not set in the environment variables. Please check your .env file.")

client = MongoClient(mongo_uri)
db = client["pihappy"]

# 🚀 Flask app setup
app = Flask(__name__)
app.config.from_object(DevConfig)
app.register_blueprint(geo_bp)

# Fix session cookie name assignment
app.session_cookie_name = app.config.get('SESSION_COOKIE_NAME', 'session')

# Enable CORS for all routes
CORS(app, supports_credentials=True) # Allow credentials (cookies)

# 🛠️ Logging setup
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 🧭 Locale selector (requires Flask-Babel >= 3.0.0)
from blueprints.utils.locale import get_locale
babel = Babel(app, locale_selector=get_locale)

# 🔒 Sessions
Session(app)

# 🔧 Language switcher
@app.route("/set_language", methods=["POST"])
def set_language():
    lang = request.form.get("lang")
    if (lang in app.config["BABEL_SUPPORTED_LOCALES"]):
        session["lang"] = lang
    return redirect(request.referrer or url_for("journal.index"))

# 🌍 Inject `_()` and locale globally to templates
@app.context_processor
def inject_globals():
    # Removed redundant import of flask_babel
    return dict(_=_, get_locale=get_locale)

# 🧩 Blueprints
from blueprints.auth.routes import auth_bp
from blueprints.journal.routes import journal_bp
from blueprints.chat.routes import chat_bp
from blueprints.community.routes import community_bp
from blueprints.winkels.routes import winkels_bp
from blueprints.shop.routes import shop_bp
from blueprints.tts.routes import tts_bp # Import the new TTS blueprint
# Register blueprints with /api prefix for clarity and separation
# Assuming shop_bp, community_bp, winkels_bp also contain API routes. Adjust if not.
app.register_blueprint(shop_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api') # Handles /api/profile, /api/login etc.
app.register_blueprint(journal_bp, url_prefix='/api') # Handles /api/, /api/nieuw
app.register_blueprint(chat_bp, url_prefix='/api') # Handles /api/chat, /api/chat_geschiedenis etc.
app.register_blueprint(community_bp, url_prefix='/api')
app.register_blueprint(winkels_bp, url_prefix='/api')
app.register_blueprint(tts_bp, url_prefix='/api') # Handles /api/tts/synthesize
# ❌ Error handlers
# Removed 404 handler - React Router handles this now.
# @app.errorhandler(404)
# def pagina_niet_gevonden(e):
#     logger.error(f"404 Error: {e}")
#     # Return JSON for API-like requests, React handles browser routes
#     return jsonify({"error": "Not Found", "message": str(e)}), 404

@app.errorhandler(Exception) # Catch more general exceptions that might lead to 500
def handle_exception(e):
    # Log the error
    logger.error(f"Unhandled Exception: {e}", exc_info=True) # Log traceback

    # Check if the client prefers JSON (likely an API call)
    if request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html:
        response = jsonify({
            "status": "error",
            "message": "An internal server error occurred.",
            # Optionally include error details in debug mode, but be cautious in production
            # "error_details": str(e) if app.debug else None
        })
        response.status_code = 500
        return response

    # For non-API requests, Flask/Werkzeug will likely return a default plain error page.
    # We prioritize returning JSON for API errors.
    # If you absolutely need a fallback HTML, you could keep the 500.html render here,
    # but it won't be styled like your React app.
    # For now, we'll rely on the JSON response for API errors and default browser/werkzeug
    # pages for direct server errors not caught by API checks.
    # Returning a generic JSON error for non-API 500 errors as well.
    return jsonify({
        "status": "error",
        "message": "An internal server error occurred.",
        "error_details": str(e) # Include error details for debugging
        }), 500

# 🏁 Start
if __name__ == "__main__":
    # Disable reloader to potentially avoid WinError 10038 on Windows
    app.run(debug=True, use_reloader=False)

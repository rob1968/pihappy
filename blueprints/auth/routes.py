from flask import Blueprint, render_template, request, redirect, url_for, flash, session
import bcrypt
from datetime import datetime
from blueprints.utils.files import load_users, save_users, generate_user_id
from blueprints.utils.geo import save_store_if_applicable
from blueprints.utils.locale import get_country_language # Import the new function

from flask import Blueprint, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient
import os

auth_bp = Blueprint("auth", __name__)

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]

@auth_bp.route("/api/register", methods=["POST"])
def register():
    try:
        data = request.json  # Parse JSON data from the request
        timestamp = data.get("timestamp", datetime.utcnow().isoformat())  # Use current time if not provided
        naam = data.get("naam")
        email = data.get("email")
        wachtwoord = data.get("wachtwoord")
        land = data.get("land")
        heeft_winkel = data.get("heeft_winkel")
        winkelnaam = data.get("winkelnaam", None)
        locatie = data.get("locatie", None)
        browser_lang = data.get("browser_lang", "en") # Get browser language, default to 'en'

        # Validate required fields
        if not naam or not email or not wachtwoord:
            return jsonify({"status": "error", "message": "Vereiste velden ontbreken."}), 400

        # Check if the user already exists
        existing_user = db.users.find_one({"email": email})
        if existing_user:
            return jsonify({"status": "error", "message": "Gebruiker met dit e-mailadres bestaat al."}), 400

        # Hash the password for security
        hashed_password = generate_password_hash(wachtwoord)

        # Determine country language based on selected land
        country_lang = get_country_language(land) if land else "en"

        # Create a new user document
        user = {
            "naam": naam,
            "email": email,
            "wachtwoord": hashed_password,
            "land": land,
            "heeft_winkel": heeft_winkel,
            "winkelnaam": winkelnaam,
            "locatie": locatie,
            "browser_lang": browser_lang, # Add browser language
            "country_lang": country_lang, # Add derived country language
            "timestamp": timestamp,  # Add the timestamp field
        }

        # Insert the user into the database
        db.users.insert_one(user)

        return jsonify({"status": "success", "message": "Gebruiker geregistreerd!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    

@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    # Find the user by email
    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"status": "error", "message": "Gebruiker niet gevonden."}), 404

    # Check the password
    if not check_password_hash(user["wachtwoord"], password):
        return jsonify({"status": "error", "message": "Onjuist wachtwoord."}), 401

    # Store user session
    session["gebruiker"] = {
        "id": str(user["_id"]), # Store ID as expected by chat blueprint
        "email": user["email"], # Keep email for potential future use
        "naam": user.get("naam"), # Store name as well, might be useful
        "land": user.get("land") # Add the 'land' field from the user document
    }

    return jsonify({"status": "success", "message": "Login succesvol!"})

@auth_bp.route("/logout")
def logout():
    session.pop("user_id", None)  # Corrected key to "user_id"
    flash("Je bent uitgelogd!", "info")
    return redirect(url_for("auth.login"))

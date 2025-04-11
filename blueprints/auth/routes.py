from flask import Blueprint, jsonify, request, session
from pymongo import MongoClient
from bson.objectid import ObjectId # Ensure ObjectId is imported ONCE
from werkzeug.security import generate_password_hash, check_password_hash
import os
import logging
import requests # <<< ADDED for geocoding
from datetime import datetime
from blueprints.utils.locale import get_country_language # Assuming this utility exists

auth_bp = Blueprint("auth", __name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG) # Adjust level as needed

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"] # Ensure this is your correct database name

@auth_bp.route("/register", methods=["POST"]) # Removed /api prefix
def register():
    try:
        data = request.json
        timestamp = data.get("timestamp", datetime.utcnow().isoformat())
        naam = data.get("naam")
        email = data.get("email")
        wachtwoord = data.get("wachtwoord")
        land = data.get("land") # Expecting country code here, e.g., 'az'
        full_country_name = data.get("full_country_name") # <<< Expecting full name here, e.g., "Azerbaijan"
        # Removed shop-related fields based on previous steps
        browser_lang = data.get("browser_lang", "en") # Keep browser lang for info
        preferred_lang = data.get("language") # Get preferred language from request

        # Add preferred_lang and full_country_name to validation
        if not naam or not email or not wachtwoord or not land or not preferred_lang or not full_country_name: # <<< ADDED check for full name
            return jsonify({"status": "error", "message": "Required fields missing (Name, Email, Password, Country Code, Full Country Name, Language)."}), 400

        existing_user = db.users.find_one({"email": email})
        if existing_user:
            return jsonify({"status": "error", "message": "Gebruiker met dit e-mailadres bestaat al."}), 400

        hashed_password = generate_password_hash(wachtwoord)
        # Use the provided 'land' (code) for determining country_lang if needed
        country_lang = get_country_language(land) if land else "en"

        # --- REMOVED Geocoding logic to derive full country name ---
        # Frontend is now expected to send both 'land' (code) and 'full_country_name'

        user = {
            "naam": naam,
            "email": email,
            "wachtwoord": hashed_password,
            "land": land, # Store the provided country code/value
            "full_land_name": full_country_name, # Store the provided full country name
            # Removed shop fields
            "browser_lang": browser_lang, # User's browser language at registration
            "country_lang": country_lang, # Based on 'land' code
            "preferred_language": preferred_lang, # Use language selected by user
            "timestamp": timestamp,
        }

        insert_result = db.users.insert_one(user)
        logging.info(f"User registered successfully: {email}, ID: {insert_result.inserted_id}")
        return jsonify({"status": "success", "message": "Gebruiker geregistreerd!"}), 201 # Use 201 Created status

    except Exception as e:
        logging.error(f"Error during registration: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Internal server error during registration."}), 500


@auth_bp.route("/login", methods=["POST"]) # Removed /api prefix
def login():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"status": "error", "message": "Email en wachtwoord zijn verplicht."}), 400

        user = db.users.find_one({"email": email})
        if not user:
            logging.warning(f"Login attempt failed for non-existent user: {email}")
            return jsonify({"status": "error", "message": "Gebruiker niet gevonden."}), 404

        # --- Add detailed logging here ---
        stored_hash = user.get("wachtwoord")
        logging.debug(f"User found for login attempt: {email}. Stored hash: '{stored_hash}'")
        # --- End of added logging ---

        if not stored_hash or not check_password_hash(stored_hash, password): # Check if hash exists before checking
            logging.warning(f"Login attempt failed for user {email}: Incorrect password or missing hash.")
            # Avoid revealing if it was missing hash vs incorrect password in the response for security
            return jsonify({"status": "error", "message": "Onjuist wachtwoord of gebruikersprobleem."}), 401

        user_id_obj = user.get("_id")
        if not user_id_obj:
             logging.error(f"User found but has no _id: {email}")
             return jsonify({"status": "error", "message": "Internal server error during login."}), 500

        # Store essential, non-sensitive info in session
        session["gebruiker"] = {
            "id": str(user_id_obj), # Convert ObjectId to string for session
            "email": user["email"],
            "naam": user.get("naam"),
            "land": user.get("land")
        }
        session.modified = True # Explicitly mark session as modified
        logging.info(f"User {user['email']} logged in. Session ID set to: {session['gebruiker']['id']}")
        return jsonify({"status": "success", "message": "Login succesvol!"})

    except Exception as e:
        logging.error(f"Error during login: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Internal server error during login."}), 500


@auth_bp.route("/logout", methods=["POST"]) # Removed /api prefix
def logout():
    user_email = session.get('gebruiker', {}).get('email', 'Unknown')
    if 'gebruiker' in session:
        session.pop('gebruiker', None)
        logging.info(f"User {user_email} logged out.")
        return jsonify({"status": "success", "message": "Logout succesvol!"}), 200
    else:
        logging.info("Logout attempt failed: No active session found.")
        # It's okay to return success even if not logged in for logout
        return jsonify({"status": "success", "message": "Geen actieve sessie gevonden."}), 200


# Combined route for getting profile (own or specific user)
@auth_bp.route("/profile", methods=["GET"])          # Removed /api prefix
@auth_bp.route("/profile/<user_id>", methods=["GET"]) # Removed /api prefix
def get_profile(user_id=None):
    # 1. Check Authentication (must be logged in to view any profile)
    if 'gebruiker' not in session or 'id' not in session['gebruiker']:
        logging.warning("Profile access attempt without authentication.")
        return jsonify({"error": "Authentication required"}), 401

    logged_in_user_id_str = session['gebruiker']['id']
    target_user_id_str = None

    # 2. Determine Target User ID
    if user_id:
        # Viewing a specific user's profile (passed in URL)
        target_user_id_str = user_id
        # Optional: Add permission check here (e.g., is admin? is self?)
        # if target_user_id_str != logged_in_user_id_str # and not is_admin(session['gebruiker']):
        #     logging.warning(f"User {logged_in_user_id_str} attempted to view profile {target_user_id_str} without permission.")
        #     return jsonify({"error": "Permission denied"}), 403
        logging.debug(f"Attempting to fetch specific profile for user ID: '{target_user_id_str}' by user '{logged_in_user_id_str}'")
    else:
        # Viewing own profile (use ID from session)
        target_user_id_str = logged_in_user_id_str
        logging.debug(f"Attempting to fetch own profile for user ID: '{target_user_id_str}'")

    # 3. Validate and Convert Target ID String to ObjectId
    if not target_user_id_str:
         # This case should ideally not happen if auth check passed
         logging.error("Target user ID string is unexpectedly empty after auth check.")
         return jsonify({"error": "Internal server error: User ID missing."}), 500

    try:
        target_user_object_id = ObjectId(target_user_id_str) # Use ObjectId here
    except Exception as e:
        # This catches invalid formats (e.g., not 12 bytes, wrong characters)
        logging.error(f"Failed to convert target user ID string '{target_user_id_str}' to ObjectId: {e}", exc_info=False) # Keep log concise
        # Check if the error is specifically NameError, indicating the import failed despite being present
        if isinstance(e, NameError):
             logging.critical("ObjectId is not defined! Check Python environment and Flask server restart.")
             return jsonify({"error": "Server configuration error: ObjectId not found."}), 500
        return jsonify({"error": f"Invalid user ID format provided: {target_user_id_str}"}), 400 # Return 400 for bad ID format

    # 4. Fetch User and Feedback Data from Database
    try:
        user_data = db.users.find_one({"_id": target_user_object_id})
        # Also fetch the latest feedback for this user
        # Query feedback collection using the user ID STRING, matching how it's saved
        feedback_data = db.feedback.find_one({"_id": target_user_id_str})
    except Exception as e:
        logging.error(f"Database error fetching profile or feedback for ObjectId {target_user_object_id}: {e}", exc_info=True)
        return jsonify({"error": "Database error occurred."}), 500

    # 5. Handle User Not Found
    if not user_data:
        logging.warning(f"User profile not found for ObjectId: {target_user_object_id} (String: '{target_user_id_str}')")
        # If fetching own profile and not found, the session ID might be stale/invalid
        if not user_id: # Only clear session if fetching own profile failed
            session.pop("gebruiker", None)
            logging.info(f"Cleared potentially invalid session for user ID string: {target_user_id_str}")
        return jsonify({"error": "User not found"}), 404

    # 6. Prepare and Return Profile Data (excluding sensitive info)
    profile_data = {
        "_id": str(user_data["_id"]), # Convert ObjectId back to string for JSON
        "naam": user_data.get("naam"),
        "email": user_data.get("email"), # Usually okay to return email
        "land": user_data.get("land"), # Keep original land value
        "full_land_name": user_data.get("full_land_name"), # <<< ADDED: Get full name
        "language": user_data.get("preferred_language", user_data.get("country_lang", user_data.get("browser_lang", "en"))), # Prioritize preferred_language
        # Add the latest feedback, default to None if not found or no feedback field
        "latest_feedback": feedback_data.get("feedback") if feedback_data else None,
        "country_center_lat": None, # Default to None
        "country_center_lng": None  # Default to None
    }

    # --- Geocode User's Country (using full name if available) ---
    # Prioritize full name for geocoding, fall back to original 'land' field
    country_to_geocode = user_data.get("full_land_name", user_data.get("land"))
    GEOCODING_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY') # Use the same key as shops

    if country_to_geocode and GEOCODING_API_KEY: # <<< Use combined variable
        GEOCODING_API_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
        geocode_params = {'address': country_to_geocode, 'key': GEOCODING_API_KEY} # <<< Use combined variable
        try:
            logging.debug(f"Geocoding country for profile '{target_user_id_str}': {country_to_geocode}") # <<< Use combined variable
            geocode_response = requests.get(GEOCODING_API_ENDPOINT, params=geocode_params, timeout=5)
            geocode_response.raise_for_status()
            geocode_data = geocode_response.json()

            if geocode_data.get('status') == 'OK' and geocode_data.get('results'):
                # Use the first result's geometry location
                location_data = geocode_data['results'][0]['geometry']['location']
                profile_data["country_center_lat"] = location_data.get('lat')
                profile_data["country_center_lng"] = location_data.get('lng')
                logging.info(f"Geocoded country '{country_to_geocode}' to: Lat={profile_data['country_center_lat']}, Lng={profile_data['country_center_lng']}") # <<< Use combined variable
            else:
                 logging.warning(f"Geocoding failed for country '{country_to_geocode}'. Status: {geocode_data.get('status')}") # <<< Use combined variable

        except requests.exceptions.RequestException as geo_err:
            logging.error(f"Error calling Geocoding API for country '{country_to_geocode}': {geo_err}") # <<< Use combined variable
        except Exception as geo_proc_err:
            logging.error(f"Error processing Geocoding response for country '{country_to_geocode}': {geo_proc_err}", exc_info=True) # <<< Use combined variable
    elif not country_to_geocode: # <<< Use combined variable
        logging.warning(f"User {target_user_id_str} has no country ('land' or 'full_land_name') set in profile.")
    elif not GEOCODING_API_KEY:
         logging.error("GOOGLE_PLACES_API_KEY not set, cannot geocode country for profile.")
    # --- End Geocode User's Country ---

    logging.debug(f"Successfully fetched profile data for user ID: {target_user_id_str}")
    return jsonify(profile_data), 200


# Combined route for updating profile (own or specific user - requires permission check)
@auth_bp.route("/profile", methods=["PUT"])          # Removed /api prefix
@auth_bp.route("/profile/<user_id>", methods=["PUT"]) # Removed /api prefix
def update_profile(user_id=None):
    # 1. Check Authentication
    if 'gebruiker' not in session or 'id' not in session['gebruiker']:
        logging.warning("Profile update attempt without authentication.")
        return jsonify({"error": "Authentication required"}), 401

    logged_in_user_id_str = session['gebruiker']['id']
    target_user_id_str = None

    # 2. Determine Target User ID
    if user_id:
        target_user_id_str = user_id
        logging.debug(f"Attempting to update specific profile for user ID: '{target_user_id_str}' by user '{logged_in_user_id_str}'")
        # *** CRITICAL: Add permission check ***
        # Can the logged-in user update this target profile? (e.g., self or admin)
        if target_user_id_str != logged_in_user_id_str: # Add admin check if needed: and not is_admin(session['gebruiker']):
             logging.warning(f"User {logged_in_user_id_str} attempted to update profile {target_user_id_str} without permission.")
             return jsonify({"error": "Permission denied to update this profile"}), 403
    else:
        # Updating own profile
        target_user_id_str = logged_in_user_id_str
        logging.debug(f"Attempting to update own profile for user ID: '{target_user_id_str}'")

    # 3. Validate and Convert Target ID String to ObjectId
    if not target_user_id_str:
         logging.error("Target user ID string is unexpectedly empty during update after auth check.")
         return jsonify({"error": "Internal server error: User ID missing."}), 500

    try:
        target_user_object_id = ObjectId(target_user_id_str) # Use ObjectId here
    except Exception as e:
        logging.error(f"Failed to convert target user ID string '{target_user_id_str}' to ObjectId during update: {e}", exc_info=False)
        if isinstance(e, NameError):
             logging.critical("ObjectId is not defined during update! Check Python environment and Flask server restart.")
             return jsonify({"error": "Server configuration error: ObjectId not found."}), 500
        return jsonify({"error": f"Invalid user ID format provided: {target_user_id_str}"}), 400

    # 4. Get Update Data from Request Body
    data = request.json
    if not data:
        logging.warning(f"Profile update attempt for {target_user_id_str} with no data.")
        return jsonify({"error": "No data provided"}), 400

    # 5. Define Allowed Updates (prevent updating sensitive fields like email, password, _id)
    allowed_updates = {}
    # Use .get() for safety and check type
    new_naam = data.get("naam")
    if new_naam is not None and isinstance(new_naam, str):
        allowed_updates["naam"] = new_naam.strip() # Trim whitespace

    new_land_code = data.get("land") # Expecting the code (e.g., 'nl')
    if new_land_code is not None and isinstance(new_land_code, str):
        new_land_code = new_land_code.strip()
        allowed_updates["land"] = new_land_code # Store the new code

        # --- Attempt to derive and update full_land_name ---
        derived_full_country_name = None
        GEOCODING_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY')
        if GEOCODING_API_KEY:
            GEOCODING_API_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
            # Geocode using the new land code provided in the update
            geocode_params = {'address': new_land_code, 'key': GEOCODING_API_KEY}
            try:
                logging.debug(f"Geocoding new country during profile update: {new_land_code}")
                geocode_response = requests.get(GEOCODING_API_ENDPOINT, params=geocode_params, timeout=5)
                geocode_response.raise_for_status()
                geocode_data = geocode_response.json()

                if geocode_data.get('status') == 'OK' and geocode_data.get('results'):
                    for component in geocode_data['results'][0].get('address_components', []):
                        if 'country' in component.get('types', []):
                            derived_full_country_name = component.get('long_name')
                            logging.info(f"Derived full country name for update: {derived_full_country_name} from input: {new_land_code}")
                            break
                    if not derived_full_country_name:
                         logging.warning(f"Could not find 'country' component in geocoding result for update: {new_land_code}")
                else:
                    logging.warning(f"Geocoding failed for country '{new_land_code}' during profile update. Status: {geocode_data.get('status')}")

            except requests.exceptions.RequestException as geo_err:
                logging.error(f"Error calling Geocoding API for country '{new_land_code}' during profile update: {geo_err}")
            except Exception as geo_proc_err:
                logging.error(f"Error processing Geocoding response for country '{new_land_code}' during profile update: {geo_proc_err}", exc_info=True)
        else:
             logging.error("GOOGLE_PLACES_API_KEY not set, cannot derive full country name during profile update.")

        # Add the derived name (or None) to the updates
        allowed_updates["full_land_name"] = derived_full_country_name
        # --- End derive and update full_land_name ---

        # Optionally update country_lang if land changes and utility exists
        try:
            allowed_updates["country_lang"] = get_country_language(new_land_code)
        except Exception as lang_err:
            logging.warning(f"Could not determine country language for {new_land_code}: {lang_err}")
            # Decide if you want to proceed without country_lang or handle differently

    new_language = data.get("language")
    if new_language is not None and isinstance(new_language, str):
        # Validate if it's a known/allowed language code if necessary
        allowed_updates["preferred_language"] = new_language.strip() # Store as preferred_language

    # Add other updatable fields here (ensure type checking and sanitization)

    if not allowed_updates:
        logging.warning(f"Profile update attempt for {target_user_id_str} with no valid/updatable fields.")
        return jsonify({"error": "No updatable fields provided or invalid data types"}), 400

    # 6. Perform Database Update
    try:
        update_result = db.users.update_one(
            {"_id": target_user_object_id},
            {"$set": allowed_updates}
        )

        if update_result.matched_count == 0:
            logging.warning(f"User not found during update attempt for ObjectId: {target_user_object_id} (String: '{target_user_id_str}')")
            # If updating own profile and not found, session might be invalid
            if not user_id:
                 session.pop("gebruiker", None)
                 logging.info(f"Cleared potentially invalid session during update for user ID string: {target_user_id_str}")
            return jsonify({"error": "User not found"}), 404

        # 7. Fetch Updated Data (Optional but good practice)
        updated_user_data = db.users.find_one({"_id": target_user_object_id})
        if not updated_user_data:
             # Should not happen if update succeeded, but handle defensively
             logging.error(f"User data disappeared after successful update for {target_user_id_str}")
             return jsonify({"error": "Internal server error after update."}), 500

        profile_data = {
            "_id": str(updated_user_data["_id"]),
            "naam": updated_user_data.get("naam"),
            "email": updated_user_data.get("email"),
            "land": updated_user_data.get("land"),
            "language": updated_user_data.get("preferred_language", updated_user_data.get("country_lang", updated_user_data.get("browser_lang", "en"))), # Return updated preference
        }

        # 8. Update Session Data if relevant fields changed
        session_updated = False
        if "naam" in allowed_updates and session.get('gebruiker', {}).get('naam') != allowed_updates["naam"]:
            session['gebruiker']['naam'] = allowed_updates["naam"]
            session_updated = True
        if "land" in allowed_updates and session.get('gebruiker', {}).get('land') != allowed_updates["land"]:
            session['gebruiker']['land'] = allowed_updates["land"]
            session_updated = True
        # Update session language if preferred_language was changed
        if "preferred_language" in allowed_updates and session.get('lang') != allowed_updates["preferred_language"]:
             session['lang'] = allowed_updates["preferred_language"]
             session_updated = True
             logging.info(f"User language preference updated in session to: {session['lang']}")

        if session_updated:
            session.modified = True # Mark session as modified only if changed
            logging.debug(f"Session 'gebruiker' or 'lang' updated for user {target_user_id_str}")

        logging.info(f"Profile updated successfully for user {target_user_id_str}")
        return jsonify({"message": "Profile updated successfully", "user": profile_data}), 200

    except Exception as e:
        logging.error(f"Error updating profile for user {target_user_id_str}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update profile due to server error"}), 500

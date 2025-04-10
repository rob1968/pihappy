from flask import Blueprint, render_template, request, session, redirect, url_for, flash, jsonify # Ensure jsonify is imported
import logging # Add logging import
from datetime import datetime
from zoneinfo import ZoneInfo
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from bson import ObjectId # Import ObjectId

from blueprints.utils.ai import analyseer_sentiment, genereer_ai_feedback

journal_bp = Blueprint("journal", __name__)

# Load DB
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]

# Removed laad_dagboek function as the collection is dropped

# Removed sla_feedback_op as we'll use upsert logic directly
# def sla_feedback_op(entry):
#     db.feedback.insert_one(entry)

from flask import jsonify # Add jsonify import at the top with other Flask imports

@journal_bp.route("/") # Keep the route path
def index():
    logger.debug("Request received for / (journal index)")
    try: # Main try block
        # --- Session checks ---
        if "gebruiker" not in session:
            logger.warning("Unauthorized access to / (journal index)")
            return jsonify({"error": "Niet geautoriseerd", "message": "Log in om toegang te krijgen."}), 401

        gebruiker = session.get("gebruiker") # Use .get for safety
        if not gebruiker:
             logger.error("Session exists but 'gebruiker' key is missing or None.")
             return jsonify({"error": "Invalid session", "message": "'gebruiker' data missing from session."}), 401

        gebruiker_id = gebruiker.get("id")
        if not gebruiker_id:
            logger.error("User ID missing from session.")
            return jsonify({"error": "Invalid session", "message": "User ID not found in session."}), 400
        logger.debug(f"Fetching data for user ID: {gebruiker_id}")

        # --- Initialize variables ---
        journal_entry = None
        raw_feedback_doc = None

        # --- Nested try for DB fetch --- (INDENTED)
        try:
            # Fetch the single journal entry for the user using _id
            logger.debug(f"Querying db.dagboek for _id: {gebruiker_id}")
            journal_entry = db.dagboek.find_one({"_id": gebruiker_id})
            logger.debug(f"db.dagboek result: {journal_entry}")

            # Fetch the single feedback entry for the user using _id
            logger.debug(f"Querying db.feedback for _id: {gebruiker_id}")
            raw_feedback_doc = db.feedback.find_one({"_id": gebruiker_id})
            logger.debug(f"db.feedback result: {raw_feedback_doc}")

        except Exception as db_err: # DB Fetch except (INDENTED)
            logger.error(f"Database error fetching journal/feedback for user {gebruiker_id}: {db_err}", exc_info=True)
            # Explicitly return JSON here
            return jsonify({"error": "Database error", "message": "Failed to retrieve user data."}), 500

        # --- Start Processing Block (runs if DB fetch succeeds, still inside main try) --- (INDENTED)
        eigen_entries = [journal_entry] if journal_entry else []
        stemming_toegestaan = True
        laatste_stemming = None # Initialize
        
        # Get the last mood if an entry exists, regardless of time
        if journal_entry:
            laatste_stemming = journal_entry.get("stemming") # Always get the mood if entry exists
            logger.debug(f"Found last mood from DB entry: {laatste_stemming}")

            # Now, separately check timing ONLY to determine if voting is allowed
            try:
                if "datum" in journal_entry and isinstance(journal_entry["datum"], str):
                    laatste_tijd = datetime.strptime(journal_entry["datum"], "%Y-%m-%d %H:%M:%S").replace(
                        tzinfo=ZoneInfo("Europe/Amsterdam"))
                    nu = datetime.now(ZoneInfo("Europe/Amsterdam"))
                    verschil = nu - laatste_tijd
                    if verschil.total_seconds() < 10 * 3600:
                        stemming_toegestaan = False # Only disable voting if recent
                    logger.debug(f"Time check for voting: stemming_toegestaan={stemming_toegestaan}")
                else:
                     logger.warning(f"Journal entry for {gebruiker_id} missing 'datum' field or it's not a string.")
            except Exception as time_err:
                logger.error(f"Time processing error for user {gebruiker_id}: {time_err}", exc_info=True)
                # Let the outer exception handler catch this now, or return specific error:
                # return jsonify({"error": "Data processing error", "message": "Failed to process entry timestamp."}), 500
                raise # Re-raise to be caught by the outer handler

        # Renamed raw_feedback_doc above, use it here
        raw_feedback = [raw_feedback_doc] if raw_feedback_doc else []

        # Convert ObjectId to string for JSON serialization in feedback
        feedback_serialized = []
        for doc in raw_feedback:
            if doc and '_id' in doc:
                 if isinstance(doc['_id'], ObjectId):
                     doc['_id'] = str(doc['_id'])
                 feedback_serialized.append(doc)
            else:
                 logger.warning(f"Skipping serialization for invalid feedback doc: {doc}")

        # Determine language preference for TTS
        browser_lang = gebruiker.get("browser_lang")
        country_lang = gebruiker.get("country_lang")
        logger.debug(f"[TTS Lang] Session browser_lang: {browser_lang}, country_lang: {country_lang}")
        # Prioritize browser_lang, then country_lang, default to 'en'
        user_lang_code = browser_lang or country_lang or "en"
        # Use only the primary language code (e.g., 'en' from 'en-US')
        simple_lang_code = user_lang_code[:2].lower()
        logger.debug(f"[TTS Lang] Determined simple_lang_code: {simple_lang_code}")

        # Prepare data for JSON response
        data_voor_frontend = {
            "naam": gebruiker.get("naam", "Gebruiker"),
            "user_language": simple_lang_code, # Add the simple language code
            "stemming_toegestaan": stemming_toegestaan,
            "laatste_stemming": laatste_stemming,
            "eigen_feedback": feedback_serialized, # Keep sending the full doc structure just in case
            "chat_geschiedenis": session.get("chat_geschiedenis", []),
            # Get latest feedback from the DB doc, not the session
            "laatste_ai_feedback": raw_feedback_doc.get("feedback") if raw_feedback_doc else None,
        }

        logger.debug(f"Returning JSON data for /: {data_voor_frontend}")
        return jsonify(data_voor_frontend)
        # --- End Processing Block ---

    except Exception as outer_err: # Main except (ALIGNED with main try)
         # Log the user ID if available, otherwise 'UNKNOWN'
         user_id_for_log = session.get('gebruiker', {}).get('id', 'UNKNOWN')
         logger.error(f"Unexpected error in / route for user {user_id_for_log}: {outer_err}", exc_info=True)
         # Ensure JSON is returned even for very early errors
         return jsonify({"error": "Server error", "message": "An unexpected error occurred handling the request."}), 500


# Logger instance (if needed elsewhere, otherwise remove import and this line)
logger = logging.getLogger(__name__)

@journal_bp.route("/nieuw", methods=["POST"])
def nieuw_dagboek():
    # logger.debug(f"Received request for /nieuw. Session keys: {list(session.keys())}") # Removed log
    if "gebruiker" not in session:
        # logger.warning("Unauthorized attempt to access /nieuw. No 'gebruiker' in session.") # Removed log
        # Return JSON error for API
        return jsonify({"status": "error", "message": "Niet geautoriseerd"}), 401

    gebruiker = session["gebruiker"]
    # logger.debug(f"User identified: {gebruiker.get('id')}, {gebruiker.get('naam')}") # Removed log
    gebruiker_id = gebruiker["id"] # Use the string ID directly

    # Check if an entry already exists for today
    # Use a more robust check considering timezones if necessary
    vandaag_start = datetime.now(ZoneInfo("Europe/Amsterdam")).replace(hour=0, minute=0, second=0, microsecond=0)
    vandaag_eind = vandaag_start.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Assuming 'datum' is stored as string, adjust query if it's datetime object
    # This regex might be inefficient on large collections. Consider storing date objects.
    vandaag_str = vandaag_start.strftime("%Y-%m-%d")
    # Remove daily check logic, upsert will handle existing/new document

    # Proceed with creating the new entry
    datum_str = datetime.now(ZoneInfo("Europe/Amsterdam")).strftime("%Y-%m-%d %H:%M:%S")
    # logger.debug(f"Proceeding to create new entry for user {gebruiker_id} with date {datum_str}") # Removed log
    stemming = request.form.get("stemming") # Get mood from form data
    # logger.debug(f"Received mood from form: {stemming}") # Removed log
    if not stemming:
        # logger.warning("No 'stemming' value found in form data.") # Removed log
        return jsonify({"status": "error", "message": "Stemming value missing in request."}), 400

    # Create the journal entry dictionary
    entry = {
        "datum": datum_str,
        "stemming": stemming,
        # Add other fields back with defaults, as AI functions might expect them
        "focus": request.form.get("focus", ""), # Use request.form.get or default ""
        "reflectie": request.form.get("reflectie", ""),
        "verbeterpunten": request.form.get("verbeterpunten", ""),
        "dankbaarheid": request.form.get("dankbaarheid", ""),
        # Note: gebruiker_id is correctly omitted as _id is used for upsert
    }

    # Perform AI analysis (assuming these functions are available and work)
    try:
        logger.debug(f"Attempting AI analysis for user {gebruiker_id}...") # Add user ID
        # Determine language for analysis (using the same logic as in ai.py)
        # Assuming 'gebruiker' dictionary is available here and contains language fields
        taal = gebruiker.get("browser_lang") or gebruiker.get("country_lang") or gebruiker.get("land", "en")
        taal = taal.lower() if taal else "en"

        sentiment, score = analyseer_sentiment(entry, taal) # Pass taal here
        # Note: genereer_ai_feedback already determines taal internally from gebruiker info
        ai_feedback = genereer_ai_feedback(entry, entry["stemming"], sentiment, gebruiker)
        logger.debug(f"AI analysis completed for user {gebruiker_id}")
    except Exception as e:
        logger.error(f"AI Analysis Error for user {gebruiker_id}: {e}", exc_info=True) # Use logger and add user ID
        # print(f"⛔ AI Analyse Fout: {e}") # Remove print
        # Decide how to handle AI errors - proceed without feedback or return error?
        ai_feedback = "Kon geen AI feedback genereren op dit moment."
        sentiment = "Onbekend"
        score = 0.0

    try: # Add try block around DB operations
        # Upsert the journal entry using user's ID string as _id
        update_data = {"$set": entry} # entry dict no longer contains gebruiker_id
        logger.debug(f"Upserting journal entry with _id {gebruiker_id}") # Use logger
        db.dagboek.update_one(
            {"_id": gebruiker_id}, # Match document by user ID
            update_data,
            upsert=True # Create if doesn't exist, update if it does
        )
        logger.debug(f"Journal entry upsert completed for {gebruiker_id}") # Confirmation log

        # Save the feedback entry
        feedback_entry = {
            "datum": datum_str,
            "stemming": entry["stemming"],
            "feedback": ai_feedback
        }
        # Upsert the feedback entry using user's ID string as _id
        feedback_update_data = {"$set": feedback_entry} # feedback_entry dict no longer contains gebruiker_id
        logger.debug(f"Upserting feedback entry with _id {gebruiker_id}") # Use logger
        db.feedback.update_one(
             {"_id": gebruiker_id}, # Match document by user ID
             feedback_update_data,
             upsert=True # Create if doesn't exist, update if it does
        )
        logger.debug(f"Feedback entry upsert completed for {gebruiker_id}") # Confirmation log

    except Exception as db_err: # Catch DB specific errors
        logger.error(f"Database error during upsert for user {gebruiker_id}: {db_err}", exc_info=True)
        return jsonify({"status": "error", "message": "Database error saving entry."}), 500

    try: # Add try block around session updates
        # Update session data
        session["laatste_ai_feedback"] = ai_feedback
        session["chat_geschiedenis"] = [] # Reset chat history on new entry? Review this logic.
        session.modified = True # Ensure session changes are saved
        logger.debug(f"Session updated for user {gebruiker_id}") # Confirmation log
    except Exception as session_err: # Catch session specific errors
        logger.error(f"Session error during update for user {gebruiker_id}: {session_err}", exc_info=True)
        # Decide if this is fatal. Maybe proceed but log warning? For now, return 500.
        return jsonify({"status": "error", "message": "Session update error after saving entry."}), 500

    # Prepare the entry data for JSON response (ensure no ObjectIds)
    # The 'entry' dict created locally shouldn't have an _id yet, but good practice if fetching later
    # Prepare the entry data for JSON response
    # Prepare the entry data for JSON response (it doesn't have _id before insertion)
    # Prepare the entry data for JSON response
    # Add the user's ID back for the frontend if needed, as it's not in the entry dict anymore
    entry_serialized = entry.copy()
    entry_serialized['_id'] = gebruiker_id # Add string ID back for frontend consistency

    # Prepare JSON success response
    response_data = jsonify({
        "status": "success",
        "message": "Dagboek entry succesvol opgeslagen.",
        "entry": entry_serialized, # Return the serialized entry
        "ai_feedback": ai_feedback,
        "sentiment": sentiment,
        "sentiment_score": score
    })

    # logger.info(f"Successfully created new journal entry for user {gebruiker_id}.") # Removed log
    # Return the response with 201 status code
    return response_data, 201

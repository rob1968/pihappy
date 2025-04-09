from flask import Blueprint, request, session, jsonify
import logging # Add logging
from datetime import datetime
import openai
from blueprints.utils.geo import vind_winkel_in_buurt
from blueprints.utils.locale import get_country_language # Import the function
from pymongo import MongoClient
from dotenv import load_dotenv
import os

chat_bp = Blueprint("chat", __name__)
logger = logging.getLogger(__name__) # Add logger instance

# Setup DB
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]

# 🧠 MongoDB replacements
def laad_chatgeschiedenis(gebruiker_id):
    doc = db.chats.find_one({"_id": gebruiker_id})
    return doc["gesprekken"] if doc and "gesprekken" in doc else []

def sla_chatgeschiedenis_op(gebruiker_id, geschiedenis):
    db.chats.update_one(
        {"_id": gebruiker_id},
        {"$set": {"gesprekken": geschiedenis}},
        upsert=True
    )

@chat_bp.route("/chat", methods=["POST"])
def chat():
    if "gebruiker" not in session:
        return jsonify({"antwoord": "⚠️ Je moet ingelogd zijn om te chatten."})

    gebruiker = session["gebruiker"]
    gebruiker_id = gebruiker["id"]
    vraag = request.json.get("vraag", "").strip()

    if not vraag:
        return jsonify({"antwoord": "⚠️ Please enter a valid question!"}) # Changed to English for consistency

    # Check input length
    if len(vraag) > 250:
        return jsonify({"antwoord": "⚠️ Your message is too long (max 250 characters)."}), 400 # Added length check

    if not isinstance(session.get("chat_geschiedenis"), list):
        session["chat_geschiedenis"] = []
    if "chat_teller" not in session:
        session["chat_teller"] = 0

    # 🛒 Winkelvraag
    if "winkel" in vraag and "buurt" in vraag:
        if "locatie" in gebruiker and gebruiker["locatie"]:
            locatie = gebruiker["locatie"]
            antwoord = vind_winkel_in_buurt(locatie)
        else:
            session["wacht_op_locatie"] = True
            return jsonify({"antwoord": "📍 Wat is je locatie? Dan zoek ik een winkel in de buurt."})

        return jsonify({"antwoord": antwoord})

    if session.get("wacht_op_locatie"):
        session["gebruiker"]["locatie"] = vraag
        session.pop("wacht_op_locatie")
        return jsonify({"antwoord": vind_winkel_in_buurt(vraag)})

    user_tijd = datetime.utcnow().isoformat() + "Z" # Generate timestamp for user message
    user_message_data = {
        "role": "user",
        "content": vraag,
        "tijd": user_tijd # Use the generated timestamp
    }
    session["chat_geschiedenis"].append(user_message_data)
    session["chat_teller"] += 1

    # Determine language for AI response
    taal_code = get_country_language(gebruiker.get("land", "other")) # Use the function, default country 'other' maps to 'en'
    logger.debug(f"Chat: Determined language code (taal_code): {taal_code}") # Log taal code
    # Map language code to full name for the prompt
    language_map = {
        "nl": "Dutch",
        "en": "English",
        "de": "German",
        "fr": "French",
        "es": "Spanish",
        "zh": "Chinese",
        "hi": "Hindi",
        "id": "Indonesian",
        "ur": "Urdu",
        "pt": "Portuguese",
        "bn": "Bengali",
        "ru": "Russian",
        "ja": "Japanese",
        "tl": "Tagalog",
        "vi": "Vietnamese",
        "am": "Amharic",
        "ar": "Arabic",
        "fa": "Persian",
        "tr": "Turkish",
        "ko": "Korean",
        "th": "Thai",
        # Add other languages based on locale.py as needed
    }
    target_language = language_map.get(taal_code, "English") # Default to English if map missing
    logger.debug(f"Chat: Target language for response: {target_language}") # Log target language

    # Construct system prompt with language instruction
    # Using a more direct instruction might be better
    system_prompt = f"You are a helpful coach and motivator. Respond ONLY in {target_language}."
    logger.debug(f"Chat: System prompt: {system_prompt}") # Log system prompt

    # Prepare messages for OpenAI, adding language instruction to the latest user message
    messages_for_api = list(session["chat_geschiedenis"]) # Create a mutable copy
    # Removed block that appended language instruction to the user message content
    # The system prompt already handles language instruction.

    logger.debug("Chat: Sending request to OpenAI...")
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "system", "content": system_prompt}] + messages_for_api # Send modified history
        )
        antwoord = response["choices"][0]["message"]["content"]
    except Exception as e:
        return jsonify({"antwoord": f"⚠️ AI-fout: {str(e)}"})

    assistant_tijd = datetime.utcnow().isoformat() + "Z" # Generate timestamp ONCE
    assistant_message_data = {
        "role": "assistant",
        "content": antwoord,
        "tijd": assistant_tijd # Use the generated timestamp
    }
    session["chat_geschiedenis"].append(assistant_message_data)

    # 💡 Donatie prompt
    extra_bericht = ""
    if session["chat_teller"] % 4 == 0:
        # Use the determined language code, not the country code directly
        taal = get_country_language(gebruiker.get("land", "other"))
        berichten = {
            "nl": "💡 Zin in een kopje ☕? Doneer 1 Pi als je wilt 😉",
            "en": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "de": "💡 Ich könnte etwas trinken gebrauchen! Spende 1 Pi? 😉",
            "fr": "💡 Je prendrais bien un verre ! Donnez 1 Pi ? 😉",
            "es": "💡 ¡Me vendría bien una bebida! ¿Quieres donar 1 Pi? 😉",
            "zh": "💡 我想喝点东西！想捐赠 1 Pi 吗？ 😉",
            # Add placeholders for other languages, defaulting to English
            "hi": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "id": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "ur": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "pt": "💡 Eu poderia usar uma bebida! Quer doar 1 Pi? 😉",
            "bn": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "ru": "💡 Мне бы не помешало выпить! Хотите пожертвовать 1 Pi? 😉",
            "ja": "💡 飲み物が欲しいです！ 1 Pi 寄付しませんか？ 😉",
            "tl": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "vi": "💡 Tôi muốn uống gì đó! Bạn muốn quyên góp 1 Pi không? 😉",
            "am": "💡 I could use a drink! Want to donate 1 Pi? 😉",
            "ar": "💡 أرغب في تناول مشروب! هل تريد التبرع بـ 1 Pi؟ 😉",
            "fa": "💡 من یه نوشیدنی می‌خوام! می‌خوای 1 Pi اهدا کنی؟ 😉",
            "tr": "💡 Bir içki içebilirim! 1 Pi bağışlamak ister misin? 😉",
            "ko": "💡 마실 것이 필요해요! 1 Pi 기부하시겠어요? 😉",
            "th": "💡 อยากดื่มอะไรสักหน่อย! ต้องการบริจาค 1 Pi ไหม? 😉",
        }
        # Default to English message if language not found
        extra_bericht = berichten.get(taal, berichten["en"])

    # 🧠 Save chat
    sla_chatgeschiedenis_op(gebruiker_id, session["chat_geschiedenis"])
    session.modified = True

    return jsonify({
        "antwoord": antwoord,
        "extra": extra_bericht,
        "chat_geschiedenis": session["chat_geschiedenis"],
        "assistant_message": assistant_message_data, # Return the full assistant message object
        "user_message": user_message_data # ALSO return the user message object with the correct 'tijd'
    })

@chat_bp.route("/chat/verwijder/<bericht_id>", methods=["DELETE"])
def verwijder_bericht(bericht_id):
    if "gebruiker" not in session:
        return jsonify({"status": "error", "message": "Niet ingelogd"}), 403

    gebruiker_id = session["gebruiker"]["id"]
    geschiedenis = laad_chatgeschiedenis(gebruiker_id)
    logger.debug(f"Attempting to delete message with ID (from URL): '{bericht_id}'") # Log received ID

    # Log the comparison process
    nieuwe_geschiedenis = []
    found = False
    for b in geschiedenis:
        stored_tijd = b.get("tijd")
        logger.debug(f"Comparing URL ID '{bericht_id}' with stored tijd '{stored_tijd}'")
        if stored_tijd == bericht_id:
            logger.debug(f"Match found! Skipping message with tijd '{stored_tijd}'")
            found = True
        else:
            nieuwe_geschiedenis.append(b)

    # Check if a message was actually removed (using the 'found' flag)
    # if len(nieuwe_geschiedenis) == len(geschiedenis): # Old check
    if not found: # New check based on explicit comparison
        # Indent the following block correctly
        return jsonify({"status": "error", "message": "Bericht niet gevonden"}), 404

    sla_chatgeschiedenis_op(gebruiker_id, nieuwe_geschiedenis)
    session["chat_geschiedenis"] = nieuwe_geschiedenis
    return jsonify({"status": "success"})

@chat_bp.route("/chat/verwijder_alle", methods=["DELETE"])
def verwijder_alle_berichten():
    if "gebruiker" not in session:
        return jsonify({"status": "error", "message": "Niet ingelogd"}), 403

    gebruiker_id = session["gebruiker"]["id"]
    sla_chatgeschiedenis_op(gebruiker_id, [])
    session["chat_geschiedenis"] = []
    return jsonify({"status": "success"})

@chat_bp.route("/chat_geschiedenis", methods=["GET"])
def chat_geschiedenis():
    if "gebruiker" not in session:
        return jsonify({"geschiedenis": [], "teller": 0})

    gebruiker_id = session["gebruiker"]["id"]
    geschiedenis = laad_chatgeschiedenis(gebruiker_id)
    return jsonify({"geschiedenis": geschiedenis, "teller": len(geschiedenis) // 2})

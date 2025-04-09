import os
import requests
from flask import Blueprint, request, jsonify, Response, stream_with_context
import logging
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

tts_bp = Blueprint("tts", __name__, url_prefix="/api/tts")
logger = logging.getLogger(__name__)

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
# Consider making Voice ID configurable or passed from frontend if needed
ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" # Example Voice ID

@tts_bp.route("/synthesize", methods=["POST"])
def synthesize_speech():
    if not ELEVENLABS_API_KEY:
        logger.error("ElevenLabs API key not configured in environment variables.")
        return jsonify({"error": "TTS service not configured"}), 503 # Service Unavailable

    data = request.get_json()
    text_to_speak = data.get("text")
    language_code = data.get("language_code", "en") # Get language, default to 'en' if not provided

    if not text_to_speak:
        return jsonify({"error": "No text provided"}), 400

    api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}/stream"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    payload = {
        "text": text_to_speak,
        "model_id": "eleven_multilingual_v2", # Use multilingual model
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        logger.debug(f"Proxying TTS request for lang '{language_code}', text: '{text_to_speak[:50]}...'") # Log language
        # Use stream=True to handle the response as a stream
        response = requests.post(api_url, json=payload, headers=headers, stream=True)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        # Stream the audio content back to the client
        # Use stream_with_context for proper handling in Flask
        return Response(stream_with_context(response.iter_content(chunk_size=1024)),
                        content_type=response.headers['Content-Type'])

    except requests.exceptions.RequestException as e:
        logger.error(f"Error calling ElevenLabs API: {e}")
        # Try to get more specific error from ElevenLabs if possible (might be in response body for non-200)
        error_detail = "Failed to connect to TTS service."
        if e.response is not None:
            try:
                 error_detail = e.response.json().get('detail', {}).get('message', e.response.text)
            except: # Handle cases where response is not JSON
                 error_detail = e.response.text[:200] # Limit error length
        return jsonify({"error": "TTS service error", "detail": error_detail}), 502 # Bad Gateway
    except Exception as e:
        logger.error(f"Unexpected error in TTS proxy: {e}", exc_info=True)
        return jsonify({"error": "Internal server error during TTS"}), 500
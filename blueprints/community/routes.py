from flask import Blueprint, current_app as app, request, session, jsonify
import logging # Add logging
import os
import re
# import requests # Already imported below if needed
import openai
import requests
from datetime import datetime, timedelta # Import timedelta
from collections import Counter
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId  # Import to handle ObjectId serialization
from blueprints.utils.locale import get_country_language # Import the function

# Removed redundant imports and ensured proper error handling

community_bp = Blueprint("community", __name__)
logger = logging.getLogger(__name__) # Add logger instance
# Ensure logging is configured (ideally in app.py)
# logging.basicConfig(level=logging.DEBUG)

# 🌐 Mongo Setup
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]
users_collection = db["users"] # Access users collection
community_input_collection = db["community_input"]
community_analysis_collection = db["community_analysis"] # Collection for storing results

# 🛠️ Mongo replacements
def laad_community_input():
    try:
        # Convert ObjectId to string for JSON serialization
        return [
            {**doc, "_id": str(doc["_id"])} for doc in community_input_collection.find()
        ]
    except Exception as e:
        app.logger.error(f"Error loading community input: {e}")
        return []

# def sla_community_input_op(data): # This function seems unused, commenting out
#     community_input_collection.delete_many({})
#     community_input_collection.insert_many(data)


@community_bp.route('/landen', methods=['GET'])
def haal_landen_op():
    try:
        landen_cursor = db.countries.find({}, {"_id": 0})  # Gebruik collectie 'countries'
        landen_lijst = [
            {
                "naam": land["name"],
                "code": land["code"],
                "vlag": land.get("flag", ""),
                "taal": land.get("language", "Unknown")
            }
            for land in landen_cursor
        ]
        landen_lijst.sort(key=lambda x: x["naam"])  # Sorteer op naam
        return jsonify({"landen": landen_lijst})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@community_bp.route("/community_input", methods=["GET"])
def get_community_input():
    geschiedenis = laad_community_input()
    return jsonify({"status": "success", "data": geschiedenis})

@community_bp.route("/community_input/send", methods=["POST"])
def send_community_input():
    logger.debug("Received request for /community_input/send")
    if "gebruiker" not in session:
        logger.warning("Unauthorized attempt to send community input. No 'gebruiker' in session.")
        return jsonify({"status": "error", "message": "Authentication required."}), 401

    logger.debug(f"Request JSON data: {request.json}")
    input_text = request.json.get("input", "").strip()
    gebruiker_info = session.get("gebruiker", {})
    gebruiker_naam = gebruiker_info.get("naam", "Unknown User") # Safely get name
    user_id = gebruiker_info.get("id") # Get user ID
    if not user_id:
        logger.error("User ID missing from session during community input send.")
        return jsonify({"status": "error", "message": "User session error."}), 500
    logger.debug(f"Input text: '{input_text}', User name: '{gebruiker_naam}'")

    if not input_text:
        logger.warning("Received empty input text.")
        return jsonify({"status": "error", "message": "Your input is empty."}) # Changed to English

    # Check input length
    if len(input_text) > 250:
        logger.warning(f"Received input exceeding 250 characters from user {gebruiker_naam} (ID: {user_id}).")
        return jsonify({"status": "error", "message": "Your input is too long (max 250 characters)."}), 400

    # --- Cooldown Check ---
    try:
        user_object_id = ObjectId(user_id)
        user_doc = users_collection.find_one({"_id": user_object_id})
        if user_doc and "last_community_input_time" in user_doc:
            last_post_time = user_doc["last_community_input_time"]
            # Ensure last_post_time is offset-aware for comparison if needed, or use naive consistently
            # Assuming stored time is naive UTC from datetime.utcnow()
            time_since_last_post = datetime.utcnow() - last_post_time
            if time_since_last_post < timedelta(hours=1):
                wait_time = timedelta(hours=1) - time_since_last_post
                minutes_left = int(wait_time.total_seconds() // 60) + 1 # Round up minutes
                logger.warning(f"User {user_id} tried to post community input too soon. Wait time: {minutes_left} minutes.")
                return jsonify({
                    "status": "error",
                    "message": f"You can post again in {minutes_left} minute(s)."
                }), 429 # Too Many Requests
    except Exception as e:
        logger.error(f"Error checking cooldown for user {user_id}: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Error checking post cooldown."}), 500
    # --- End Cooldown Check ---

    nieuwe_input = {
        "gebruiker": gebruiker_naam,
        "userId": user_object_id,
        "country": gebruiker_info.get("land", "Unknown"), # Store user's country
        "input": input_text,
        "tijd": datetime.utcnow()
    }

    logger.debug(f"Attempting to insert into community_input_collection: {nieuwe_input}")
    try:
        result = community_input_collection.insert_one(nieuwe_input)
        if result.inserted_id:
            logger.info(f"Successfully inserted community input with ID: {result.inserted_id}")

            # Podcast generation logic moved to /analyse route

            # --- Update User's Last Post Time ---
            try:
                users_collection.update_one(
                    {"_id": user_object_id},
                    {"$set": {"last_community_input_time": nieuwe_input["tijd"]}}
                )
                logger.info(f"Updated last_community_input_time for user {user_id}.")
            except Exception as update_err:
                # Log the error but don't fail the request, as the input was saved
                logger.error(f"Failed to update last_community_input_time for user {user_id}: {update_err}", exc_info=True)
            # --- End Update User Time ---

            # --- Trigger Analysis Check ---
            try:
                input_count = community_input_collection.count_documents({})
                logger.info(f"Total community inputs after insert: {input_count}")
                if input_count > 0 and input_count % 2 == 0:
                    logger.info(f"Input count ({input_count}) is even, triggering analysis.")
                    # In a production app, this should be asynchronous (e.g., Celery task)
                    # For simplicity here, we call it synchronously.
                    perform_community_analysis(session.get("gebruiker", {}).get("land", "other"))
            except Exception as analysis_trigger_err:
                 logger.error(f"Error during analysis trigger check: {analysis_trigger_err}", exc_info=True)
            # --- End Trigger Analysis Check ---

            return jsonify({"status": "success", "message": "Input submitted!"})
        else:
            logger.error("community_input_collection.insert_one completed but inserted_id is missing.")
            return jsonify({"status": "error", "message": "Database error on save (no ID)."}), 500
    except Exception as e:
        logger.error(f"Error inserting community input into MongoDB: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Database error on save."}), 500

# --- Helper Function for Analysis ---
def perform_community_analysis(user_country_code="other"):
    """Fetches inputs, analyzes them via OpenAI, generates podcast, and stores the result."""
    logger.info("Starting perform_community_analysis...")
    taal_code = get_country_language(user_country_code)
    logger.debug(f"Analysis Language Code: {taal_code}")

    # Language-specific prompts (copied from original /analyse route)
    ANALYSIS_SYSTEM_MSG = { "en": "You are an AI that analyzes and summarizes community feedback.", "nl": "Jij bent een AI die community feedback analyseert en samenvat.", "es": "Eres una IA que analiza y resume los comentarios de la comunidad.", "de": "Du bist eine KI, die Community-Feedback analysiert und zusammenfasst.", "fr": "Tu es une IA qui analyse et résume les retours de la communauté.", "zh": "你是一个分析和总结社区反馈的人工智能。", "hi": "आप एक AI हैं जो सामुदायिक प्रतिक्रिया का विश्लेषण और सारांश करता है।","id": "Anda adalah AI yang menganalisis dan merangkum umpan balik komunitas.","ur": "آپ ایک AI ہیں جو کمیونٹی کے تاثرات کا تجزیہ اور خلاصہ کرتا ہے۔","pt": "Você é uma IA que analisa e resume o feedback da comunidade.","bn": "আপনি একজন AI যিনি সম্প্রদায়ের প্রতিক্রিয়া বিশ্লেষণ এবং সংক্ষিপ্তসার করেন।","ru": "Вы — ИИ, который анализирует и обобщает отзывы сообщества.","ja": "あなたはコミュニティのフィードバックを分析し要約するAIです。","tl": "Ikaw ay isang AI na nagsusuri at nagbubuod ng feedback ng komunidad.","vi": "Bạn là một AI phân tích và tóm tắt phản hồi của cộng đồng.","am": "እርስዎ የማህበረሰብ ግብረመልስን የሚተነትኑ እና የሚያጠቃልሉ AI ነዎት።","ar": "أنت ذكاء اصطناعي يحلل ويلخص ملاحظات المجتمع.","fa": "شما یک هوش مصنوعی هستید که بازخورد جامعه را تجزیه و تحلیل و خلاصه می کند.","tr": "Topluluk geri bildirimlerini analiz eden ve özetleyen bir yapay zekasınız.","ko": "커뮤니티 피드백을 분석하고 요약하는 AI입니다.","th": "คุณคือ AI ที่วิเคราะห์และสรุปความคิดเห็นของชุมชน",}
    ANALYSIS_USER_PROMPT = { "en": "Analyze the following input provided by the community and provide a summary of the main themes and opinions. Respond in English.", "nl": "Analyseer deze input van de community en geef een samenvatting van de belangrijkste thema's en meningen. Antwoord in het Nederlands.", "es": "Analiza los siguientes comentarios proporcionados por la comunidad y proporciona un resumen de los temas y opiniones principales. Responde en español.", "de": "Analysiere die folgenden Eingaben der Community und erstelle eine Zusammenfassung der Hauptthemen und Meinungen. Antworte auf Deutsch.", "fr": "Analysez les commentaires suivants fournis par la communauté et fournissez un résumé des principaux thèmes et opinions. Répondez en français.", "zh": "分析社区提供的以下反馈，并提供主要主题和意见的摘要。请用中文回答。", "hi": "समुदाय द्वारा प्रदान किए गए निम्नलिखित इनपुट का विश्लेषण करें और मुख्य विषयों और विचारों का सारांश प्रदान करें। हिंदी में उत्तर दें।","id": "Analisis masukan berikut yang diberikan oleh komunitas dan berikan ringkasan tema dan opini utama. Tanggapi dalam Bahasa Indonesia.","ur": "کمیونٹی کی طرف سے فراہم کردہ درج ذیل ان پٹ کا تجزیہ کریں اور اہم موضوعات اور آراء کا خلاصہ فراہم کریں۔ اردو میں جواب دیں۔","pt": "Analise a entrada a seguir fornecida pela comunidade e forneça um resumo dos principais temas e opiniões. Responda em português.","bn": "সম্প্রদায় দ্বারা প্রদত্ত নিম্নলিখিত ইনপুট বিশ্লেষণ করুন এবং প্রধান থিম এবং মতামতের একটি সারসংক্ষেপ প্রদান করুন। বাংলায় উত্তর দিন।","ru": "Проанализируйте следующие данные, предоставленные сообществом, и предоставьте краткое изложение основных тем и мнений. Ответьте на русском языке.","ja": "コミュニティから提供された以下の入力を分析し、主要なテーマと意見の要約を提供してください。日本語で応答してください。","tl": "Suriin ang sumusunod na input na ibinigay ng komunidad at magbigay ng buod ng mga pangunahing tema at opinyon. Tumugon sa Tagalog.","vi": "Phân tích đầu vào sau đây do cộng đồng cung cấp và cung cấp bản tóm tắt các chủ đề và ý kiến chính. Trả lời bằng tiếng Việt.","am": "በማህበረሰቡ የቀረበውን የሚከተለውን ግብአት ይተንትኑ እና የዋና ዋና ጭብጦችን እና አስተያየቶችን ማጠቃለያ ያቅርቡ። በአማርኛ ምላሽ ይስጡ።","ar": "حلل المدخلات التالية المقدمة من المجتمع وقدم ملخصًا للمواضيع والآراء الرئيسية. أجب باللغة العربية.","fa": "ورودی زیر ارائه شده توسط جامعه را تجزیه و تحلیل کنید و خلاصه ای از موضوعات و نظرات اصلی ارائه دهید. به فارسی پاسخ دهید.","tr": "Topluluk tarafından sağlanan aşağıdaki girdiyi analiz edin ve ana temaların ve görüşlerin bir özetini sunun. Türkçe cevap verin.","ko": "커뮤니티에서 제공한 다음 입력을 분석하고 주요 주제 및 의견에 대한 요약을 제공하십시오. 한국어로 응답하십시오.","th": "วิเคราะห์ข้อมูลต่อไปนี้ที่ชุมชนให้มาและสรุปประเด็นหลักและความคิดเห็น ตอบเป็นภาษาไทย",}

    system_message = ANALYSIS_SYSTEM_MSG.get(taal_code, ANALYSIS_SYSTEM_MSG["en"])
    user_prompt_instruction = ANALYSIS_USER_PROMPT.get(taal_code, ANALYSIS_USER_PROMPT["en"])

    geschiedenis = laad_community_input() # Assuming this loads from community_input_collection
    if not geschiedenis:
        logger.warning("perform_community_analysis: No input found to analyze.")
        return # Nothing to do

    gecombineerde_input = " ".join([entry["input"] for entry in geschiedenis])
    prompt = f"""
{user_prompt_instruction}

Community Input Data:
---
{gecombineerde_input}
---

Final Instruction: Ensure the entire summary response is ONLY in the requested language ({user_prompt_instruction.split()[-1].replace('.', '')}).
"""
    logger.debug(f"perform_community_analysis: Sending prompt to OpenAI:\nSystem: {system_message}\nUser: {prompt}")

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ]
        )
        ai_feedback = response["choices"][0]["message"]["content"]
        logger.info("perform_community_analysis: OpenAI analysis successful.")

        # --- Store Analysis Result ---
        analysis_result = {
            "ai_feedback": ai_feedback,
            "analysis_timestamp": datetime.utcnow(),
            "language_code": taal_code,
            "input_count_at_analysis": len(geschiedenis) # Store how many inputs were analyzed
        }
        # Update a single document (e.g., with a fixed ID) or insert new ones.
        # Using update_one with upsert=True is simple for storing only the latest.
        community_analysis_collection.update_one(
            {"_id": "latest_analysis"}, # Fixed ID for the latest analysis document
            {"$set": analysis_result},
            upsert=True
        )
        logger.info("perform_community_analysis: Stored analysis result in DB.")
        # --- End Store Analysis Result ---


        # --- Trigger Podcast Generation ---
        logger.info("Triggering podcast generation with analysis text.")
        try:
            podcast_generated = generate_podcast_audio(ai_feedback)
            if not podcast_generated:
                 logger.warning("Podcast generation function returned False.")
        except Exception as podcast_err:
            logger.error(f"Error calling generate_podcast_audio: {podcast_err}", exc_info=True)
        # --- End Podcast Trigger ---

    except openai.error.OpenAIError as e:
        logger.error(f"Error during OpenAI call in perform_community_analysis: {e}", exc_info=True)
    except Exception as e:
         logger.error(f"Unexpected error in perform_community_analysis: {e}", exc_info=True)

# --- End Helper Function ---

# --- ElevenLabs TTS Function ---
ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM" # Same voice as frontend
PODCAST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'podcasts') # Assumes static folder exists at root level alongside blueprints

def generate_podcast_audio(text_to_speak):
    """Generates audio using ElevenLabs API and saves it."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        logger.error("ElevenLabs API key not found in environment variables.")
        return False

    tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    data = {
        "text": text_to_speak,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        response = requests.post(tts_url, json=data, headers=headers, timeout=60) # Added timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        # Ensure the podcast directory exists
        os.makedirs(PODCAST_DIR, exist_ok=True)

        # Create a unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"podcast_{timestamp}.mp3"
        filepath = os.path.join(PODCAST_DIR, filename)

        # Save the audio content
        with open(filepath, 'wb') as f:
            f.write(response.content)
        logger.info(f"Successfully generated and saved podcast: {filepath}")
        return True

    except requests.exceptions.RequestException as e:
        logger.error(f"Error calling ElevenLabs API: {e}", exc_info=True)
        # Log response body if available for more details on API errors
        if hasattr(e, 'response') and e.response is not None:
             logger.error(f"ElevenLabs API Response: {e.response.text}")
        return False
    except IOError as e:
        logger.error(f"Error saving podcast audio file: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"An unexpected error occurred during podcast generation: {e}", exc_info=True)
        return False
# --- End ElevenLabs TTS Function ---

@community_bp.route("/community_input/analyse", methods=["GET"])
def analyseer_community_input():
    """Fetches the latest stored community analysis result."""
    logger.debug("Received request for /community_input/analyse (fetching latest stored result)")
    try:
        latest_analysis = community_analysis_collection.find_one({"_id": "latest_analysis"})
        if latest_analysis and "ai_feedback" in latest_analysis:
            logger.info("Found latest analysis result.")
            return jsonify({
                "status": "success",
                "ai_feedback": latest_analysis["ai_feedback"],
                "analysis_timestamp": latest_analysis.get("analysis_timestamp") # Optionally return timestamp
            })
        else:
            logger.warning("No stored analysis result found.")
            # Return a specific message indicating no analysis is available yet
            # Use user's language for the message if possible
            taal_code = get_country_language(session.get("gebruiker", {}).get("land", "other"))
            no_analysis_msg = {
                "en": "No community analysis has been generated yet. Submit more input!",
                "nl": "Er is nog geen community-analyse gegenereerd. Stuur meer input in!",
                # Add other languages as needed
            }
            message = no_analysis_msg.get(taal_code, no_analysis_msg["en"])
            return jsonify({"status": "success", "ai_feedback": message}) # Return success but with info message

    except Exception as e:
        logger.error(f"Error fetching latest community analysis: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Error retrieving analysis result."}), 500

@community_bp.route("/community_input/statistieken", methods=["GET"])
def community_statistieken():
    geschiedenis = laad_community_input()
    if not geschiedenis:
        return jsonify({"status": "error", "message": "Geen input beschikbaar voor statistieken."})

    alle_woorden = []
    bijdragers = Counter()

    for entry in geschiedenis:
        woorden = re.findall(r'\b\w+\b', entry["input"].lower())
        alle_woorden.extend(woorden)
        bijdragers[entry["gebruiker"]] += 1

    veelgebruikte_woorden = Counter(alle_woorden)
    populaire_themas = [woord for woord, count in veelgebruikte_woorden.most_common(5) if len(woord) > 3]
    top_bijdragers = [{"naam": naam, "aantal": aantal} for naam, aantal in bijdragers.most_common(5)]

    return jsonify({
        "status": "success",
        "populaire_themas": populaire_themas,
        "top_bijdragers": top_bijdragers
    })

@community_bp.route("/community_input/stats_by_country", methods=["GET"])
def community_stats_by_country():
    """Calculates and returns the count of community inputs per country using aggregation."""
    logger.debug("Received request for /community_input/stats_by_country")
    try:
        # Use aggregation pipeline to group by country and count
        pipeline = [
            # Removed $match stage to include documents without a country field
            {
                "$group": {
                    "_id": "$country",  # Group by the country field
                    "count": { "$sum": 1 } # Count documents in each group
                }
            },
            {
                "$project": {
                    "_id": 0, # Exclude the default _id field from output
                    "country": "$_id", # Rename _id (which is the country) to 'country'
                    "count": 1 # Include the count
                }
            },
            {
                 "$sort": { "count": -1 } # Optional: Sort by count descending
            }
        ]

        results = list(community_input_collection.aggregate(pipeline))

        # Convert list of {country: 'XX', count: N} to the desired { 'XX': N } format
        result_dict = {item['country']: item['count'] for item in results}

        logger.debug(f"Calculated country counts: {result_dict}")

        return jsonify({"status": "success", "country_counts": result_dict})

    except Exception as e:
        logger.error(f"Error calculating community stats by country: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Failed to calculate country statistics."}), 500

from flask import Blueprint, current_app as app, request, session, jsonify
import logging # Add logging
import os
import re
# import requests # Already imported below if needed
import openai
import requests # Ensure requests is imported
from datetime import datetime
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

# 🛠️ Mongo replacements
def laad_community_input():
    try:
        # Convert ObjectId to string for JSON serialization
        return [
            {**doc, "_id": str(doc["_id"])} for doc in db.community_input.find()
        ]
    except Exception as e:
        app.logger.error(f"Error loading community input: {e}")
        return []

def sla_community_input_op(data):
    db.community_input.delete_many({})  # optional: wipe then insert all
    db.community_input.insert_many(data)


@community_bp.route('/api/landen', methods=['GET'])
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
        return jsonify({"status": "error", "message": "Je moet ingelogd zijn om input te geven."})

    logger.debug(f"Request JSON data: {request.json}")
    input_text = request.json.get("input", "").strip()
    gebruiker_info = session.get("gebruiker", {})
    gebruiker_naam = gebruiker_info.get("naam", "Onbekende Gebruiker") # Safely get name
    logger.debug(f"Input text: '{input_text}', User name: '{gebruiker_naam}'")

    if not input_text:
        logger.warning("Received empty input text.")
        return jsonify({"status": "error", "message": "Your input is empty."}) # Changed to English

    # Check input length
    if len(input_text) > 250:
        logger.warning(f"Received input exceeding 250 characters from user {gebruiker_naam}.")
        return jsonify({"status": "error", "message": "Your input is too long (max 250 characters)."}), 400 # Added length check

    nieuwe_input = {
        "gebruiker": gebruiker_naam, # Use safely retrieved name
        "input": input_text,
        "tijd": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    logger.debug(f"Attempting to insert into db.community_input: {nieuwe_input}")
    try:
        result = db.community_input.insert_one(nieuwe_input)
        if result.inserted_id:
            logger.info(f"Successfully inserted community input with ID: {result.inserted_id}")

            # Podcast generation logic moved to /analyse route

            return jsonify({"status": "success", "message": "Input verzonden!"})
        else:
            logger.error("db.community_input.insert_one completed but inserted_id is missing.")
            return jsonify({"status": "error", "message": "Database error bij opslaan (geen ID)."}), 500
    except Exception as e:
        logger.error(f"Error inserting community input into MongoDB: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Database error bij opslaan."}), 500

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
    # Determine user language (defaulting to English if not logged in or no lang set)
    taal_code = get_country_language(session.get("gebruiker", {}).get("land", "other")) # Use the function
    logger.debug(f"Community Analysis: Determined language code: {taal_code}")

    # Language-specific instructions/prompts
    ANALYSIS_SYSTEM_MSG = {
        "en": "You are an AI that analyzes and summarizes community feedback.",
        "nl": "Jij bent een AI die community feedback analyseert en samenvat.",
        "es": "Eres una IA que analiza y resume los comentarios de la comunidad.",
        "de": "Du bist eine KI, die Community-Feedback analysiert und zusammenfasst.",
        "fr": "Tu es une IA qui analyse et résume les retours de la communauté.",
        "zh": "你是一个分析和总结社区反馈的人工智能。",
        "hi": "आप एक AI हैं जो सामुदायिक प्रतिक्रिया का विश्लेषण और सारांश करता है।", # Hindi
        "id": "Anda adalah AI yang menganalisis dan merangkum umpan balik komunitas.", # Indonesian
        "ur": "آپ ایک AI ہیں جو کمیونٹی کے تاثرات کا تجزیہ اور خلاصہ کرتا ہے۔", # Urdu
        "pt": "Você é uma IA que analisa e resume o feedback da comunidade.", # Portuguese
        "bn": "আপনি একজন AI যিনি সম্প্রদায়ের প্রতিক্রিয়া বিশ্লেষণ এবং সংক্ষিপ্তসার করেন।", # Bengali
        "ru": "Вы — ИИ, который анализирует и обобщает отзывы сообщества.", # Russian
        "ja": "あなたはコミュニティのフィードバックを分析し要約するAIです。", # Japanese
        "tl": "Ikaw ay isang AI na nagsusuri at nagbubuod ng feedback ng komunidad.", # Tagalog
        "vi": "Bạn là một AI phân tích và tóm tắt phản hồi của cộng đồng.", # Vietnamese
        "am": "እርስዎ የማህበረሰብ ግብረመልስን የሚተነትኑ እና የሚያጠቃልሉ AI ነዎት።", # Amharic
        "ar": "أنت ذكاء اصطناعي يحلل ويلخص ملاحظات المجتمع.", # Arabic
        "fa": "شما یک هوش مصنوعی هستید که بازخورد جامعه را تجزیه و تحلیل و خلاصه می کند.", # Persian
        "tr": "Topluluk geri bildirimlerini analiz eden ve özetleyen bir yapay zekasınız.", # Turkish
        "ko": "커뮤니티 피드백을 분석하고 요약하는 AI입니다.", # Korean
        "th": "คุณคือ AI ที่วิเคราะห์และสรุปความคิดเห็นของชุมชน", # Thai
        # Add other languages as needed
    }
    ANALYSIS_USER_PROMPT = {
         "en": "Analyze the following input provided by the community and provide a summary of the main themes and opinions. Respond in English.",
         "nl": "Analyseer deze input van de community en geef een samenvatting van de belangrijkste thema's en meningen. Antwoord in het Nederlands.",
         "es": "Analiza los siguientes comentarios proporcionados por la comunidad y proporciona un resumen de los temas y opiniones principales. Responde en español.",
         "de": "Analysiere die folgenden Eingaben der Community und erstelle eine Zusammenfassung der Hauptthemen und Meinungen. Antworte auf Deutsch.",
         "fr": "Analysez les commentaires suivants fournis par la communauté et fournissez un résumé des principaux thèmes et opinions. Répondez en français.",
         "zh": "分析社区提供的以下反馈，并提供主要主题和意见的摘要。请用中文回答。",
         "hi": "समुदाय द्वारा प्रदान किए गए निम्नलिखित इनपुट का विश्लेषण करें और मुख्य विषयों और विचारों का सारांश प्रदान करें। हिंदी में उत्तर दें।", # Hindi
         "id": "Analisis masukan berikut yang diberikan oleh komunitas dan berikan ringkasan tema dan opini utama. Tanggapi dalam Bahasa Indonesia.", # Indonesian
         "ur": "کمیونٹی کی طرف سے فراہم کردہ درج ذیل ان پٹ کا تجزیہ کریں اور اہم موضوعات اور آراء کا خلاصہ فراہم کریں۔ اردو میں جواب دیں۔", # Urdu
         "pt": "Analise a entrada a seguir fornecida pela comunidade e forneça um resumo dos principais temas e opiniões. Responda em português.", # Portuguese
         "bn": "সম্প্রদায় দ্বারা প্রদত্ত নিম্নলিখিত ইনপুট বিশ্লেষণ করুন এবং প্রধান থিম এবং মতামতের একটি সারসংক্ষেপ প্রদান করুন। বাংলায় উত্তর দিন।", # Bengali
         "ru": "Проанализируйте следующие данные, предоставленные сообществом, и предоставьте краткое изложение основных тем и мнений. Ответьте на русском языке.", # Russian
         "ja": "コミュニティから提供された以下の入力を分析し、主要なテーマと意見の要約を提供してください。日本語で応答してください。", # Japanese
         "tl": "Suriin ang sumusunod na input na ibinigay ng komunidad at magbigay ng buod ng mga pangunahing tema at opinyon. Tumugon sa Tagalog.", # Tagalog
         "vi": "Phân tích đầu vào sau đây do cộng đồng cung cấp và cung cấp bản tóm tắt các chủ đề và ý kiến chính. Trả lời bằng tiếng Việt.", # Vietnamese
         "am": "በማህበረሰቡ የቀረበውን የሚከተለውን ግብአት ይተንትኑ እና የዋና ዋና ጭብጦችን እና አስተያየቶችን ማጠቃለያ ያቅርቡ። በአማርኛ ምላሽ ይስጡ።", # Amharic
         "ar": "حلل المدخلات التالية المقدمة من المجتمع وقدم ملخصًا للمواضيع والآراء الرئيسية. أجب باللغة العربية.", # Arabic
         "fa": "ورودی زیر ارائه شده توسط جامعه را تجزیه و تحلیل کنید و خلاصه ای از موضوعات و نظرات اصلی ارائه دهید. به فارسی پاسخ دهید.", # Persian
         "tr": "Topluluk tarafından sağlanan aşağıdaki girdiyi analiz edin ve ana temaların ve görüşlerin bir özetini sunun. Türkçe cevap verin.", # Turkish
         "ko": "커뮤니티에서 제공한 다음 입력을 분석하고 주요 주제 및 의견에 대한 요약을 제공하십시오. 한국어로 응답하십시오.", # Korean
         "th": "วิเคราะห์ข้อมูลต่อไปนี้ที่ชุมชนให้มาและสรุปประเด็นหลักและความคิดเห็น ตอบเป็นภาษาไทย", # Thai
         # Add other languages as needed
    }

    system_message = ANALYSIS_SYSTEM_MSG.get(taal_code, ANALYSIS_SYSTEM_MSG["en"])
    user_prompt_instruction = ANALYSIS_USER_PROMPT.get(taal_code, ANALYSIS_USER_PROMPT["en"])
    logger.debug(f"Community Analysis: System Msg: {system_message}, User Instruction: {user_prompt_instruction}")
    geschiedenis = laad_community_input()
    if not geschiedenis:
        return jsonify({"status": "error", "message": "Geen input om te analyseren."})

    # Combine the actual input data
    gecombineerde_input = " ".join([entry["input"] for entry in geschiedenis])

    # Construct the final prompt
    # Add a more explicit final instruction to the prompt
    prompt = f"""
{user_prompt_instruction}

Community Input Data:
---
{gecombineerde_input}
---

Final Instruction: Ensure the entire summary response is ONLY in the requested language ({user_prompt_instruction.split()[-1].replace('.', '')}).
"""
    logger.debug(f"Community Analysis: Sending prompt to OpenAI:\nSystem: {system_message}\nUser: {prompt}")

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_message}, # Use language-specific system message
                {"role": "user", "content": prompt}
            ]
        )
        ai_feedback = response["choices"][0]["message"]["content"]

        # --- Trigger Podcast Generation with AI Feedback ---
        logger.info("AI analysis successful. Triggering podcast generation with analysis text.")
        try:
            podcast_generated = generate_podcast_audio(ai_feedback)
            if not podcast_generated:
                 logger.warning("Podcast generation function returned False.")
                 # Optionally add a message to the response indicating podcast failure?
        except Exception as podcast_err:
            logger.error(f"Error calling generate_podcast_audio from analyse route: {podcast_err}", exc_info=True)
        # --- End Podcast Trigger ---

    except openai.error.OpenAIError as e:
        logger.error(f"Error during OpenAI call for community analysis: {e}", exc_info=True) # Added logging
        return jsonify({"status": "error", "message": f"Fout bij AI-analyse: {str(e)}"})

    return jsonify({"status": "success", "ai_feedback": ai_feedback})

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

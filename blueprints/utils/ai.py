# Content for blueprints/utils/ai.py

import os
import openai
import logging
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk import download
from dotenv import load_dotenv
from flask import session # Added import for session used in bepaal_taal

# Ensure VADER is downloaded
try:
    download("vader_lexicon")
except Exception as nltk_err:
    # Use logger instead of print
    logging.error(f"NLTK download error for vader_lexicon: {nltk_err}", exc_info=True)

# Initialize sia within a try-except block
try:
    sia = SentimentIntensityAnalyzer()
except Exception as sia_init_err:
    logging.error(f"Failed to initialize SentimentIntensityAnalyzer: {sia_init_err}", exc_info=True)
    sia = None # Set sia to None if initialization fails

load_dotenv()
# Load and check OpenAI API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logging.critical("OPENAI_API_KEY environment variable not set. AI features will likely fail.")
else:
    openai.api_key = OPENAI_API_KEY
    logging.info("OpenAI API key loaded.")

# Get logger instance for this module
logger = logging.getLogger(__name__) # Moved logger definition up
# --- User Provided Code START ---

def bepaal_taal():
    """Geeft de taal terug op basis van land-instelling in de sessie."""
    # Note: This function uses 'session' directly, which might not be ideal
    # if called from contexts where the request session isn't available.
    # The genereer_ai_feedback function below uses gebruiker_info passed as argument.
    if "gebruiker" in session and "land" in session["gebruiker"]:
        return session["gebruiker"]["land"]
    return "nl"  # Standaard Nederlands

# Functie om sentiment te analyseren (language-aware)
def analyseer_sentiment(entry, taal="en"): # Add taal parameter, default to 'en'
    """
    Analyzes sentiment using VADER (English only).
    Returns 'Neutraal' for non-English languages.
    """
    # Only perform VADER analysis if the language is English
    # Check if sia was initialized successfully
    if not sia:
        logger.warning("SentimentIntensityAnalyzer (sia) not initialized. Returning neutral sentiment.")
        return "Neutraal (SIA Init Failed) 😐", 0.0

    if taal != "en":
        # Log why VADER isn't being used
        logger.debug(f"Skipping VADER sentiment analysis for non-English language: {taal}")
        return "Neutraal (Non-English) 😐", 0.0 # Return neutral for non-English

    tekst = f"{entry.get('stemming', '')} {entry.get('reflectie', '')} {entry.get('verbeterpunten', '')} {entry.get('dankbaarheid', '')}"
    score = sia.polarity_scores(tekst)

    if score["compound"] >= 0.05:
        return "Positief 😊", score["compound"]
    elif score["compound"] <= -0.05:
        return "Negatief 😔", score["compound"]
    else:
        return "Neutraal 😐", score["compound"]


# logger = logging.getLogger(__name__) # Logger defined earlier

def genereer_ai_feedback(entry, stemming, sentiment, gebruiker_info):
    logger.debug(f"Received gebruiker_info: {gebruiker_info}") # Log the received user info
    # Prioritize browser_lang, then country_lang, then land, default to 'en'
    taal = gebruiker_info.get("browser_lang") or gebruiker_info.get("country_lang") or gebruiker_info.get("land", "en")
    # Ensure taal is lowercase if it came from 'land' which might not be standardized
    taal = taal.lower() if taal else "en"
    logger.debug(f"Determined language code (taal): {taal}") # Log taal code

    prompts = {
        "cn": "用中文写作。",
        "in": "हिंदी में लिखें।",
        "us": "Write in English.",
        "id": "Menulis dalam bahasa Indonesia.",
        "pk": "اردو میں لکھیں۔",
        "br": "Escreva em português.",
        "ng": "Write in English.",
        "bd": "বাংলায় লিখুন।",
        "ru": "Напишите на русском.",
        "mx": "Escribe en español.",
        "jp": "日本語で書いてください。",
        "ph": "Sumulat sa Filipino.",
        "vn": "Viết bằng tiếng Việt.",
        "et": "የአማርኛ ቋንቋ ይጻፉ።",
        "eg": "اكتب باللغة العربية.",
        "de": "Schreiben Sie auf Deutsch.",
        "ir": "به فارسی بنویسید.",
        "tr": "Türkçe yazın.",
        "cd": "Écrivez en français.",
        "fr": "Écrivez en français.",
        "nl": "Schrijf in het Nederlands.",
        "es": "Escribe en español.",
        "pt": "Escreva em português.",
        "ar": "اكتب باللغة العربية.",
        # "zh": "用中文写作。", # Removed duplicate
        # "ja": "日本語で書いてください。", # Removed duplicate
        "ko": "한국어로 작성하세요.",
        # "hi": "हिंदी में लिखें。", # Removed duplicate
        "th": "เขียนเป็นภาษาไทย",
        "it": "Scrivi in italiano.",          # Italian
        "sv": "Skriv på svenska.",          # Swedish
        "pl": "Napisz po polsku.",          # Polish
        "el": "Γράψτε στα ελληνικά.",       # Greek
        "he": "כתוב בעברית.",             # Hebrew
        "uk": "Напишіть українською.",     # Ukrainian
        "cs": "Napište česky.",            # Czech
        "ro": "Scrieți în română.",         # Romanian
        "hu": "Írj magyarul.",            # Hungarian
        "fi": "Kirjoita suomeksi.",         # Finnish
        "da": "Skriv på dansk.",           # Danish
        "no": "Skriv på norsk.",           # Norwegian
        "sk": "Napíšte po slovensky.",     # Slovak
        "bg": "Пишете на български.",      # Bulgarian
        "hr": "Napišite na hrvatskom.",    # Croatian
        "sr": "Пишите на српском.",       # Serbian
        "sl": "Napišite v slovenščini.",   # Slovenian
        "lt": "Rašykite lietuviškai.",    # Lithuanian
        "lv": "Rakstiet latviski.",       # Latvian
        "et": "Kirjutage eesti keeles.",     # Estonian (Corrected from Amharic mapping)
        "ms": "Tulis dalam Bahasa Melayu.", # Malay
        "sw": "Andika kwa Kiswahili.",     # Swahili
        "af": "Skryf in Afrikaans.",       # Afrikaans
        "is": "Skrifaðu á íslensku.",      # Icelandic
        "ga": "Scríobh i nGaeilge.",       # Irish
        "cy": "Ysgrifennwch yn Gymraeg.",  # Welsh
        "eu": "Idatzi euskaraz.",         # Basque
        "ca": "Escriu en català.",         # Catalan
        "gl": "Escribe en galego.",        # Galician
        "sq": "Shkruani në shqip.",        # Albanian
        "mk": "Пишувајте на македонски.", # Macedonian
        "hy": "Գրեք հայերեն.",           # Armenian
        "ka": "დაწერეთ ქართულად.",        # Georgian
        "bn": "বাংলায় লিখুন।",          # Bengali (Corrected from bd mapping)
        "gu": "ગુજરાતીમાં લખો.",         # Gujarati
        "kn": "ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ.",      # Kannada
        "ml": "മലയാളത്തിൽ എഴുതുക.",     # Malayalam
        "mr": "मराठीत लिहा.",            # Marathi
        "ne": "नेपालीमा लेख्नुहोस्।",     # Nepali
        "pa": "ਪੰਜਾਬੀ ਵਿੱਚ ਲਿਖੋ।",        # Punjabi (Gurmukhi)
        "si": "සිංහලෙන් ලියන්න.",        # Sinhala
        "ta": "தமிழில் எழுதுங்கள்.",      # Tamil
        "te": "తెలుగులో రాయండి.",       # Telugu
        "ur": "اردو میں لکھیں۔",          # Urdu (Corrected from pk mapping)
        "vi": "Viết bằng tiếng Việt.",    # Vietnamese (Corrected from vn mapping)
        "zh": "用中文写作。",              # Chinese (Corrected from cn mapping)
        "zu": "Bhala ngesiZulu.",         # Zulu
        "xh": "Bhala ngesiXhosa.",        # Xhosa
        "en": "Write in English."         # English (Default/Generic)
}

    # Get the language instruction first
    lang_instruction = prompts.get(taal, prompts["en"]) # Get instruction
    logger.debug(f"Selected language instruction: {lang_instruction}") # Log instruction

    # Now construct the prompt using the instruction
    prompt = f"""
    {lang_instruction}

    - 📅 Datum: {entry["datum"]}
    - Stemming: {stemming}
    - Focus van de dag: {entry["focus"]}
    - Wat ging goed: {entry["reflectie"]}
    - Wat kon beter: {entry["verbeterpunten"]}
    - Waar ben ik dankbaar voor: {entry["dankbaarheid"]}

    📌 AI Aanbevelingen:
    Mijn naam is {gebruiker_info.get("naam", "Onbekend")}.
    - Leeftijd: {gebruiker_info.get("leeftijd", "Niet opgegeven")}
    - Geslacht: {gebruiker_info.get("geslacht", "Niet opgegeven")}
    - Hobby's: {gebruiker_info.get("hobbies", "Niet opgegeven")}

    Op basis van mijn stemming ({stemming}):
    - Tips om mijn dag te verbeteren
    - Een motiverende quote
    - Suggesties voor zelfontwikkeling of activiteiten op basis van mijn hobby's

    🔍 **Extra info**: Sentimentanalyse score: {sentiment}
    """

    # System messages defining the AI's role in different languages
    # (Re-adding this logic)
    SYSTEM_MESSAGES = {
        "en": "You are a helpful coach and motivator.",
        "nl": "Jij bent een behulpzame coach en motivator.",
        "es": "Eres un coach y motivador útil.",
        "de": "Du bist ein hilfreicher Coach und Motivator.",
        "fr": "Tu es un coach et un motivateur utile.",
        "cn": "你是一位乐于助人的教练和激励者。",
        "in": "आप एक सहायक कोच और प्रेरक हैं।",
        "id": "Anda adalah pelatih dan motivator yang membantu.",
        "pk": "آپ ایک مددگار کوچ اور محرک ہیں۔",
        "br": "Você é um coach e motivador útil.",
        "ng": "You are a helpful coach and motivator.", # Assuming English for Nigeria
        "bd": "আপনি একজন সহায়ক কোচ এবং প্রেরণাদাতা।",
        "ru": "Вы — полезный тренер и мотиватор.",
        "mx": "Eres un coach y motivador útil.", # Same as es
        "jp": "あなたは役に立つコーチであり、モチベーターです。",
        "ph": "Ikaw ay isang matulungin na coach at motivator.",
        "vn": "Bạn là một huấn luyện viên và người động viên hữu ích.",
        "et": "እርስዎ አጋዥ አሰልጣኝ እና አነቃቂ ነዎት።",
        "eg": "أنت مدرب ومحفز مفيد.",
        "ir": "شما یک مربی و انگیزه دهنده مفید هستید.",
        "tr": "Yardımcı bir koç ve motivatörsünüz.",
        "cd": "Tu es un coach et un motivateur utile.", # Same as fr
        "pt": "Você é um coach e motivador útil.", # Same as br
        "ar": "أنت مدرب ومحفز مفيد.", # Same as eg
        "zh": "你是一位乐于助人的教练和激励者。", # Same as cn
        "ja": "あなたは役に立つコーチであり、モチベーターです。", # Same as jp
        "ko": "당신은 도움이 되는 코치이자 동기 부여가입니다.",
        "hi": "आप एक सहायक कोच और प्रेरक हैं।", # Same as in
        "th": "คุณเป็นโค้ชและผู้สร้างแรงบันดาลใจที่เป็นประโยชน์",
        # Add other languages as needed
    }
    # Get language-specific system message, defaulting to English
    system_message = SYSTEM_MESSAGES.get(taal, SYSTEM_MESSAGES["en"])
    logger.debug(f"Selected system message: {system_message}") # Log system message

    logger.debug(f"Sending prompt to OpenAI:\nSystem: {system_message}\nUser: {prompt}") # Log full prompt details
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message}, # Use language-specific system message
                {"role": "user", "content": prompt}
            ]
        )
        ai_feedback = response["choices"][0]["message"]["content"]
        return ai_feedback
    except openai.error.OpenAIError as e:
        # Use logger instead of print
        logger.error(f"OpenAI API Error in genereer_ai_feedback: {e}", exc_info=True)
        return f"⚠️ AI-feedback kon niet worden opgehaald: {str(e)}"
    except Exception as e:
        # Use logger instead of print
        logger.error(f"Unexpected Error in genereer_ai_feedback: {e}", exc_info=True)
        return f"⚠️ AI-feedback kon niet worden opgehaald wegens een onverwachte fout."

# --- User Provided Code END ---

from flask import session

# Mapping from country code (lowercase) to primary language code
COUNTRY_TO_LANG = {
    "nl": "nl",  # Netherlands -> Dutch
    "be": "nl",  # Belgium -> Dutch (also fr, de) - choosing nl for simplicity
    "us": "en",  # United States -> English
    "gb": "en",  # United Kingdom -> English
    "ca": "en",  # Canada -> English (also fr)
    "au": "en",  # Australia -> English
    "de": "de",  # Germany -> German
    "fr": "fr",  # France -> French
    "es": "es",  # Spain -> Spanish
    "mx": "es",  # Mexico -> Spanish
    "cn": "zh",  # China -> Chinese (Mandarin)
    "in": "hi",  # India -> Hindi (many others exist)
    "id": "id",  # Indonesia -> Indonesian
    "pk": "ur",  # Pakistan -> Urdu (also en)
    "br": "pt",  # Brazil -> Portuguese
    "pt": "pt",  # Portugal -> Portuguese
    "ng": "en",  # Nigeria -> English (official, many others)
    "bd": "bn",  # Bangladesh -> Bengali
    "ru": "ru",  # Russia -> Russian
    "jp": "ja",  # Japan -> Japanese
    "ph": "tl",  # Philippines -> Tagalog (also en)
    "vn": "vi",  # Vietnam -> Vietnamese
    "et": "am",  # Ethiopia -> Amharic
    "eg": "ar",  # Egypt -> Arabic
    "ir": "fa",  # Iran -> Persian (Farsi)
    "tr": "tr",  # Turkey -> Turkish
    "cd": "fr",  # DR Congo -> French (official)
    "ar": "es",  # Argentina -> Spanish
    "kr": "ko",  # South Korea -> Korean
    "za": "en",  # South Africa -> English (one of many official)
    "th": "th",  # Thailand -> Thai
    # Add more mappings as needed
    "other": "en", # Default for 'other' selection
}

def get_locale():
    """Haal de huidige taal uit de sessie, standaard naar 'en'."""
    return session.get("lang", "en")

def get_country_language(country_code):
    """Get the primary language for a given country code, defaulting to 'en'."""
    return COUNTRY_TO_LANG.get(country_code.lower(), "en")

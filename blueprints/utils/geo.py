import os
import requests
from datetime import datetime
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from dotenv import load_dotenv
from pymongo import MongoClient
from flask import Blueprint, request, jsonify
import time



# 🔧 Load config
load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# 📡 Setup MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]


geo_bp = Blueprint('geo', __name__)

# 🧠 Caching IP-gegevens in RAM
ip_cache = {}
CACHE_TTL = 3600  # seconden (1 uur geldig)

@geo_bp.route('/api/ip-land', methods=['GET'])
def get_country_from_ip():
    try:
        ip = request.remote_addr

        # ✅ Return mock result voor localhost
        if ip in ["127.0.0.1:5000", "::1"]:
            return jsonify({'code': 'local'})

        # 📦 Check cache
        if ip in ip_cache:
            cached_data, timestamp = ip_cache[ip]
            if time.time() - timestamp < CACHE_TTL:
                return jsonify({'code': cached_data})

        # 🌍 Live call naar IPAPI
        response = requests.get(f'https://ipapi.co/{ip}/json/')
        data = response.json()
        code = data.get('country_code', '').lower()

        # 🧠 Save to cache
        ip_cache[ip] = (code, time.time())

        return jsonify({'code': code})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def google_geocode(locatie):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": locatie,
        "key": GOOGLE_MAPS_API_KEY
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        if data["status"] == "OK":
            resultaat = data["results"][0]
            return {
                "latitude": resultaat["geometry"]["location"]["lat"],
                "longitude": resultaat["geometry"]["location"]["lng"],
                "adres": resultaat["formatted_address"]
            }
        return None
    except requests.RequestException as e:
        return {"fout": f"Fout bij Google Geocoding API: {str(e)}"}

def haal_google_winkelgegevens_op(winkelnaam, locatie):
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    params = {
        "input": f"{winkelnaam}, {locatie}",
        "inputtype": "textquery",
        "fields": "formatted_address,geometry,place_id,rating,opening_hours",
        "key": GOOGLE_MAPS_API_KEY,
    }

    response = requests.get(url, params=params)
    data = response.json()

    if data.get("status") == "OK":
        plaats_info = data["candidates"][0]
        return {
            "adres": plaats_info.get("formatted_address", "Onbekend"),
            "latitude": plaats_info["geometry"]["location"]["lat"],
            "longitude": plaats_info["geometry"]["location"]["lng"],
            "beoordeling": plaats_info.get("rating", "Geen beoordeling"),
            "openingstijden": plaats_info.get("opening_hours", {}).get("weekday_text", [])
        }
    return None

def save_store_if_applicable(gebruiker_id, winkelnaam, locatie):
    if not winkelnaam or not locatie:
        return

    google_data = haal_google_winkelgegevens_op(winkelnaam, locatie)

    winkel_doc = {
        "_id": gebruiker_id,
        "id": gebruiker_id,
        "winkelnaam": winkelnaam,
        "locatie": locatie,
        "google_data": google_data or {},
        "toegevoegd_op": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    db.winkels.replace_one({"_id": gebruiker_id}, winkel_doc, upsert=True)

def vind_winkel_in_buurt(gebruiker_locatie):
    gebruiker_coord = google_geocode(gebruiker_locatie)
    if not gebruiker_coord:
        return "⚠️ Kon je locatie niet vinden."

    gebruiker_latlon = (gebruiker_coord["latitude"], gebruiker_coord["longitude"])
    winkels = list(db.winkels.find())

    dichtstbijzijnde_winkel = None
    kleinste_afstand = float("inf")

    for winkel in winkels:
        winkel_coord = google_geocode(winkel["locatie"])
        if not winkel_coord:
            continue

        afstand = geodesic(gebruiker_latlon, (winkel_coord["latitude"], winkel_coord["longitude"])).km
        if afstand < 10 and afstand < kleinste_afstand:
            kleinste_afstand = afstand
            dichtstbijzijnde_winkel = winkel

    if dichtstbijzijnde_winkel:
        return f"🏪 {dichtstbijzijnde_winkel['winkelnaam']} 📍 {dichtstbijzijnde_winkel['locatie']} ({kleinste_afstand:.2f} km van jou)"

    return f"🚫 Geen winkels gevonden binnen 10 km van {gebruiker_locatie}. Wil je een nieuwe winkel toevoegen op deze locatie?"

from flask import Blueprint, jsonify, render_template, request, session
from blueprints.utils.geo import vind_winkel_in_buurt
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

winkels_bp = Blueprint("winkels", __name__)

# 📡 Mongo
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

@winkels_bp.route("/api/winkels")
def api_winkels():
    winkels = list(db.winkels.find({}, {"_id": 0}))  # hide Mongo _id
    return jsonify(winkels)

# Removed the /winkels route that rendered the HTML template
# @winkels_bp.route("/winkels")
# def winkels_map():
#     return render_template("winkels.html", google_maps_api_key=GOOGLE_MAPS_API_KEY)

@winkels_bp.route("/zoek_winkel", methods=["POST"])
def zoek_winkel():
    if "gebruiker" not in session:
        return jsonify({"antwoord": "⚠️ Log eerst in om deze functie te gebruiken."})

    locatie = request.json.get("locatie", "").strip()
    if not locatie:
        return jsonify({"antwoord": "⚠️ Geef een locatie op!"})

    antwoord = vind_winkel_in_buurt(locatie)
    return jsonify({"antwoord": antwoord})

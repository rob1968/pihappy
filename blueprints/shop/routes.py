from flask import request, jsonify, Blueprint
# Import necessary Flask components
from flask import request, jsonify, Blueprint, current_app
# Delay importing db to avoid circular import
# from app import db
import logging


# Define the Blueprint
shop_bp = Blueprint('shop', __name__, url_prefix='/api') # Moved url_prefix here

# Configure logging
# Logging setup might be better placed in the main app factory
logging.basicConfig(level=logging.DEBUG)


@shop_bp.route("/shops", methods=["POST"])
def add_shop():
    # Import db here, inside the function
    from app import db
    logging.debug("Received request at /shops endpoint")
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Automatisch hoogste ID bepalen
    last_shop = db.shops.find_one(sort=[("id", -1)])
    new_id = (last_shop["id"] + 1) if last_shop else 1

    shop = {
        "id": new_id,
        "name": data.get("name"),
        "category": data.get("category"),
        "location": data.get("location"),
        "type": data.get("type")
    }

    db.shops.insert_one(shop)
    logging.debug(f"New shop created: {shop}")
    return jsonify(shop), 201  # ✅ Stuurt het ingevoerde shopobject terug

# Example route (ensure at least one route exists)
@shop_bp.route('/shop')
def shop_home():
    return "Welcome to the Shop!"

# Removed the standalone app run block, as this is a blueprint

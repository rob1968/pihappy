from flask import request, jsonify, Blueprint, current_app
# Delay importing db to avoid circular import
# from app import db
import logging
from bson import ObjectId # Import ObjectId to handle MongoDB IDs
# Define the Blueprint
shop_bp = Blueprint('shop', __name__, url_prefix='/api') # Moved url_prefix here

# Configure logging
# Logging setup might be better placed in the main app factory
logging.basicConfig(level=logging.DEBUG)

# Helper function to convert MongoDB shop documents to a frontend-friendly format
def format_shop_for_frontend(doc):
    # Convert ObjectId to string
    doc['_id'] = str(doc.get('_id'))

    # Rename fields and ensure correct types
    formatted_doc = {
        '_id': doc['_id'],
        'name': doc.get('Name'), # Use 'Name' from DB
        'category': doc.get('Category'), # Assuming 'Category' might exist
        'location': doc.get('Location'), # Use 'Location' from DB
        'type': doc.get('Type'), # Use 'Type' from DB
        'detail_url': doc.get('Detail URL'),
        'image_url': doc.get('Image URL'),
        'latitude': None, # Default to None
        'longitude': None # Default to None
    }

    # Safely convert Latitude and Longitude strings to float
    try:
        lat_str = doc.get('Latitude')
        if lat_str is not None:
            formatted_doc['latitude'] = float(lat_str)
    except (ValueError, TypeError):
        logging.warning(f"Could not convert Latitude '{lat_str}' to float for shop ID {doc['_id']}")

    try:
        lon_str = doc.get('Longitude')
        if lon_str is not None:
            formatted_doc['longitude'] = float(lon_str)
    except (ValueError, TypeError):
        logging.warning(f"Could not convert Longitude '{lon_str}' to float for shop ID {doc['_id']}")

    # Add category if it wasn't found under 'Category' but exists under 'category' (lowercase)
    if formatted_doc['category'] is None:
        formatted_doc['category'] = doc.get('category')

    return formatted_doc


@shop_bp.route("/shops", methods=["GET"])
def get_shops():
    # Import db here, inside the function
    from app import db
    try:
        logging.debug("Received GET request at /shops endpoint")
        # Fetch all documents from the shops collection
        all_shops = list(db.shops.find({}))
        formatted_shops = []
        processed_count = 0
        error_count = 0
        for shop in all_shops:
            try:
                formatted_shop = format_shop_for_frontend(shop)
                # Additionally check if coordinates are valid numbers after formatting
                if formatted_shop.get('latitude') is not None and formatted_shop.get('longitude') is not None:
                    formatted_shops.append(formatted_shop)
                    processed_count += 1
                else:
                    # Log if coordinates were invalid/missing even after formatting attempt
                    logging.warning(f"Skipping shop ID {shop.get('_id', 'N/A')} due to invalid/missing coordinates after formatting.")
                    error_count += 1
            except Exception as doc_error:
                # Log the error and the ID of the document that caused it
                shop_id = shop.get('_id', 'N/A') # Get ID if available
                logging.error(f"Error processing shop document ID {shop_id}: {doc_error}", exc_info=False) # exc_info=False to avoid overly long logs per document
                error_count += 1
                # Continue to the next document instead of crashing

        logging.debug(f"Successfully processed {processed_count} shops. Skipped {error_count} due to errors or missing coordinates.")
        return jsonify(formatted_shops), 200
    except Exception as e:
        logging.error(f"Error fetching shops: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch shops"}), 500

@shop_bp.route("/shops", methods=["POST"])
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

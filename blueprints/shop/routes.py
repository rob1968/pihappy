from flask import request, jsonify, Blueprint, current_app, session # Add session here
from datetime import datetime # Import datetime
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
        'name': doc.get('name', doc.get('Name')), # Prioritize lowercase 'name'
        'category': doc.get('Category'), # Assuming 'Category' might exist
        'location': doc.get('location', doc.get('Location')), # Prioritize lowercase 'location'
        'type': doc.get('Type'), # Use 'Type' from DB
        'detail_url': doc.get('Detail URL'),
        'image_url': doc.get('Image URL'),
        'latitude': None, # Default to None
        'longitude': None # Default to None
    }

    # Safely convert latitude/Latitude to float, prioritizing lowercase
    lat_val = doc.get('latitude', doc.get('Latitude')) # Check lowercase first
    try:
        if lat_val is not None:
            formatted_doc['latitude'] = float(lat_val)
    except (ValueError, TypeError):
        logging.warning(f"Could not convert latitude '{lat_val}' to float for shop ID {doc['_id']}")

    # Safely convert longitude/Longitude to float, prioritizing lowercase
    lon_val = doc.get('longitude', doc.get('Longitude')) # Check lowercase first
    try:
        if lon_val is not None:
            formatted_doc['longitude'] = float(lon_val)
    except (ValueError, TypeError):
        logging.warning(f"Could not convert longitude '{lon_val}' to float for shop ID {doc['_id']}")

    # Ensure category uses lowercase 'category' primarily
    formatted_doc['category'] = doc.get('category', doc.get('Category')) # Prioritize lowercase 'category'

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
# Corrected import location
def add_shop():
    # Import db here, inside the function
    from app import db
    logging.debug("Received POST request at /shops endpoint")

    # Check if user is logged in
    if 'gebruiker' not in session or 'id' not in session['gebruiker']:
        logging.warning("Attempt to add shop while not logged in.")
        return jsonify({"error": "Authentication required"}), 401

    user_id = session['gebruiker']['id']
    logging.debug(f"Shop add request by user ID: {user_id}")

    # Removed duplicate user check block
    data = request.json
    if not data:
        logging.warning("POST /shops request received no JSON data.")
        return jsonify({"error": "No data provided"}), 400

    # Construct the shop document directly from request data
    # Let MongoDB handle the _id generation
    shop_to_insert = {
        # Use lowercase keys consistent with frontend form and GET response formatting
        "name": data.get("name"),
        "category": data.get("category"),
        "location": data.get("location"),
        "latitude": data.get("latitude"),   # Get latitude from request
        "longitude": data.get("longitude"), # Get longitude from request
        "type": data.get("type"),
        "timestamp": datetime.utcnow(), # Add current UTC timestamp
        "userId": ObjectId(user_id) # Store the owner's ID as ObjectId
    }

    # Validate required fields, including coordinates now
    if not all([shop_to_insert.get("name"), shop_to_insert.get("location"),
                shop_to_insert.get("latitude") is not None, shop_to_insert.get("longitude") is not None]):
         logging.warning("POST /shops request missing required fields (name, location, latitude, or longitude).")
         return jsonify({"error": "Missing required fields: name, location, latitude, and longitude"}), 400

    try:
        # Insert the document
        insert_result = db.shops.insert_one(shop_to_insert)
        inserted_id = insert_result.inserted_id
        logging.info(f"New shop inserted with _id: {inserted_id}")

        # Fetch the newly inserted document to return it in the response
        newly_inserted_shop = db.shops.find_one({"_id": inserted_id})

        if newly_inserted_shop:
            # Format it for the frontend (convert _id, etc.)
            # Reuse the helper function defined for the GET request
            formatted_shop = format_shop_for_frontend(newly_inserted_shop)
            return jsonify(formatted_shop), 201
        else:
            # This case is unlikely if insert_one succeeded, but handle defensively
            logging.error(f"Failed to retrieve shop immediately after insertion with _id: {inserted_id}")
            # Return a success status but indicate retrieval issue
            return jsonify({"message": "Shop added but failed to retrieve confirmation", "id": str(inserted_id)}), 207 # Multi-Status

    except Exception as e:
        logging.error(f"Error inserting shop into database: {e}", exc_info=True)
        return jsonify({"error": "Database insertion failed"}), 500

# Example route (ensure at least one route exists)
@shop_bp.route('/shop')
def shop_home():
    return "Welcome to the Shop!"

# Removed the standalone app run block, as this is a blueprint

@shop_bp.route("/categories", methods=["GET"])
def get_categories():
    # Import db here, inside the function
    from app import db
    try:
        logging.debug("Received GET request at /categories endpoint")
        # Fetch distinct category names from the 'shops_category' collection
        # Fetch distinct descriptions from the 'shops_category' collection.
        categories = []
        collection_names = db.list_collection_names()
        logging.debug(f"Available collections: {collection_names}")

        if 'shops_category' in collection_names:
            logging.info("Attempting to fetch distinct 'description' values from 'shops_category' collection.")
            categories = db.shops_category.distinct("description")
            logging.debug(f"Distinct 'description' values found in 'shops_category': {categories}")
        else:
            logging.warning("Collection 'shops_category' not found.")

        # Fallback: If no descriptions found or collection missing, try 'category' from 'shops'
        if not categories:
            logging.warning("No descriptions found in 'shops_category' or collection missing. Fetching distinct 'category' values from 'shops' collection as fallback.")
            if 'shops' in collection_names:
                 categories = db.shops.distinct("category")
                 logging.debug(f"Distinct 'category' values from 'shops' (fallback): {categories}")
            else:
                 logging.error("Fallback failed: 'shops' collection also not found.")
                 categories = []

        # Filter out any None or empty string values
        categories = [cat for cat in categories if cat]

        logging.debug(f"Found categories: {categories}")
        return jsonify(sorted(categories)), 200 # Return sorted list
    except Exception as e:
        logging.error(f"Error fetching categories: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch categories"}), 500


@shop_bp.route("/profile/shops", methods=["GET"])
def get_user_shops():
    if 'gebruiker' not in session or 'id' not in session['gebruiker']:
        return jsonify({"error": "Authentication required"}), 401

    user_id = session['gebruiker']['id']
    try:
        user_object_id = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user ID format"}), 400

    logging.debug(f"Fetching shops for user ID: {user_id}")

    try:
        # Import db here, inside the function
        from app import db
        # Find shops where the 'userId' field matches the logged-in user's ObjectId
        user_shops_cursor = db.shops.find({"userId": user_object_id})
        user_shops_list = list(user_shops_cursor)

        formatted_shops = []
        for shop in user_shops_list:
             try:
                 # Reuse the existing formatting function
                 formatted_shop = format_shop_for_frontend(shop)
                 # Ensure coordinates are valid before adding
                 if formatted_shop.get('latitude') is not None and formatted_shop.get('longitude') is not None:
                     formatted_shops.append(formatted_shop)
                 else:
                     logging.warning(f"Skipping user's shop ID {shop.get('_id', 'N/A')} due to invalid/missing coordinates after formatting.")
             except Exception as doc_error:
                 shop_id = shop.get('_id', 'N/A')
                 logging.error(f"Error processing user's shop document ID {shop_id}: {doc_error}", exc_info=False)

        logging.debug(f"Found {len(formatted_shops)} shops for user {user_id}")
        return jsonify(formatted_shops), 200

    except Exception as e:
        logging.error(f"Error fetching shops for user {user_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch user shops"}), 500


@shop_bp.route("/shops/<shop_id>", methods=["PUT"])
def update_shop(shop_id):
    if 'gebruiker' not in session or 'id' not in session['gebruiker']:
        return jsonify({"error": "Authentication required"}), 401

    user_id = session['gebruiker']['id']
    try:
        user_object_id = ObjectId(user_id)
        shop_object_id = ObjectId(shop_id)
    except Exception as e:
        logging.error(f"Invalid ID format provided: {e}")
        return jsonify({"error": "Invalid ID format for user or shop"}), 400

    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    logging.debug(f"Attempting to update shop {shop_id} by user {user_id}")

    try:
        # Import db here, inside the function
        from app import db

        # First, verify the shop exists and belongs to the current user
        shop_to_update = db.shops.find_one({"_id": shop_object_id, "userId": user_object_id})

        if not shop_to_update:
            # Check if the shop exists at all but belongs to someone else
            shop_exists = db.shops.find_one({"_id": shop_object_id})
            if shop_exists:
                logging.warning(f"User {user_id} attempted to update shop {shop_id} owned by another user ({shop_exists.get('userId')})")
                return jsonify({"error": "Forbidden: You do not own this shop"}), 403
            else:
                logging.warning(f"Shop {shop_id} not found for update attempt by user {user_id}")
                return jsonify({"error": "Shop not found"}), 404

        # Define fields allowed for update
        allowed_updates = {}
        if "name" in data:
            allowed_updates["name"] = data["name"]
        if "category" in data:
            allowed_updates["category"] = data["category"]
        if "location" in data:
            allowed_updates["location"] = data["location"]
        if "latitude" in data:
            allowed_updates["latitude"] = data["latitude"]
        if "longitude" in data:
            allowed_updates["longitude"] = data["longitude"]
        if "type" in data:
            allowed_updates["type"] = data["type"]
        # Add other updatable fields as needed

        if not allowed_updates:
            return jsonify({"error": "No updatable fields provided"}), 400

        # Add a timestamp for the update
        allowed_updates["last_updated"] = datetime.utcnow()

        # Perform the update
        update_result = db.shops.update_one(
            {"_id": shop_object_id}, # Filter by shop ID (ownership already verified)
            {"$set": allowed_updates}
        )

        if update_result.modified_count == 0 and update_result.matched_count > 0:
             # Matched but nothing changed (e.g., same data sent)
             logging.info(f"Shop {shop_id} update requested by user {user_id}, but data was identical.")
             # Still return success, maybe with a note? Or just the updated doc.

        # Fetch the updated document to return
        updated_shop_doc = db.shops.find_one({"_id": shop_object_id})
        formatted_shop = format_shop_for_frontend(updated_shop_doc) # Reuse formatter

        return jsonify({"message": "Shop updated successfully", "shop": formatted_shop}), 200

    except Exception as e:
        logging.error(f"Error updating shop {shop_id} for user {user_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to update shop"}), 500

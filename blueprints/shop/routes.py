from flask import request, jsonify, Blueprint, current_app, session # Add session here
from datetime import datetime # Import datetime
# Delay importing db to avoid circular import
# from app import db
import logging
import requests # For making API calls
import os # For accessing environment variables (e.g., API keys)
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
        'type': doc.get('type'), # Use lowercase 'type' from DB
        'detail_url': doc.get('Detail URL'),
        'image_url': doc.get('Image URL'),
        'latitude': None, # Default to None
        'longitude': None, # Default to None
        'phone': doc.get('phone'), # <<< ADDED phone
        'website': doc.get('website') # <<< ADDED website
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

    # --- START LOCATION VERIFICATION BLOCK (Two-Step: Geocode + Nearby Search) ---
    # Ensure the environment variable name here matches the one in your .env file
    # (e.g., GOOGLE_PLACES_API_KEY=...).
    GEOCODING_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY') # Use the variable name from your .env file
    GEOCODING_API_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
    NEARBY_SEARCH_API_ENDPOINT = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    VERIFICATION_RADIUS_METERS = 50 # Search radius for the specific name at the geocoded location

    if GEOCODING_API_KEY:
        geocoded_lat = None
        geocoded_lng = None
        shop_name = shop_to_insert.get('name')
        shop_location = shop_to_insert.get('location')

        # --- Step 1: Geocode the location string ---
        try:
            logging.debug(f"Step 1: Geocoding location: '{shop_location}'")
            geocode_params = {
                'address': shop_location,
                'key': GEOCODING_API_KEY
            }
            geocode_response = requests.get(GEOCODING_API_ENDPOINT, params=geocode_params, timeout=10)
            geocode_response.raise_for_status()
            geocode_data = geocode_response.json()

            if geocode_data.get('status') == 'OK' and geocode_data.get('results'):
                location_data = geocode_data['results'][0]['geometry']['location']
                geocoded_lat = location_data.get('lat')
                geocoded_lng = location_data.get('lng')
                logging.info(f"Geocoding successful for '{shop_location}': Lat={geocoded_lat}, Lng={geocoded_lng}")
            elif geocode_data.get('status') == 'ZERO_RESULTS':
                logging.warning(f"Geocoding failed: Address not found for '{shop_location}'.")
                return jsonify({"error": "Could not find the provided address. Please check the location details."}), 400
            else:
                logging.error(f"Geocoding API returned status '{geocode_data.get('status')}' for '{shop_location}'. Error: {geocode_data.get('error_message', 'N/A')}")
                # Proceeding without coordinates is not useful for step 2
                return jsonify({"error": "Failed to verify address due to geocoding error."}), 500

        except requests.exceptions.Timeout:
            logging.error(f"Geocoding API request timed out for '{shop_location}'.")
            return jsonify({"error": "Failed to verify address due to API timeout."}), 500
        except requests.exceptions.RequestException as req_err:
            logging.error(f"Error calling Geocoding API for '{shop_location}': {req_err}")
            return jsonify({"error": "Failed to verify address due to API error."}), 500
        except Exception as geo_err:
            logging.error(f"Error processing Geocoding API response for '{shop_location}': {geo_err}", exc_info=True)
            return jsonify({"error": "Failed to process address verification response."}), 500

        # --- Step 2: Nearby Search for the name at the geocoded coordinates ---
        if geocoded_lat is not None and geocoded_lng is not None:
            try:
                logging.debug(f"Step 2: Nearby Search for name '{shop_name}' at {geocoded_lat},{geocoded_lng} (Radius: {VERIFICATION_RADIUS_METERS}m)")
                nearby_params = {
                    'location': f"{geocoded_lat},{geocoded_lng}",
                    'radius': VERIFICATION_RADIUS_METERS,
                    'keyword': shop_name, # Use keyword to strongly bias towards the name
                    'fields': 'place_id,name', # <<< Request place_id for details lookup
                    'key': GEOCODING_API_KEY
                }
                nearby_response = requests.get(NEARBY_SEARCH_API_ENDPOINT, params=nearby_params, timeout=10)
                nearby_response.raise_for_status()
                nearby_data = nearby_response.json()

                if nearby_data.get('status') == 'OK' and nearby_data.get('results'):
                    # Found at least one match nearby with the keyword
                    logging.info(f"Nearby Search successful: Found potential match(es) for '{shop_name}' near {geocoded_lat},{geocoded_lng}.")
                    # --- Fetch Place Details (Website/Phone) ---
                    place_id = nearby_data['results'][0].get('place_id') # Get place_id of the first match
                    if place_id:
                        PLACE_DETAILS_ENDPOINT = "https://maps.googleapis.com/maps/api/place/details/json"
                        details_params = {
                            'place_id': place_id,
                            'fields': 'website,formatted_phone_number', # Request specific fields
                            'key': GEOCODING_API_KEY
                        }
                        try:
                            logging.debug(f"Fetching details for place_id: {place_id}")
                            details_response = requests.get(PLACE_DETAILS_ENDPOINT, params=details_params, timeout=5)
                            details_response.raise_for_status()
                            details_data = details_response.json()

                            if details_data.get('status') == 'OK' and details_data.get('result'):
                                result = details_data['result']
                                website = result.get('website')
                                phone = result.get('formatted_phone_number')
                                if website:
                                    shop_to_insert['website'] = website
                                    logging.info(f"Added website: {website}")
                                if phone:
                                    shop_to_insert['phone'] = phone
                                    logging.info(f"Added phone: {phone}")
                            else:
                                logging.warning(f"Place Details request failed for {place_id}. Status: {details_data.get('status')}")

                        except requests.exceptions.RequestException as details_err:
                            logging.error(f"Error calling Place Details API for {place_id}: {details_err}")
                        except Exception as details_proc_err:
                             logging.error(f"Error processing Place Details response for {place_id}: {details_proc_err}", exc_info=True)
                    else:
                        logging.warning("No place_id found in Nearby Search result to fetch details.")
                    # --- End Fetch Place Details ---
                    # Verification successful, proceed with insertion
                elif nearby_data.get('status') == 'ZERO_RESULTS':
                    logging.warning(f"Nearby Search failed: No place named '{shop_name}' found within {VERIFICATION_RADIUS_METERS}m of the provided address ({geocoded_lat},{geocoded_lng}).")
                    return jsonify({"error": f"Could not find a shop named '{shop_name}' at the specified address. Please check the name and location."}), 400
                else:
                    logging.error(f"Nearby Search API returned status '{nearby_data.get('status')}' for '{shop_name}' near {geocoded_lat},{geocoded_lng}. Error: {nearby_data.get('error_message', 'N/A')}")
                    # Decide whether to block or proceed with warning. Blocking is safer for strict validation.
                    return jsonify({"error": "Failed to verify shop name at address due to API error."}), 500

            except requests.exceptions.Timeout:
                logging.error(f"Nearby Search API request timed out for '{shop_name}' near {geocoded_lat},{geocoded_lng}.")
                return jsonify({"error": "Failed to verify shop name at address due to API timeout."}), 500
            except requests.exceptions.RequestException as req_err:
                logging.error(f"Error calling Nearby Search API for '{shop_name}' near {geocoded_lat},{geocoded_lng}: {req_err}")
                return jsonify({"error": "Failed to verify shop name at address due to API error."}), 500
            except Exception as nearby_err:
                logging.error(f"Error processing Nearby Search API response for '{shop_name}' near {geocoded_lat},{geocoded_lng}: {nearby_err}", exc_info=True)
                return jsonify({"error": "Failed to process shop name verification response."}), 500
        else:
             # This case should technically not be reached if geocoding succeeded, but handle defensively
             logging.error("Nearby Search skipped because geocoded coordinates were missing.")
             return jsonify({"error": "Internal error during address verification."}), 500

    else:
        logging.warning("GOOGLE_PLACES_API_KEY environment variable not set. Skipping shop location verification.")
    # --- END LOCATION VERIFICATION BLOCK ---

    # --- START DUPLICATE CHECK ---
    try:
        existing_shop = db.shops.find_one({
            "name": shop_to_insert.get("name"),
            "latitude": shop_to_insert.get("latitude"),
            "longitude": shop_to_insert.get("longitude")
        })
        if existing_shop:
            logging.warning(f"Duplicate shop detected: Name '{shop_to_insert.get('name')}' already exists at coordinates ({shop_to_insert.get('latitude')}, {shop_to_insert.get('longitude')}).")
            return jsonify({"error": f"A shop named '{shop_to_insert.get('name')}' already exists at this exact location."}), 409 # 409 Conflict
    except Exception as e:
        # Log error during check but proceed cautiously or return server error
        logging.error(f"Error during duplicate shop check: {e}", exc_info=True)
        # Depending on policy, you might want to block insertion or just log and continue
        return jsonify({"error": "Server error during duplicate check."}), 500
    # --- END DUPLICATE CHECK ---
 
    try:
        # Insert the document if no duplicate found
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
        logging.debug(f"Attempting to update shop {shop_id} with data: {allowed_updates}") # <<< Log data before update
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
 
 
@shop_bp.route("/shops/<shop_id>", methods=["DELETE"])
def delete_shop(shop_id):
    if 'gebruiker' not in session or 'id' not in session['gebruiker']:
        return jsonify({"error": "Authentication required"}), 401
 
    user_id = session['gebruiker']['id']
    try:
        user_object_id = ObjectId(user_id)
        shop_object_id = ObjectId(shop_id)
    except Exception as e:
        logging.error(f"Invalid ID format provided for delete: {e}")
        return jsonify({"error": "Invalid ID format for shop"}), 400
 
    logging.debug(f"Attempting to delete shop {shop_id} by user {user_id}")
 
    try:
        # Import db here, inside the function
        from app import db
 
        # Find the shop to verify ownership before deleting
        shop_to_delete = db.shops.find_one({"_id": shop_object_id, "userId": user_object_id})
 
        if not shop_to_delete:
            # Check if the shop exists but belongs to someone else
            shop_exists = db.shops.find_one({"_id": shop_object_id})
            if shop_exists:
                logging.warning(f"User {user_id} attempted to delete shop {shop_id} owned by another user ({shop_exists.get('userId')})")
                return jsonify({"error": "Forbidden: You do not own this shop"}), 403
            else:
                logging.warning(f"Shop {shop_id} not found for delete attempt by user {user_id}")
                return jsonify({"error": "Shop not found"}), 404
 
        # Perform the delete operation
        delete_result = db.shops.delete_one({"_id": shop_object_id})
 
        if delete_result.deleted_count == 1:
            logging.info(f"Shop {shop_id} deleted successfully by user {user_id}")
            return jsonify({"message": "Shop deleted successfully"}), 200
        else:
            # This case should ideally not happen if find_one succeeded, but handle defensively
            logging.error(f"Shop {shop_id} found but failed to delete for user {user_id}. Delete count: {delete_result.deleted_count}")
            return jsonify({"error": "Failed to delete shop after verification"}), 500
 
    except Exception as e:
        logging.error(f"Error deleting shop {shop_id} for user {user_id}: {e}", exc_info=True)
        return jsonify({"error": "Failed to delete shop"}), 500


@shop_bp.route("/shops/suggestions", methods=["GET"])
def get_shop_suggestions():
    """
    Provides shop name suggestions based on an address query parameter.
    Uses Geocoding API + Nearby Search API.
    """
    address = request.args.get('address')
    if not address:
        return jsonify({"error": "Missing 'address' query parameter"}), 400

    GEOCODING_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY')
    if not GEOCODING_API_KEY:
        logging.error("GOOGLE_PLACES_API_KEY not set, cannot provide suggestions.")
        # Return empty list instead of error? Or 503 Service Unavailable?
        return jsonify({"suggestions": [], "error": "API key not configured"}), 503

    GEOCODING_API_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
    NEARBY_SEARCH_API_ENDPOINT = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    SUGGESTION_RADIUS_METERS = 100 # Radius to search for businesses near the address

    geocoded_lat = None
    geocoded_lng = None

    # --- Step 1: Geocode the address ---
    try:
        logging.debug(f"Suggestions Step 1: Geocoding address: '{address}'")
        geocode_params = {'address': address, 'key': GEOCODING_API_KEY}
        geocode_response = requests.get(GEOCODING_API_ENDPOINT, params=geocode_params, timeout=7)
        geocode_response.raise_for_status()
        geocode_data = geocode_response.json()

        if geocode_data.get('status') == 'OK' and geocode_data.get('results'):
            location_data = geocode_data['results'][0]['geometry']['location']
            geocoded_lat = location_data.get('lat')
            geocoded_lng = location_data.get('lng')
            logging.info(f"Suggestions Geocoding successful for '{address}': Lat={geocoded_lat}, Lng={geocoded_lng}")
        else:
            # If geocoding fails, we can't get nearby suggestions
            logging.warning(f"Suggestions Geocoding failed or ZERO_RESULTS for '{address}'. Status: {geocode_data.get('status')}")
            return jsonify({"suggestions": []}), 200 # Return empty list if address not found

    except requests.exceptions.RequestException as req_err:
        logging.error(f"Suggestions Geocoding API error for '{address}': {req_err}")
        return jsonify({"error": "Failed to contact geocoding service"}), 500
    except Exception as geo_err:
        logging.error(f"Suggestions Geocoding processing error for '{address}': {geo_err}", exc_info=True)
        return jsonify({"error": "Failed to process geocoding response"}), 500

    # --- Step 2: Nearby Search for businesses at the coordinates ---
    suggestions = []
    if geocoded_lat is not None and geocoded_lng is not None:
        try:
            logging.debug(f"Suggestions Step 2: Nearby Search at {geocoded_lat},{geocoded_lng} (Radius: {SUGGESTION_RADIUS_METERS}m)")
            nearby_params = {
                'location': f"{geocoded_lat},{geocoded_lng}",
                'radius': SUGGESTION_RADIUS_METERS,
                # 'type': 'store', # Optional: filter by type(s) like 'store', 'restaurant', etc.
                'key': GEOCODING_API_KEY
            }
            nearby_response = requests.get(NEARBY_SEARCH_API_ENDPOINT, params=nearby_params, timeout=7)
            nearby_response.raise_for_status()
            nearby_data = nearby_response.json()

            if nearby_data.get('status') == 'OK' and nearby_data.get('results'):
                suggestions = [place.get('name') for place in nearby_data['results'] if place.get('name')]
                # Optional: Filter out duplicates or very generic names if needed
                suggestions = sorted(list(set(suggestions))) # Remove duplicates and sort
                logging.info(f"Suggestions Nearby Search successful: Found {len(suggestions)} potential names near '{address}'.")
            else:
                logging.warning(f"Suggestions Nearby Search status not OK or ZERO_RESULTS for {geocoded_lat},{geocoded_lng}. Status: {nearby_data.get('status')}")
                # Return empty list if no businesses found nearby

        except requests.exceptions.RequestException as req_err:
            logging.error(f"Suggestions Nearby Search API error near {geocoded_lat},{geocoded_lng}: {req_err}")
            # Don't return 500, just return empty suggestions
        except Exception as nearby_err:
            logging.error(f"Suggestions Nearby Search processing error near {geocoded_lat},{geocoded_lng}: {nearby_err}", exc_info=True)
            # Don't return 500, just return empty suggestions

    return jsonify({"suggestions": suggestions}), 200

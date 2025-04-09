import os
import time # Re-added for delay between API calls
from pymongo import MongoClient
from dotenv import load_dotenv
import logging
from blueprints.utils.geo import google_geocode # Re-import the geocoding function

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def manage_shops():
    """
    Finds shops with empty string latitude ('') and attempts to update
    their latitude and longitude using the 'location' field, or the 'Name'
    field as a fallback, via geocoding.
    """
    # Load environment variables from .env file
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    db_name = "pihappy" # As defined in app.py

    if not mongo_uri:
        logger.error("MONGO_URI is not set in the environment variables. Please check your .env file.")
        return

    logger.info(f"Connecting to MongoDB at {mongo_uri}...")
    client = None # Initialize client to None for finally block
    try:
        client = MongoClient(mongo_uri)
        db = client[db_name]
        shops_collection = db["shops"]
        logger.info(f"Connected to database '{db_name}'.")

        # Query for documents where latitude is an empty string
        query = {
            "$or": [
                {"latitude": ""},
                {"Latitude": ""} # Check capitalized version too
            ]
        }

        logger.info("Finding shops with empty string latitude to update...")
        shops_to_update = list(shops_collection.find(query))
        count = len(shops_to_update)

        if count == 0:
            logger.info("No shops found with an empty string latitude. No action needed.")
            return

        logger.info(f"Found {count} shop(s) with an empty string latitude. Attempting to geocode and update...")

        updated_count = 0
        failed_count = 0
        skipped_count = 0

        for shop in shops_to_update:
            shop_id = shop["_id"]
            location_to_geocode = None
            source_field = None

            # Try 'location' or 'locatie' first
            location = shop.get("location") or shop.get("locatie")
            if location:
                location_to_geocode = location
                source_field = "'location'/'locatie'"
            else:
                # Fallback to 'Name'
                name = shop.get("Name")
                if name:
                    location_to_geocode = name
                    source_field = "'Name'"
                else:
                    logger.warning(f"Shop ID {shop_id}: Both 'location'/'locatie' and 'Name' fields missing or empty. Skipping.")
                    skipped_count += 1
                    continue

            logger.info(f"Shop ID {shop_id}: Geocoding using {source_field}: '{location_to_geocode}'...")
            geocode_result = google_geocode(location_to_geocode)

            if geocode_result and "latitude" in geocode_result and "longitude" in geocode_result:
                new_latitude = geocode_result["latitude"]
                new_longitude = geocode_result["longitude"]
                logger.info(f"Shop ID {shop_id}: Geocoding successful. Lat: {new_latitude}, Lon: {new_longitude}")

                # Update the shop document
                update_result = shops_collection.update_one(
                    {"_id": shop_id},
                    {"$set": {"latitude": new_latitude, "longitude": new_longitude}}
                )

                if update_result.modified_count == 1:
                    logger.info(f"Shop ID {shop_id}: Successfully updated in database.")
                    updated_count += 1
                else:
                    # This case might happen if geocoding returned the same empty string or if there was a concurrent update
                    logger.warning(f"Shop ID {shop_id}: Update command executed but no document was modified. (Perhaps coordinates were already correct or unchanged?)")
                    # Still count as a failure for summary purposes if lat/lon remain empty
                    current_doc = shops_collection.find_one({"_id": shop_id})
                    if not current_doc.get("latitude") or not current_doc.get("longitude"):
                         failed_count += 1
                    else: # If somehow it got updated concurrently or geocoding returned empty string but db had value
                         updated_count +=1 # Count as success if lat/lon are now populated

            else:
                error_msg = geocode_result.get("fout", "Unknown geocoding error") if isinstance(geocode_result, dict) else "Unknown geocoding error"
                logger.error(f"Shop ID {shop_id}: Geocoding failed using {source_field} '{location_to_geocode}'. Error: {error_msg}")
                failed_count += 1

            # Add a small delay to avoid hitting API rate limits
            time.sleep(0.1) # Use a small delay

        logger.info(f"Update process summary:")
        logger.info(f" - Successfully updated: {updated_count}")
        logger.info(f" - Geocoding/Update failed: {failed_count}")
        logger.info(f" - Skipped (no location/name): {skipped_count}")
        logger.info(f" - Total processed: {count}")

    except Exception as e:
        logger.error(f"An error occurred during the process: {e}")
    finally:
        if client:
            client.close()
            logger.info("MongoDB connection closed.")

if __name__ == "__main__":
    logger.info("Starting process to update shops with empty string latitude using geocoding (location/name fallback)...")
    manage_shops()
    logger.info("Process finished.")
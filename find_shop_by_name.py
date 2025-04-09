import os
import re # Import regex for case-insensitive search
from pymongo import MongoClient
from dotenv import load_dotenv
import logging
from bson import json_util # To print MongoDB documents nicely

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_shop(shop_name_to_find):
    """
    Finds documents in the 'shops' collection where the 'name' or 'Name' field
    matches the given shop_name (case-insensitive).
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

        # Create a case-insensitive regex pattern
        regex_pattern = re.compile(f"^{re.escape(shop_name_to_find)}$", re.IGNORECASE)

        # Query checks both 'name' and 'Name' fields using the regex
        query = {
            "$or": [
                {"name": regex_pattern},
                {"Name": regex_pattern}
            ]
        }

        logger.info(f"Searching for shops with name matching '{shop_name_to_find}' (case-insensitive)...")
        found_shops = list(shops_collection.find(query))

        if not found_shops:
            logger.info(f"No shops found matching the name '{shop_name_to_find}'.")
        else:
            logger.info(f"Found {len(found_shops)} shop(s) matching '{shop_name_to_find}':")
            # Print documents in a readable JSON format
            for shop in found_shops:
                # Use json_util to handle ObjectId and other BSON types
                print(json_util.dumps(shop, indent=4))

    except Exception as e:
        logger.error(f"An error occurred during the search process: {e}")
    finally:
        if client:
            client.close()
            logger.info("MongoDB connection closed.")

if __name__ == "__main__":
    search_name = "drop" # The name to search for
    logger.info(f"Starting search for shop named '{search_name}'...")
    find_shop(search_name)
    logger.info("Search process finished.")
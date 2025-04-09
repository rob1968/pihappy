import os
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_data():
    """
    Copies all documents from the 'shops' collection to the 'winkels' collection
    in the MongoDB database specified by the MONGO_URI environment variable.
    """
    # Load environment variables from .env file
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    db_name = "pihappy" # As defined in app.py

    if not mongo_uri:
        logger.error("MONGO_URI is not set in the environment variables. Please check your .env file.")
        return

    logger.info(f"Connecting to MongoDB at {mongo_uri}...")
    try:
        client = MongoClient(mongo_uri)
        db = client[db_name]
        shops_collection = db["shops"]
        winkels_collection = db["winkels"]
        logger.info(f"Connected to database '{db_name}'.")

        logger.info(f"Fetching documents from collection 'shops'...")
        shops_data = list(shops_collection.find({})) # Fetch all documents
        shop_count = len(shops_data)
        logger.info(f"Found {shop_count} documents in 'shops'.")

        if not shops_data:
            logger.info("No documents found in 'shops' collection. Nothing to migrate.")
            return

        logger.info(f"Inserting {shop_count} documents into 'winkels' collection...")
        try:
            # Using insert_many for efficiency
            result = winkels_collection.insert_many(shops_data, ordered=False) # ordered=False allows inserting non-duplicates if some fail
            inserted_count = len(result.inserted_ids)
            logger.info(f"Successfully inserted {inserted_count} documents into 'winkels'.")
        except Exception as e:
            # Catch potential bulk write errors (e.g., duplicate keys if run multiple times)
            logger.error(f"An error occurred during insertion into 'winkels': {e}")
            logger.warning("Some documents might not have been inserted due to errors (e.g., duplicates).")

    except Exception as e:
        logger.error(f"An error occurred during the migration process: {e}")
    finally:
        if 'client' in locals() and client:
            client.close()
            logger.info("MongoDB connection closed.")

if __name__ == "__main__":
    logger.info("Starting data migration from 'shops' to 'winkels'...")
    migrate_data()
    logger.info("Migration process finished.")
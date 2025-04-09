import os
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def count_all_shops():
    """
    Counts all documents in the 'shops' collection.
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

        logger.info("Counting total documents in 'shops' collection...")
        # count_documents({}) counts all documents
        total_count = shops_collection.count_documents({})
        logger.info(f"Total number of documents in 'shops' collection: {total_count}")

    except Exception as e:
        logger.error(f"An error occurred during the counting process: {e}")
    finally:
        if client:
            client.close()
            logger.info("MongoDB connection closed.")

if __name__ == "__main__":
    logger.info("Starting process to count all shops...")
    count_all_shops()
    logger.info("Counting process finished.")
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# List of collections to empty
collections_to_empty = [
    "chats",
    "community_chat",
    "community_input",
    "dagboek",
    "feedback",
    "users"
    # Add "gebruikers" back if you want to ensure it's empty too,
    # or remove it if it was already handled.
    # "gebruikers"
]

# Load environment variables from .env file
load_dotenv()

# Get MongoDB connection string
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    logger.error("MONGO_URI is not set in the environment variables. Please check your .env file.")
    exit(1)

client = None # Initialize client to None
try:
    # Connect to MongoDB
    logger.info("Connecting to MongoDB...")
    client = MongoClient(mongo_uri)
    db = client["pihappy"] # Access the pihappy database
    logger.info("Successfully connected to MongoDB.")

    for collection_name in collections_to_empty:
        logger.info(f"--- Processing collection: '{collection_name}' ---")
        if collection_name not in db.list_collection_names():
            logger.warning(f"Collection '{collection_name}' does not exist. Skipping.")
            continue

        collection = db[collection_name] # Access the collection

        # Count documents before deletion
        count_before = collection.count_documents({})
        logger.info(f"Found {count_before} documents in '{collection_name}' before deletion.")

        # Empty the collection
        if count_before > 0:
            logger.info(f"Attempting to delete all documents from '{collection_name}'...")
            delete_result = collection.delete_many({})
            logger.info(f"Successfully deleted {delete_result.deleted_count} documents from '{collection_name}'.")
        else:
            logger.info(f"Collection '{collection_name}' is already empty. No documents to delete.")

        # Count documents after deletion
        count_after = collection.count_documents({})
        logger.info(f"Found {count_after} documents in '{collection_name}' after deletion.")

    logger.info("--- All specified collections processed. ---")

except Exception as e:
    logger.error(f"An error occurred: {e}")
    exit(1)
finally:
    if client:
        client.close()
        logger.info("MongoDB connection closed.")
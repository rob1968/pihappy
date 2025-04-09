import pymongo
import logging
from bson import json_util # For better printing of BSON types like ObjectId
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# MongoDB connection details (Update if different)
MONGO_URI = "mongodb://localhost:27017"
DATABASE_NAME = "pihappy"
COLLECTION_NAME = "shops_category"

def show_category_data():
    """Connects to MongoDB, fetches all documents from the specified collection, and prints them."""
    client = None # Initialize client to None
    try:
        logging.info(f"Connecting to MongoDB at {MONGO_URI}...")
        client = pymongo.MongoClient(MONGO_URI)
        db = db = client[DATABASE_NAME]
        logging.info(f"Connected to database '{DATABASE_NAME}'.")

        if COLLECTION_NAME not in db.list_collection_names():
            logging.warning(f"Collection '{COLLECTION_NAME}' does not exist in database '{DATABASE_NAME}'.")
            return

        collection = db[COLLECTION_NAME]
        logging.info(f"Fetching all documents from collection '{COLLECTION_NAME}'...")

        documents = list(collection.find({})) # Fetch all documents

        if not documents:
            logging.info(f"No documents found in collection '{COLLECTION_NAME}'.")
        else:
            logging.info(f"Found {len(documents)} document(s) in '{COLLECTION_NAME}':")
            for doc in documents:
                # Use json_util to handle BSON types for printing
                print(json.dumps(doc, default=json_util.default, indent=4))

    except pymongo.errors.ConnectionFailure as e:
        logging.error(f"Could not connect to MongoDB: {e}")
    except Exception as e:
        logging.error(f"An error occurred: {e}", exc_info=True)
    finally:
        if client:
            client.close()
            logging.info("MongoDB connection closed.")

if __name__ == "__main__":
    show_category_data()
    logging.info("Script finished.")
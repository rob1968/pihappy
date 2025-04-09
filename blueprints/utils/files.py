import os
import uuid
import hashlib
from pymongo import MongoClient
from dotenv import load_dotenv

# 📦 Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["pihappy"]

# 🔐 User-specific helpers
def load_users():
    """Return users as a dict of {_id: user_data}."""
    users = db.users.find()
    return {user["_id"]: user for user in users}

def save_users(data):
    """Replace all user records (CAUTION: destructive)."""
    db.users.delete_many({})
    users_to_insert = [{"_id": key, **val} for key, val in data.items()]
    db.users.insert_many(users_to_insert)

def generate_user_id():
    uniek_id = str(uuid.uuid4())
    return hashlib.sha256(uniek_id.encode()).hexdigest()

# 💬 Chat helpers
def laad_chatgeschiedenis(gebruiker_id):
    """Fetch chat history for given user."""
    doc = db.chats.find_one({"_id": gebruiker_id})
    return doc.get("gesprekken", []) if doc else []

def sla_chatgeschiedenis_op(gebruiker_id, geschiedenis):
    """Save/replace chat history for a user."""
    db.chats.update_one(
        {"_id": gebruiker_id},
        {"$set": {"gesprekken": geschiedenis}},
        upsert=True
    )

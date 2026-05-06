import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")

if not MONGODB_URL:
    raise ValueError("MONGODB_URL no está configurada en el archivo .env")

client = AsyncIOMotorClient(MONGODB_URL)
db = client["ugma_repositorio"]

doc_teg_inf_collection = db["doc_teg_inf"]
usuarios_collection = db["usuarios"]

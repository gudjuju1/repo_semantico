from sentence_transformers import SentenceTransformer
import asyncio

class AIService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(AIService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    async def generate_embedding(self, text: str):
        return await asyncio.to_thread(self.model.encode, text)

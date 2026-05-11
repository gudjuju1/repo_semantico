import os
from fastapi import HTTPException
from huggingface_hub import AsyncInferenceClient

class AIService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(AIService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        # Usamos el cliente oficial de Hugging Face para mayor estabilidad
        self.hf_token = os.getenv("HF_TOKEN")
        self.model_id = "sentence-transformers/all-MiniLM-L6-v2"
        self.client = AsyncInferenceClient(token=self.hf_token)

    async def generate_embedding(self, text: str):
        try:
            # feature_extraction se encarga de llamar al endpoint correcto
            # y maneja los reintentos si el modelo está cargando
            embedding = await self.client.feature_extraction(text, model=self.model_id)
            return embedding
        except Exception as e:
            print(f"Error en el servicio de IA: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"Error en el servicio de IA: {str(e)}"
            )


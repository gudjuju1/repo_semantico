import os
import asyncio
from dotenv import load_dotenv
from huggingface_hub import AsyncInferenceClient

load_dotenv()


async def test():
    hf_token = os.getenv("HF_TOKEN")
    client = AsyncInferenceClient(token=hf_token)
    model_id = "sentence-transformers/all-MiniLM-L6-v2"

    try:
        embedding = await client.feature_extraction("test query", model=model_id)
        print(f"Success! Type: {type(embedding)}")
        print(f"Shape: {embedding.shape if hasattr(embedding, 'shape') else len(embedding)}")
        return embedding
    except Exception as e:
        print(f"Error with client: {e}")

if __name__ == "__main__":
    asyncio.run(test())


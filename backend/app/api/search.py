from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.db.session import doc_teg_inf_collection
from app.services.ai_service import AIService
from app.api.auth import get_current_user

router = APIRouter()

class SearchQuery(BaseModel):
    consulta: str
    limit: int = 5

@router.post("/semantic")
async def semantic_search(
    query: SearchQuery,
    current_user: dict = Depends(get_current_user)
):
    try:
        # 1. Convertir la pregunta del usuario en un vector
        ai_service = AIService()
        embedding_raw = await ai_service.generate_embedding(query.consulta)
        
        # Asegurar que sea lista de Python para MongoDB
        if hasattr(embedding_raw, "tolist"):
            vector_consulta = embedding_raw.tolist()
        else:
            vector_consulta = embedding_raw

        # 2. Pipeline de Búsqueda Vectorial
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "vector_index",
                    "path": "vector_embedding",
                    "queryVector": vector_consulta,
                    "numCandidates": 100,
                    "limit": query.limit
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "vector_embedding": 0, 
                    "score": {"$meta": "vectorSearchScore"} 
                }
            }
        ]

        # 3. Ejecutar la búsqueda
        resultados = []
        cursor = doc_teg_inf_collection.aggregate(pipeline)
        
        # Convertir cursor a lista
        async for doc in cursor:
            resultados.append(doc)
            
        return {
            "query": query.consulta,
            "total_resultados": len(resultados),
            "resultados": resultados
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la búsqueda: {str(e)}")
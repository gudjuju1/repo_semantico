from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.db.session import doc_teg_inf_collection
from app.services.ai_service import AIService
from app.api.auth import get_current_user

router = APIRouter()

class SearchQuery(BaseModel):
    consulta: str
    limit: int = 5
    tipo_documento: Optional[str] = None
    periodo_academico: Optional[str] = None

@router.post("/semantic")
async def semantic_search(
    query: SearchQuery,
    current_user: dict = Depends(get_current_user)
):
    try:
        # 1. Convertir la consulta en vector
        ai_service = AIService()
        embedding_raw = await ai_service.generate_embedding(query.consulta)
        vector_consulta = embedding_raw.tolist() if hasattr(embedding_raw, "tolist") else embedding_raw

        # 2. Construir el filtro dinámico (SOLO si tienen contenido real)
        filtro_metadata = {}
        
        if query.tipo_documento and query.tipo_documento.strip():
            filtro_metadata["tipo_documento"] = query.tipo_documento.strip()
            
        if query.periodo_academico and query.periodo_academico.strip():
            filtro_metadata["periodo_academico"] = query.periodo_academico.strip()

        # 3. Configurar los parámetros de $vectorSearch
        vector_search_params = {
            "index": "vector_index",
            "path": "vector_embedding",
            "queryVector": vector_consulta,
            "numCandidates": 100,
            "limit": query.limit
        }

        # CRÍTICO: Solo añadimos la clave 'filter' si hay filtros definidos
        if filtro_metadata:
            vector_search_params["filter"] = filtro_metadata

        # 4. Construir el Pipeline
        pipeline = [
            { "$vectorSearch": vector_search_params },
            {
                "$project": {
                    "_id": 0,
                    "score": {"$meta": "vectorSearchScore"},
                    "titulo": 1,
                    "autores": 1,
                    "tutor": 1,
                    "tipo_documento": 1,
                    "periodo_academico": 1,
                    "resumen": 1,
                    "archivo_url": 1
                }
            }
        ]

        # 5. Ejecutar la búsqueda en Atlas
        resultados = []
        cursor = doc_teg_inf_collection.aggregate(pipeline)
        
        async for doc in cursor:
            # Opcional: redondear el score para que se vea limpio en el frontend
            if "score" in doc:
                doc["score"] = round(doc["score"], 4)
            resultados.append(doc)
            
        return {
            "query": query.consulta,
            "filtros_aplicados": filtro_metadata,
            "total_resultados": len(resultados),
            "resultados": resultados
        }

    except Exception as e:
        # Imprime el error en la consola de Python para que puedas verlo detallado
        print(f"DEBUG ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en la búsqueda: {str(e)}")
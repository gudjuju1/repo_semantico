from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel, HttpUrl
from app.db.session import doc_teg_inf_collection
from app.core.security import verify_control_key
from app.services.ai_service import AIService
from app.api.auth import get_current_user, require_superadmin
from bson.objectid import ObjectId
from app.services.log_service import registrar_log
from typing import Optional

router = APIRouter()

class DocumentoAcademico(BaseModel):
    titulo: str
    autores: list[str]
    tutor: str
    tipo_documento: str  # "TEG" o "Informe"
    periodo_academico: str
    resumen: str
    archivo_url: HttpUrl 

class DocumentoAcademicoUpdate(BaseModel):
    titulo: Optional[str] = None
    autores: Optional[list[str]] = None
    tutor: Optional[str] = None
    tipo_documento: Optional[str] = None
    periodo_academico: Optional[str] = None
    resumen: Optional[str] = None
    archivo_url: Optional[HttpUrl] = None

@router.post("/upload")
async def upload_document(
    documento: DocumentoAcademico,
    x_control_key: str = Header(...),
    current_user: dict = Depends(get_current_user)
):
    # Verificar la Llave de Control
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    # 1. Combinamos el título y el resumen en una sola cadena de texto
    texto_para_ia = f"Título: {documento.titulo}. Resumen: {documento.resumen}"

    # 2. Generar el embedding
    ai_service = AIService()
    embedding_raw = await ai_service.generate_embedding(texto_para_ia)
    
    # 3. CONVERSIÓN CRÍTICA: De Numpy Array a Lista de Python (Evita el Error 500)
    # Si tu AIService ya devuelve una lista, esto no hará daño, 
    # pero si devuelve un objeto de Numpy, esto lo arregla.
    if hasattr(embedding_raw, "tolist"):
        vector_embedding = embedding_raw.tolist()
    else:
        vector_embedding = embedding_raw

    # 4. Preparar datos para MongoDB
    doc_data = documento.dict()
    doc_data["archivo_url"] = str(documento.archivo_url) # Convertir HttpUrl a string
    doc_data["vector_embedding"] = vector_embedding    # Lista de números estándar
    
    # 5. Guardar en la base de datos
    await doc_teg_inf_collection.insert_one(doc_data)

    # Registrar en logs
    detalles = f"Registró el documento con título: {documento.titulo}"
    await registrar_log(current_user["correo"], "registro", detalles)

    return {"detail": "Documento registrado exitosamente"}

@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    x_control_key: str = Header(...),
    current_user: dict = Depends(require_superadmin)
):
    # Verificar la Llave de Control
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    try:
        object_id = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de documento inválido")

    # Buscar y eliminar el documento
    documento = await doc_teg_inf_collection.find_one({"_id": object_id})
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    await doc_teg_inf_collection.delete_one({"_id": object_id})

    # Registrar en logs
    titulo = documento.get("titulo", "Documento sin título")
    detalles = f"Eliminó el documento con título: {titulo}"
    await registrar_log(current_user["correo"], "eliminación", detalles)

    return {"detail": "Documento eliminado exitosamente"}

@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    update_data: DocumentoAcademicoUpdate,
    x_control_key: str = Header(...),
    current_user: dict = Depends(get_current_user)
):
    # Verificar la Llave de Control
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    try:
        object_id = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de documento inválido")

    documento = await doc_teg_inf_collection.find_one({"_id": object_id})
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    update_dict = update_data.dict(exclude_unset=True)

    # Si se actualiza el título o el resumen, recalcular el embedding
    if "titulo" in update_dict or "resumen" in update_dict:
        nuevo_titulo = update_dict.get("titulo", documento.get("titulo", ""))
        nuevo_resumen = update_dict.get("resumen", documento.get("resumen", ""))
        texto_para_ia = f"Título: {nuevo_titulo}. Resumen: {nuevo_resumen}"
        ai_service = AIService()
        embedding_raw = await ai_service.generate_embedding(texto_para_ia)
        if hasattr(embedding_raw, "tolist"):
            vector_embedding = embedding_raw.tolist()
        else:
            vector_embedding = embedding_raw
        update_dict["vector_embedding"] = vector_embedding

    # Si archivo_url está presente, convertir a string
    if "archivo_url" in update_dict and update_dict["archivo_url"] is not None:
        update_dict["archivo_url"] = str(update_dict["archivo_url"])

    await doc_teg_inf_collection.update_one({"_id": object_id}, {"$set": update_dict})

    # Registrar en logs
    detalles = f"Editó el documento con título: {documento.get('titulo', 'Documento sin título')}"
    await registrar_log(current_user["correo"], "edición", detalles)

    return {"detail": "Documento actualizado exitosamente"}

@router.get("/")
async def list_documents(offset: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100)):
    cursor = doc_teg_inf_collection.find({}, {"vector_embedding": 0})
    documentos = []
    async for doc in cursor.skip(offset).limit(limit):
        doc["id"] = str(doc.pop("_id"))
        documentos.append(doc)
    return documentos

@router.get("/audit-logs")
async def list_audit_logs(current_user: dict = Depends(require_superadmin)):
    logs_collection = doc_teg_inf_collection.database["logs"]
    cursor = logs_collection.find({}).sort("fecha", -1)
    logs = []
    async for log in cursor:
        log["id"] = str(log.pop("_id"))
        logs.append(log)
    return logs
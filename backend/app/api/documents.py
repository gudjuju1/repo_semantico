from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, HttpUrl
from app.db.session import doc_teg_inf_collection
from app.core.security import verify_control_key
from app.services.ai_service import AIService
from app.api.auth import get_current_user
from bson.objectid import ObjectId
from app.services.log_service import registrar_log
from app.api.auth import get_current_user, require_superadmin

router = APIRouter()

class DocumentoAcademico(BaseModel):
    titulo: str
    autores: list[str]
    tutor: str
    tipo_documento: str  # "TEG" o "Informe"
    periodo_academico: str
    resumen: str
    archivo_url: HttpUrl 

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
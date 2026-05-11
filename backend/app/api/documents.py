from fastapi import APIRouter, HTTPException, Depends, Header, Query, File, UploadFile, Form
from pydantic import BaseModel, HttpUrl
from app.db.session import doc_teg_inf_collection
from app.core.security import verify_control_key
from app.services.ai_service import AIService
from app.services.drive_service import upload_to_drive, delete_from_drive, update_drive_file
from app.api.auth import get_current_user, require_superadmin
from bson.objectid import ObjectId
from app.services.log_service import registrar_log
from typing import Optional

router = APIRouter()

# --- MODELOS ---

class DocumentoAcademicoUpdate(BaseModel):
    titulo: Optional[str] = None
    autores: Optional[list[str]] = None
    tutor: Optional[str] = None
    tipo_documento: Optional[str] = None
    periodo_academico: Optional[str] = None
    resumen: Optional[str] = None
    archivo_url: Optional[HttpUrl] = None

# --- ENDPOINTS ---

@router.post("/upload")
async def upload_document(
    titulo: str = Form(...),
    autores: str = Form(...), 
    tutor: str = Form(...),
    tipo_documento: str = Form(...),
    periodo_academico: str = Form(...),
    resumen: str = Form(...),
    file: UploadFile = File(...),
    x_control_key: str = Header(...),
    current_user: dict = Depends(get_current_user)
):
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    # 1. Subida a Google Drive
    try:
        content = await file.read()
        drive_res = await upload_to_drive(content, file.filename)
    except Exception as e:
        print(f"Error Drive: {e}")
        raise HTTPException(status_code=500, detail="Error al subir el archivo al repositorio")

    # 2. Generación de Embedding (IA)
    try:
        ai_service = AIService()
        texto_para_ia = f"Título: {titulo}. Resumen: {resumen}"
        embedding_raw = await ai_service.generate_embedding(texto_para_ia)
        
        # Validar formato: La API a veces devuelve [[...]]
        if isinstance(embedding_raw, list) and len(embedding_raw) > 0:
            if isinstance(embedding_raw[0], list):
                vector_embedding = embedding_raw[0]
            else:
                vector_embedding = embedding_raw
        else:
            vector_embedding = embedding_raw
            
    except Exception as e:
        print(f"Error IA: {e}")
        # Opcional: podrías decidir guardar el documento sin vector si la IA falla
        raise HTTPException(status_code=500, detail="Error procesando la búsqueda semántica")

    # 3. Guardado en MongoDB
    try:
        doc_data = {
            "titulo": titulo,
            "autores": [a.strip() for a in autores.split(",")],
            "tutor": tutor,
            "tipo_documento": tipo_documento,
            "periodo_academico": periodo_academico,
            "resumen": resumen,
            "archivo_url": drive_res['link'],
            "drive_file_id": drive_res['file_id'],
            "vector_embedding": vector_embedding  # Lista de floats
        }
        
        await doc_teg_inf_collection.insert_one(doc_data)
        await registrar_log(current_user["correo"], "REGISTRO DE DOCUMENTO", f"Registró tesis: {titulo}")

        return {"detail": "Documento registrado exitosamente", "link": drive_res['link']}
    
    except Exception as e:
        print(f"Error DB: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar en la base de datos")


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    x_control_key: str = Header(...),
    current_user: dict = Depends(require_superadmin)
):
    """Elimina el registro de la DB y el archivo físico de Drive"""
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    try:
        object_id = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de documento inválido")

    documento = await doc_teg_inf_collection.find_one({"_id": object_id})
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # 1. ELIMINAR DE DRIVE
    if "drive_file_id" in documento:
        try:
            await delete_from_drive(documento["drive_file_id"])
        except Exception as e:
            # Logueamos el error pero seguimos para no dejar basura en la DB
            print(f"Error al eliminar en Drive: {e}")

    # 2. ELIMINAR DE MONGODB
    await doc_teg_inf_collection.delete_one({"_id": object_id})
    
    await registrar_log(current_user["correo"], "ELIMINACION DE DOCUMENTO", f"Eliminó tesis: {documento.get('titulo')}")

    return {"detail": "Documento y archivo eliminados correctamente"}


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    titulo: Optional[str] = Form(None),
    autores: Optional[str] = Form(None),
    tutor: Optional[str] = Form(None),
    tipo_documento: Optional[str] = Form(None),
    periodo_academico: Optional[str] = Form(None),
    resumen: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    x_control_key: str = Header(...),
    current_user: dict = Depends(get_current_user)
):
    """Actualiza datos del documento de forma limpia"""
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    try:
        object_id = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de documento inválido")

    # 1. Buscar el documento actual
    documento_original = await doc_teg_inf_collection.find_one({"_id": object_id})
    if not documento_original:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # 2. Construir el diccionario de actualización (solo lo que viene en el Form)
    update_dict = {}
    
    if titulo is not None: update_dict["titulo"] = titulo
    if autores is not None: update_dict["autores"] = [a.strip() for a in autores.split(",")]
    if tutor is not None: update_dict["tutor"] = tutor
    if tipo_documento is not None: update_dict["tipo_documento"] = tipo_documento
    if periodo_academico is not None: update_dict["periodo_academico"] = periodo_academico
    if resumen is not None: update_dict["resumen"] = resumen

    # 3. Si hay un archivo nuevo, actualizar en Drive
    if file:
        try:
            content = await file.read()
            # Actualizamos en Drive y obtenemos el nuevo link/id
            drive_res = await update_drive_file(
                documento_original["drive_file_id"], 
                content, 
                file.filename
            )
            update_dict["archivo_url"] = drive_res['link']
            update_dict["drive_file_id"] = drive_res['file_id']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error en Drive: {str(e)}")

    # 4. RECALCULAR EMBEDDING (Solo si cambió título, resumen o hay archivo nuevo)
    if any(k in update_dict for k in ["titulo", "resumen"]) or file:
        # Usamos lo nuevo si existe, si no, lo que ya estaba en la DB
        t = update_dict.get("titulo", documento_original.get("titulo"))
        r = update_dict.get("resumen", documento_original.get("resumen"))
        
        ai_service = AIService()
        texto_ia = f"Título: {t}. Resumen: {r}"
        
        embedding_raw = await ai_service.generate_embedding(texto_ia)
        update_dict["vector_embedding"] = embedding_raw.tolist() if hasattr(embedding_raw, "tolist") else embedding_raw

    # 5. Ejecutar la actualización en MongoDB
    if update_dict:
        # Importante: Usamos $set para que solo toque los campos enviados
        await doc_teg_inf_collection.update_one(
            {"_id": object_id}, 
            {"$set": update_dict}
        )
        await registrar_log(current_user["correo"], "EDICION DE DOCUMENTO", f"Editó tesis: {documento_original.get('titulo')}")

    return {"detail": "Documento actualizado exitosamente"}

@router.get("/")
async def list_documents(
    offset: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1),
    tipo_documento: Optional[str] = Query(None),
    periodo_academico: Optional[str] = Query(None)
):
    # Construir filtro dinámico
    filtro = {}
    if tipo_documento:
        filtro["tipo_documento"] = tipo_documento
    if periodo_academico:
        filtro["periodo_academico"] = periodo_academico

    cursor = doc_teg_inf_collection.find(filtro, {"vector_embedding": 0})
    documentos = []
    async for doc in cursor.skip(offset).limit(limit):
        doc["id"] = str(doc.pop("_id"))
        documentos.append(doc)
    return documentos

@router.get("/periodos")
async def list_periodos():
    periodos = await doc_teg_inf_collection.distinct("periodo_academico")
    cleaned = [p for p in periodos if p]
    return {"periodos": sorted(cleaned)}

@router.get("/audit-logs")
async def list_audit_logs(current_user: dict = Depends(require_superadmin)):
    logs_collection = doc_teg_inf_collection.database["logs"]
    cursor = logs_collection.find({}).sort("fecha", -1)
    logs = []
    async for log in cursor:
        log["id"] = str(log.pop("_id"))
        logs.append(log)
    return logs
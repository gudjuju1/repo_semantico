from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from bson.objectid import ObjectId
from app.api.auth import require_superadmin, get_current_user
from app.db.session import usuarios_collection
from app.core.security import hash_password, hash_control_key, verify_control_key
from app.services.log_service import registrar_log

router = APIRouter()

# --- ESQUEMAS ---

class UsuarioCreate(BaseModel):
    nombre: str
    correo: EmailStr
    password: str
    llave_seguridad: str

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    correo: Optional[EmailStr] = None
    password: Optional[str] = None
    llave_seguridad: Optional[str] = None

# --- ENDPOINTS ---

@router.get("/")
async def list_users(
    offset: int = Query(0, ge=0), 
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_superadmin)
):
    """Lista todos los usuarios (Solo SuperAdmin)"""
    cursor = usuarios_collection.find({}, {"password_hash": 0, "llave_seguridad_hash": 0})
    usuarios = []
    async for u in cursor.skip(offset).limit(limit):
        u["id"] = str(u.pop("_id"))
        usuarios.append(u)
    return usuarios

@router.post("/")
async def create_user(
    user: UsuarioCreate,
    x_control_key: str = Header(...),
    current_user: dict = Depends(require_superadmin)
):
    """Crea un nuevo administrador (Requiere PIN del SuperAdmin)"""
    # Verificar la Llave de Control del SuperAdmin que está operando
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    existe = await usuarios_collection.find_one({"correo": user.correo})
    if existe:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    usuario_db = {
        "nombre": user.nombre,
        "correo": user.correo,
        "password_hash": hash_password(user.password),
        "llave_seguridad_hash": hash_control_key(user.llave_seguridad),
        "rol": "admin"  # Rol forzado
    }
    
    result = await usuarios_collection.insert_one(usuario_db)
    await registrar_log(current_user["correo"], "CREAR_USUARIO", f"Creó usuario admin: {user.correo}")
    
    return {
        "message": f"Usuario '{user.nombre}' registrado exitosamente",
        "id": str(result.inserted_id)
    }

@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    update: UsuarioUpdate,
    x_control_key: str = Header(...),
    current_user: dict = Depends(require_superadmin)
):
    """Edita un usuario (Requiere PIN del SuperAdmin)"""
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de usuario inválido")

    user_db = await usuarios_collection.find_one({"_id": object_id})
    if not user_db:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    update_dict = update.dict(exclude_unset=True)
    update_dict.pop("rol", None)  # Protegemos el rol

    if "password" in update_dict:
        update_dict["password_hash"] = hash_password(update_dict.pop("password"))
    if "llave_seguridad" in update_dict:
        update_dict["llave_seguridad_hash"] = hash_control_key(update_dict.pop("llave_seguridad"))

    if not update_dict:
        raise HTTPException(status_code=400, detail="No hay campos válidos para actualizar")

    await usuarios_collection.update_one({"_id": object_id}, {"$set": update_dict})
    await registrar_log(current_user["correo"], "EDITAR_USUARIO", f"Editó usuario: {user_db['correo']}")
    
    return {"detail": "Usuario actualizado exitosamente"}

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    x_control_key: str = Header(...),
    current_user: dict = Depends(require_superadmin)
):
    """Elimina un usuario (Requiere PIN del SuperAdmin)"""
    if not verify_control_key(x_control_key, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de Control inválida")

    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="El SuperAdmin no puede auto-eliminarse")

    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de usuario inválido")

    user_db = await usuarios_collection.find_one({"_id": object_id})
    if not user_db:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    await usuarios_collection.delete_one({"_id": object_id})
    await registrar_log(current_user["correo"], "ELIMINAR_USUARIO", f"Eliminó usuario: {user_db['correo']}")
    
    return {"detail": "Usuario eliminado exitosamente"}

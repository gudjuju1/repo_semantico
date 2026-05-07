
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import JWTError, jwt
import os
from ..core.security import verify_password, create_access_token, verify_control_key

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key")
ALGORITHM = "HS256"

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    correo: str
    password: str

class VerifyKeyRequest(BaseModel):
    llave_seguridad: str

# Utilidad para obtener usuario por correo
async def get_user_by_email(correo: str):
    from app.db.session import usuarios_collection
    user = await usuarios_collection.find_one({"correo": correo})
    return user

# Endpoint de login
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token_data = {"sub": user["correo"], "rol": user["rol"]}
    access_token = create_access_token(token_data)
    return {"access_token": access_token, "token_type": "bearer"}

# Dependencia para obtener usuario autenticado desde JWT
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="No se pudo validar el token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        correo: str = payload.get("sub")
        if correo is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user_by_email(correo)
    if user is None:
        raise credentials_exception
    return user

# Endpoint para verificar la llave de control
@router.post("/verify-key")
async def verify_key(request: VerifyKeyRequest, current_user: dict = Depends(get_current_user)):
    if not verify_control_key(request.llave_seguridad, current_user["llave_seguridad_hash"]):
        raise HTTPException(status_code=401, detail="Llave de control incorrecta")
    return {"detail": "Llave de control válida"}

def require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get('rol') != 'super_admin':
        raise HTTPException(
            status_code=403, 
            detail='Acceso denegado: Se requieren permisos de SuperAdmin'
        )
    return current_user

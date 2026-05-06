from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl, EmailStr

# Modelo para doc_teg_inf
class DocTegInf(BaseModel):
    titulo: str
    autores: List[str]
    tutor: str
    tipo_documento: str  # "TEG" o "Informe"
    periodo_academico: str
    resumen: str
    # El enlace al PDF en Google Drive
    archivo_url: HttpUrl 
    # Mantenemos el vector para la búsqueda semántica
    vector_embedding: Optional[List[float]] = Field(None, min_items=384, max_items=384)

    class Config:
        schema_extra = {
            "example": {
                "titulo": "Prototipo de repositorio digital para la UGMA",
                "autores": ["Tu Nombre"],
                "tutor": "Nombre del Tutor",
                "tipo_documento": "TEG",
                "periodo_academico": "2026-I",
                "resumen": "Este proyecto implementa búsqueda semántica...",
                "archivo_url": "https://drive.google.com/file/d/12345/view"
            }
        }

class Usuario(BaseModel):
    correo: EmailStr
    nombre: str
    password_hash: str
    llave_seguridad_hash: str
    rol: str  # "admin" o "superadmin"

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "correo": "admin@ugma.edu.ve",
                    "nombre": "Administrador de Grado",
                    "password_hash": "$2b$12$EjemploDeHashBcryptNoReal...",
                    "llave_seguridad_hash": "$2b$12$OtroHashParaElPin...",
                    "rol": "admin"
                }
            ]
        }
    }
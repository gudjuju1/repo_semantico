from fastapi import FastAPI
from app.api import auth, documents, search

app = FastAPI()

# Incluir rutas de autenticación
app.include_router(auth.router, prefix="/auth", tags=["auth"])

# Incluir rutas de documentos
app.include_router(documents.router, prefix="/documents", tags=["documents"])

# Incluir rutas de búsqueda
app.include_router(search.router, prefix="/search", tags=["Búsqueda"])
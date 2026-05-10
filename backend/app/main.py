from fastapi import FastAPI
from app.api import auth, documents, search, users
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5175", "http://localhost:5173", "http://localhost:5174"], # URLs del frontend
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, PUT, DELETE, etc.
    allow_headers=["*"], # Permite todos los headers (incluyendo tu x-control-key)
)

# Incluir rutas de autenticación
app.include_router(auth.router, prefix="/auth", tags=["auth"])

# Incluir rutas de documentos
app.include_router(documents.router, prefix="/documents", tags=["documents"])

# Incluir rutas de búsqueda
app.include_router(search.router, prefix="/search", tags=["Búsqueda"])

# Incluir rutas de usuarios
app.include_router(users.router, prefix="/users", tags=["Users"])
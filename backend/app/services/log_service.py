from datetime import datetime
from app.db.session import db

async def registrar_log(usuario_correo: str, accion: str, detalles: str):
    logs_collection = db["logs"]
    log_entry = {
        "fecha": datetime.utcnow().isoformat(),
        "usuario": usuario_correo,
        "accion": accion,
        "detalles": detalles
    }
    await logs_collection.insert_one(log_entry)
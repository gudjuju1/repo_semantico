import asyncio
import os
from getpass import getpass
from dotenv import load_dotenv
from app.db.session import usuarios_collection
from app.core.security import hash_password, hash_control_key

load_dotenv()

async def create_super_admin():
    print("--- Creación de usuario super_admin ---")
    correo = input("Correo: ")
    nombre = input("Nombre: ")
    password = getpass("Password: ")
    llave_seguridad = getpass("Llave de Control (PIN): ")

    password_hash = hash_password(password)
    llave_seguridad_hash = hash_control_key(llave_seguridad)

    usuario = {
        "correo": correo,
        "nombre": nombre,
        "password_hash": password_hash,
        "llave_seguridad_hash": llave_seguridad_hash,
        "rol": "super_admin"
    }

    # Verificar si ya existe
    existe = await usuarios_collection.find_one({"correo": correo})
    if existe:
        print("Ya existe un usuario con ese correo.")
        return

    await usuarios_collection.insert_one(usuario)
    print("Usuario super_admin creado exitosamente.")

if __name__ == "__main__":
    asyncio.run(create_super_admin())

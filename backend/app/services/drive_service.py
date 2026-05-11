import os
import io
import asyncio
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError

# Configuración desde variables de entorno
CLIENT_ID = os.getenv("DRIVE_CLIENT_ID")
CLIENT_SECRET = os.getenv("DRIVE_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("DRIVE_REFRESH_TOKEN")
FOLDER_ID = os.getenv("DRIVE_FOLDER_ID")
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    """
    Construye el servicio de Google Drive utilizando OAuth2 con Refresh Token.
    Ideal para entornos como Render donde no hay intervención manual.
    """
    if not all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN]):
        raise Exception("Error: Faltan variables de entorno para la autenticación de Drive (CLIENT_ID, CLIENT_SECRET o REFRESH_TOKEN).")

    try:
        # Construimos las credenciales directamente con el Refresh Token
        creds = Credentials(
            token=None,
            refresh_token=REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            scopes=SCOPES
        )
        return build('drive', 'v3', credentials=creds)
    except Exception as e:
        raise Exception(f"Error al inicializar las credenciales OAuth2: {str(e)}")

async def upload_to_drive(file_content: bytes, filename: str):
    """Sube un archivo PDF a la carpeta especificada en Drive"""
    def _upload():
        service = get_drive_service()
        file_metadata = {
            'name': filename, 
            'parents': [FOLDER_ID]
        }
        
        # Mimetype explícito para PDF como se solicitó
        media = MediaIoBaseUpload(
            io.BytesIO(file_content), 
            mimetype='application/pdf',
            resumable=True
        )
        
        # Ejecutamos la creación del archivo
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()

        # Configuramos permisos para que cualquiera con el link pueda verlo
        service.permissions().create(
            fileId=file['id'],
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        
        # Bloqueamos la descarga/copia para usuarios con permiso de lectura
        service.files().update(
            fileId=file['id'],
            body={'copyRequiresWriterPermission': True}
        ).execute()
        
        return {'file_id': file['id'], 'link': file['webViewLink']}

    # Usamos to_thread para no bloquear el loop de FastAPI
    return await asyncio.to_thread(_upload)

async def delete_from_drive(file_id: str):
    """Elimina un archivo de Drive dado su ID"""
    def _delete():
        service = get_drive_service()
        service.files().delete(fileId=file_id).execute()
    try:
        await asyncio.to_thread(_delete)
    except Exception as e:
        raise Exception(f"Error al eliminar archivo de Drive: {str(e)}")

async def update_drive_file(file_id: str, new_content: bytes, filename: str):
    """Actualiza el contenido y nombre de un archivo existente en Drive"""
    def _update():
        service = get_drive_service()
        
        file_metadata = {
            'name': filename,
            'copyRequiresWriterPermission': True
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(new_content), 
            mimetype='application/pdf', 
            resumable=True
        )
        
        file = service.files().update(
            fileId=file_id,
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()
        
        return {'file_id': file['id'], 'link': file['webViewLink']}

    try:
        return await asyncio.to_thread(_update)
    except Exception as e:
        raise Exception(f"Error al actualizar archivo en Drive: {str(e)}")

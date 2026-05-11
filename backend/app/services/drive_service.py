import os
import io
import json
import asyncio
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2 import service_account
from googleapiclient.errors import HttpError

# Configuración
# El usuario pidió explícitamente usar DRIVE_FOLDER_ID
FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    """
    Obtiene el servicio de Google Drive usando una Service Account.
    Las credenciales se leen desde la variable de entorno GOOGLE_CREDENTIALS_JSON.
    """
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        raise Exception("Error: La variable de entorno GOOGLE_CREDENTIALS_JSON no está definida.")
    
    try:
        creds_info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_info, 
            scopes=SCOPES
        )
        return build('drive', 'v3', credentials=creds)
    except Exception as e:
        raise Exception(f"Error al inicializar las credenciales de la Service Account: {str(e)}")

async def upload_to_drive(file_content: bytes, filename: str):
    def _upload():
        service = get_drive_service()
        file_metadata = {
            'name': filename, 
            'parents': [FOLDER_ID]
        }
        media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype='application/pdf')
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()

        # Dar permisos de lectura a cualquiera con el link
        service.permissions().create(
            fileId=file['id'],
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        
        # Bloquear la descarga/copia para lectores (copyRequiresWriterPermission)
        service.files().update(
            fileId=file['id'],
            body={'copyRequiresWriterPermission': True}
        ).execute()
        
        return {'file_id': file['id'], 'link': file['webViewLink']}

    return await asyncio.to_thread(_upload)

async def delete_from_drive(file_id: str):
    def _delete():
        service = get_drive_service()
        service.files().delete(fileId=file_id).execute()
    try:
        await asyncio.to_thread(_delete)
    except Exception as e:
        raise Exception(f"Error al eliminar archivo de Drive: {str(e)}")

async def update_drive_file(file_id: str, new_content: bytes, filename: str):
    """Actualiza el contenido de un archivo existente en Drive"""
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

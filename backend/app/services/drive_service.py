import os
import io
import pickle
import asyncio
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError # Faltaba esta importación

# Configuración
FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
SCOPES = ['https://www.googleapis.com/auth/drive.file']

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT_SECRETS_FILE = os.path.join(BASE_DIR, 'client_secrets.json')
TOKEN_PICKLE = os.path.join(BASE_DIR, 'token.pickle')

def get_drive_service():
    creds = None
    if os.path.exists(TOKEN_PICKLE):
        with open(TOKEN_PICKLE, 'rb') as token:
            creds = pickle.load(token)
            
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_PICKLE, 'wb') as token:
            pickle.dump(creds, token)

    return build('drive', 'v3', credentials=creds)

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

        service.permissions().create(
            fileId=file['id'],
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        
        # Google Drive API requiere que esto se haga mediante update
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
        # Usamos Exception genérica o HttpError si prefieres ser específico
        raise Exception(f"Error al eliminar archivo de Drive: {str(e)}")

async def update_drive_file(file_id: str, new_content: bytes, filename: str):
    """Actualiza el contenido de un archivo existente en Drive"""
    def _update():
        service = get_drive_service()
        
        # Metadata opcional: por si quieres actualizar el nombre también, y bloqueamos descargas
        file_metadata = {
            'name': filename,
            'copyRequiresWriterPermission': True
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(new_content), 
            mimetype='application/pdf', 
            resumable=True
        )
        
        # Realizamos el update
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

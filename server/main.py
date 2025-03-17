from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os
import aiofiles
from typing import List, Optional
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="AI Chat Recorder Server")

# Setup CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories if they don't exist
os.makedirs("data/images", exist_ok=True)
os.makedirs("data/attachments", exist_ok=True)

# Mount static files directory
app.mount("/files", StaticFiles(directory="data"), name="files")

# Database setup
DATABASE_URL = "sqlite+aiosqlite:///./data/chats.db"
Base = declarative_base()

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String)
    title = Column(String)
    url = Column(String)
    captured_at = Column(DateTime, default=datetime.utcnow)
    messages = Column(JSON)
    
# Create database tables
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@app.post("/api/chats")
async def save_chat(chat_data: dict):
    """Save a chat with its associated images and attachments."""
    try:
        logger.info(f"Saving chat from {chat_data.get('platform')} with {len(chat_data.get('messages', []))} messages")
        
        # Process and save images from messages
        for msg in chat_data.get("messages", []):
            if "images" in msg:
                processed_images = []
                for img in msg["images"]:
                    if img.get("originalSrc"):
                        # Generate unique filename
                        filename = f"images/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{len(processed_images)}.png"
                        filepath = f"data/{filename}"
                        
                        # Save image data
                        async with aiofiles.open(filepath, 'wb') as f:
                            await f.write(img["data"])
                        
                        # Update image reference
                        img["savedPath"] = f"/files/{filename}"
                        del img["data"]  # Remove binary data after saving
                        processed_images.append(img)
                
                msg["images"] = processed_images
        
        # Save to database
        db = SessionLocal()
        chat = Chat(
            platform=chat_data["platform"],
            title=chat_data["title"],
            url=chat_data["url"],
            captured_at=datetime.fromisoformat(chat_data["capturedAt"]),
            messages=chat_data["messages"]
        )
        db.add(chat)
        await db.commit()
        
        return {"success": True, "chat_id": chat.id}
        
    except Exception as e:
        logger.error(f"Error saving chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats")
async def list_chats():
    """List all saved chats."""
    try:
        db = SessionLocal()
        chats = await db.query(Chat).order_by(Chat.captured_at.desc()).all()
        return [
            {
                "id": chat.id,
                "platform": chat.platform,
                "title": chat.title,
                "url": chat.url,
                "captured_at": chat.captured_at.isoformat(),
                "message_count": len(chat.messages)
            }
            for chat in chats
        ]
    except Exception as e:
        logger.error(f"Error listing chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: int):
    """Get a specific chat by ID."""
    try:
        db = SessionLocal()
        chat = await db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        return {
            "id": chat.id,
            "platform": chat.platform,
            "title": chat.title,
            "url": chat.url,
            "captured_at": chat.captured_at.isoformat(),
            "messages": chat.messages
        }
    except Exception as e:
        logger.error(f"Error getting chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: int):
    """Delete a specific chat and its associated files."""
    try:
        db = SessionLocal()
        chat = await db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Delete associated files
        for msg in chat.messages:
            if "images" in msg:
                for img in msg["images"]:
                    if "savedPath" in img:
                        filepath = f"data/{img['savedPath'].split('/files/')[1]}"
                        try:
                            os.remove(filepath)
                        except Exception as e:
                            logger.warning(f"Failed to delete file {filepath}: {str(e)}")
        
        # Delete from database
        await db.delete(chat)
        await db.commit()
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000) 
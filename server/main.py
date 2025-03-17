from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncAttrs
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, JSON, DateTime
from datetime import datetime
import json
import os
import aiofiles
from typing import List, Optional
import logging
from sqlalchemy.sql import select
import asyncio
from pydantic import BaseModel
import time
import uuid

# Setup logging with more detailed format
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

# Add middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - Duration: {duration:.2f}s - Status: {response.status_code}")
    return response

# Setup CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Create directories if they don't exist
os.makedirs("data/images", exist_ok=True)
os.makedirs("data/attachments", exist_ok=True)
os.makedirs("data/text", exist_ok=True)  # Add directory for text attachments

# Mount static files directory
app.mount("/files", StaticFiles(directory="data"), name="files")

# Define Base class with AsyncAttrs
class Base(DeclarativeBase, AsyncAttrs):
    pass

# Database setup
DATABASE_URL = "sqlite+aiosqlite:///./data/chats.db"
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True
)
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Pydantic models for request validation
class ChatMessage(BaseModel):
    role: str
    content: str
    images: Optional[List[dict]] = []
    textAttachments: Optional[List[dict]] = []
    codeBlocks: Optional[List[dict]] = []
    timestamp: str

class ChatData(BaseModel):
    platform: str
    title: str
    url: str
    messages: List[ChatMessage]
    capturedAt: str

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String)
    title = Column(String)
    url = Column(String)
    captured_at = Column(DateTime, default=datetime.utcnow)
    messages = Column(JSON)

# Create database tables
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("startup")
async def startup():
    logger.info("Starting up server...")
    await init_db()
    logger.info("Database initialized")

@app.post("/api/images")
async def upload_image(file: UploadFile = File(...)):
    """Handle image upload and return the saved path."""
    try:
        # Generate unique filename
        filename = f"{uuid.uuid4()}.png"
        filepath = f"data/images/{filename}"
        
        # Ensure directory exists
        os.makedirs("data/images", exist_ok=True)
        
        # Save the file
        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        return {"path": f"/files/images/{filename}"}
    except Exception as e:
        logger.error(f"Error uploading image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text")
async def save_text_content(request: Request):
    """Handle text content upload and return the saved path."""
    try:
        # Parse the request body
        data = await request.json()
        
        if "content" not in data or not data["content"]:
            raise HTTPException(status_code=400, detail="Text content is required")
            
        # Generate unique filename
        filename = f"{uuid.uuid4()}.txt"
        filepath = f"data/text/{filename}"
        
        # Ensure directory exists
        os.makedirs("data/text", exist_ok=True)
        
        # Save the text content
        async with aiofiles.open(filepath, 'w', encoding='utf-8') as f:
            await f.write(data["content"])
        
        return {"path": f"/files/text/{filename}"}
    except Exception as e:
        logger.error(f"Error saving text content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chats")
async def save_chat(chat_data: ChatData):
    """Save a chat with its associated images."""
    try:
        logger.info(f"Received chat save request - Platform: {chat_data.platform}, Messages: {len(chat_data.messages)}")
        
        # Save to database
        async with async_session() as session:
            chat = Chat(
                platform=chat_data.platform,
                title=chat_data.title,
                url=chat_data.url,
                captured_at=datetime.fromisoformat(chat_data.capturedAt),
                messages=json.loads(chat_data.json())["messages"]
            )
            session.add(chat)
            await session.commit()
            logger.info(f"Chat saved successfully with ID: {chat.id}")
            return {"success": True, "chat_id": chat.id}
        
    except Exception as e:
        logger.error(f"Error saving chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats")
async def list_chats():
    """List all saved chats."""
    try:
        async with async_session() as session:
            result = await session.execute(
                select(Chat).order_by(Chat.captured_at.desc())
            )
            chats = result.scalars().all()
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
        async with async_session() as session:
            result = await session.execute(
                select(Chat).filter(Chat.id == chat_id)
            )
            chat = result.scalar_one_or_none()
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
        async with async_session() as session:
            result = await session.execute(
                select(Chat).filter(Chat.id == chat_id)
            )
            chat = result.scalar_one_or_none()
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
                if "textAttachments" in msg:
                    for txt in msg["textAttachments"]:
                        if "savedPath" in txt:
                            filepath = f"data/{txt['savedPath'].split('/files/')[1]}"
                            try:
                                os.remove(filepath)
                            except Exception as e:
                                logger.warning(f"Failed to delete file {filepath}: {str(e)}")
            
            # Delete from database
            await session.delete(chat)
            await session.commit()
            
            return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    # Create the database tables
    asyncio.run(init_db())
    
    # Run the FastAPI application
    uvicorn.run(app, host="127.0.0.1", port=8000) 
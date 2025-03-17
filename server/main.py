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
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories if they don't exist
os.makedirs("data/images", exist_ok=True)
os.makedirs("data/attachments", exist_ok=True)

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

@app.post("/api/chats")
async def save_chat(chat_data: ChatData):
    """Save a chat with its associated images and attachments."""
    try:
        logger.info(f"Received chat save request - Platform: {chat_data.platform}, Messages: {len(chat_data.messages)}")
        
        # Process and save images from messages
        for msg in chat_data.messages:
            if msg.images:
                processed_images = []
                for img in msg.images:
                    if img.get("originalSrc"):
                        # Generate unique filename
                        filename = f"images/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{len(processed_images)}.png"
                        filepath = f"data/{filename}"
                        
                        logger.info(f"Processing image: {img.get('originalSrc')} -> {filepath}")
                        
                        # Save image data
                        if "data" in img:
                            async with aiofiles.open(filepath, 'wb') as f:
                                await f.write(img["data"])
                            
                            # Update image reference
                            img["savedPath"] = f"/files/{filename}"
                            del img["data"]  # Remove binary data after saving
                            processed_images.append(img)
                            logger.info(f"Image saved successfully: {filepath}")
                        else:
                            logger.warning(f"No image data found for {img.get('originalSrc')}")
                
                msg.images = processed_images
        
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
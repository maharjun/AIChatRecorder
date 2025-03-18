# AI Chat Recorder

## Project Overview

AI Chat Recorder is a comprehensive browser extension that enables users to capture, save, and manage conversations from popular AI assistants such as ChatGPT (OpenAI) and Claude. The extension is designed to preserve the full context of AI interactions, including text, code blocks, images, and file attachments.

## Key Features

- **Multi-platform Support**: Works with major AI platforms including ChatGPT and Claude
- **Complete Conversation Capture**: Records all messages from both user and AI assistant
- **Media Preservation**: Saves images and file attachments included in conversations
- **Local Storage**: Stores conversations locally with options for export and import
- **Organized History**: Maintains a searchable history of saved conversations
- **Viewer Interface**: Provides a clean interface for reviewing past conversations

## Technical Architecture

The project consists of two main components:

1. **Browser Extension**:
   - Content scripts that detect and extract conversation data from supported AI platforms
   - Background service worker for managing extension state and operations
   - User interface components (popup, options page, viewer)

2. **Backend Server**:
   - FastAPI server for handling file storage and database operations
   - Supports persistent storage of conversations and attachments
   - Provides API endpoints for the extension to store and retrieve data

## Data Structure and Storage

The project uses a structured data format to store AI conversations:

1. **Database Schema**:
   - Uses SQLite with async support (aiosqlite)
   - Main table "chats" with the following columns:
     - `id`: Unique identifier for each saved conversation
     - `platform`: Source AI platform (e.g., 'openai', 'claude')
     - `title`: Conversation title
     - `url`: Original URL of the conversation
     - `captured_at`: Timestamp when the conversation was saved
     - `messages`: JSON column storing the conversation content

2. **Message Format**:
   Each conversation contains an array of messages with the following structure:
   ```json
   {
     "role": "user" or "assistant",
     "content": "The text content of the message",
     "images": [
       {
         "type": "image",
         "originalSrc": "Original URL of the image",
         "originalFilename": "Original filename or identifier",
         "alt": "Description or identifier of the image",
         "savedPath": "images/[uuid].png"
       }
     ],
     "textAttachments": [
       {
         "type": "text",
         "title": "Name or identifier of the text attachment",
         "content": "The actual text content",
         "originalFilename": "Original filename or identifier",
         "savedPath": "text/[uuid].txt"
       }
     ],
     "timestamp": "ISO timestamp of the message"
   }
   ```

3. **File Storage**:
   - Images are stored in the `data/images/` directory with UUID-based filenames (e.g., `data/images/550e8400-e29b-41d4-a716-446655440000.png`)
   - Text attachments are stored in the `data/text/` directory with UUID-based filenames (e.g., `data/text/550e8400-e29b-41d4-a716-446655440000.txt`)
   - Other attachments are stored in the `data/attachments/` directory
   - All files are accessible via the server's static file endpoint (`/files/`)
   - When a chat is deleted, associated attachment files are automatically removed from the filesystem

4. **Data Extraction Process**:
   - For images: The extension captures the image from the AI interface, uploads it to the server via the `/api/images` endpoint, and stores the returned path
   - For text attachments: The extension extracts text content from file previews, uploads it to the server via the `/api/text` endpoint, and stores the returned path
   - Provider-specific extractors (e.g., ClaudeDataRetriever, OpenAIDataRetriever) implement specialized methods to handle the unique UI patterns of each AI platform
   - Data is validated for consistency before being saved to the database

## Implementation Details

- Built as a Chrome Extension using Manifest V3
- Uses modular JavaScript architecture for platform-specific data extraction
- Implements a Python-based server with SQL database for persistent storage
- Provides a responsive UI for viewing and managing saved conversations

## Status

This project is currently under development. Additional AI platforms and features are planned for future releases. 
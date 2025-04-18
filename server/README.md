# AI Chat Recorder

A Chrome extension with a client-server architecture that allows you to save conversations from ChatGPT and Claude AI, including any attachments like images or PDFs.

## System Architecture

The system consists of two main components:
1. Chrome Extension (Client)
2. Python Server (Backend)

### Chrome Extension Features

- Save complete chat conversations from ChatGPT and Claude
- Automatically captures images and file attachments
- One-click interface for saving chats
- Built-in chat viewer and export functionality
- Real-time chat capture with image handling

### Server Features

- FastAPI-based REST API
- SQLite database for chat storage
- Automatic image and attachment handling
- Static file serving
- Background service capability
- Comprehensive logging

## Installation

### Server Setup

1. Ensure Python 3.8+ is installed
2. Navigate to the `server` directory
3. Run the server:
   ```bash
   python run_server.py
   ```

The server will:
- Create a virtual environment if needed
- Install required dependencies
- Start the FastAPI server on http://localhost:8000
- Create necessary directories for data storage

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension directory
4. Ensure the server is running before using the extension

## Usage

1. Start the Python server (if not already running)
2. Navigate to either ChatGPT or Claude AI in your browser
3. When you want to save a conversation:
   - Click the extension icon in your toolbar, or
   - Use the right-click context menu "Save AI Chat" option
4. View saved chats through the extension's viewer interface
5. Export chats as JSON files when needed

## Server API Endpoints

- `POST /api/chats` - Save a new chat
- `GET /api/chats` - List all saved chats
- `GET /api/chats/{chat_id}` - Get a specific chat
- `DELETE /api/chats/{chat_id}` - Delete a chat and its files

## Data Storage

- Database: `data/chats.db` (SQLite)
- Images: `data/images/`
- Attachments: `data/attachments/`
- Logs:
  - Server logs: `server.log`
  - Runner logs: `server_runner.log`

## File Format

The saved chat data includes:
- Timestamp of capture
- Platform identification (ChatGPT or Claude)
- Original chat URL
- All messages with their roles (human/assistant)
- Embedded images and attachments
- Code blocks with language identification

## Development

### Server Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run server directly
python main.py
```

API documentation available at:
- http://localhost:8000/docs
- http://localhost:8000/redoc

### Extension Development
The extension is built with vanilla JavaScript and uses:
- Chrome Extension APIs
- REST API communication
- Local storage for settings
- Custom UI for chat viewing

## Privacy & Security

This system:
- Only activates on ChatGPT and Claude websites
- Stores all data locally on your computer
- Uses a local server for data management
- Does not send data to external servers
- Only captures data from the current chat window

## Requirements

- Chrome browser
- Python 3.8+
- Local port 8000 available for server
- Sufficient disk space for chat storage

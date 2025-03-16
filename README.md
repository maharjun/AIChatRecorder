# AI Chat Recorder Chrome Extension

A Chrome extension that allows you to save conversations from ChatGPT and Claude AI, including any attachments like images or PDFs.

## Features

- Save complete chat conversations from ChatGPT and Claude
- Automatically captures images and file attachments
- Exports conversations as JSON files
- Keeps track of saved conversations
- Simple one-click interface

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the directory containing this extension

## Usage

1. Navigate to either ChatGPT or Claude AI in your browser
2. When you want to save a conversation, click the extension icon in your toolbar
3. Click the "Save Current Chat" button
4. Choose where to save the JSON file when prompted
5. The chat will be saved with all messages and attachments

## File Format

The saved JSON files contain:
- Timestamp of when the chat was saved
- Platform (ChatGPT or Claude)
- Original chat URL
- All messages with their roles (human/assistant)
- Links to any attachments (images, PDFs, etc.)

## Notes

- The extension needs permission to access ChatGPT and Claude websites
- Attachments are saved as URLs or data URLs when possible
- The extension keeps track of the last 100 saved conversations in local storage

## Privacy

This extension:
- Only activates on ChatGPT and Claude websites
- Does not send any data to external servers
- Stores data locally on your computer
- Only captures data from the current chat window 
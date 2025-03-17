# OpenAI Data Retrieval Algorithm

This document outlines the strategy for extracting conversation data from OpenAI's web interface (chatgpt.com). The algorithm will be implemented in the `OpenAIDataRetriever` class, which extends the base `AIDataRetriever` class.

## Overview

The OpenAI Data Retriever is designed to extract complete conversation history from the OpenAI web interface, including:
- User messages
- OpenAI's responses (including code blocks)
- Image attachments
- Timestamps

The algorithm uses DOM manipulation and clipboard operations to extract content that might not be directly accessible through simple DOM queries.

## Element Identification Strategies

Based on the HTML structure of OpenAI's interface, we can identify the following key elements:

### 1. Message Containers

OpenAI's chat interface organizes messages in `article` elements with specific attributes:

```html
<article class="group/turn w-full text-token-text-primary" dir="auto" data-testid="conversation-turn-X">
```

Where `X` is the turn number in the conversation. We can use the selector `article[data-testid^="conversation-turn-"]` to find all message containers.

### 2. User Messages

User messages can be identified by:

```html
<div data-message-author-role="user" data-message-id="...">
```

To extract the full content of user messages, we can use the "edit button" strategy:
1. Find the edit button within the user message container
2. Click the edit button to reveal the textarea with the full message content
3. Extract the content from the textarea
4. Click the "Cancel" button to exit edit mode

The edit button can be identified by:
```html
<button aria-label="Edit message" class="...">
```

And the cancel button by:
```html
<button class="btn relative btn-secondary">
    <div class="flex items-center justify-center">Cancel</div>
</button>
```

### 3. Assistant (OpenAI) Messages

Assistant messages can be identified by:
```html
<div data-message-author-role="assistant" data-message-id="...">
```

To extract the full content of assistant messages, we can use the "copy button" strategy:
1. Find the copy button associated with the assistant's message
2. Click the button to copy the content to the clipboard
3. Read the content from the clipboard

The copy button can be identified by:
```html
<button aria-label="Copy" data-testid="copy-turn-action-button">
```

This approach automatically captures all content including code blocks, as the copy button copies the entire formatted response.

### 4. Image Attachments

Images in the conversation can be identified by:
```html
<img alt="Uploaded image" class="..." src="...">
```

To extract and save images:
1. Find the image element
2. Extract the src attribute
3. Upload the image to the server
4. Store the reference to the saved image

For image popups, we need to handle:
```html
<div role="dialog" id="radix-:rXX:" data-state="open">
    <div class="relative max-h-[85vh] max-w-[90vw]">
        <img alt="Uploaded image" class="h-full w-full object-contain" src="...">
    </div>
</div>
```

## Algorithm Flow

### 1. Main Extraction Process

The main extraction process will be handled by the `extractChat()` method:

1. **Identify Message Containers**: Locate all message containers in the OpenAI interface using the selector `article[data-testid^="conversation-turn-"]`.

2. **Process Each Container**: For each container:
   - Determine if it's a user or assistant message by looking for `data-message-author-role` attributes
   - Extract message content using specialized methods based on the role
   - Extract any attached images

3. **Compile Results**: Compile the extracted data into a structured format with platform information, title, URL, messages, and timestamp.

### 2. User Message Extraction

User messages will be extracted using the `retrieveUserMessage()` method:

1. Find the edit button for the user message
2. Click the edit button to reveal the textarea
3. Extract the content from the textarea
4. Click the Cancel button to exit edit mode
5. If the edit button isn't found, fall back to using the element's inner text

### 3. Assistant Message Extraction

Assistant messages will be extracted using the `retrieveAIReply()` method:

1. Find the copy button associated with the assistant's message
2. Click the button to copy the content to the clipboard
3. Read the content from the clipboard
4. If the copy button isn't found, fall back to extracting content from the message container

### 4. Image Attachment Extraction

Image attachments will be extracted using the `retrieveImageAttachment()` method:

1. Find image elements within the message
2. Extract the image URL
3. Upload the image to the server
4. Return the image information including the saved path

## Challenges and Solutions

### 1. Dynamic Content

**Challenge**: OpenAI's interface uses dynamic content that can be difficult to access directly.

**Solution**: Use interactive strategies like clicking edit buttons and copy buttons to access the full content.

### 2. Clipboard Access

**Challenge**: Accessing clipboard content requires proper focus and permissions.

**Solution**: Carefully manage focus and use multiple fallback strategies for clipboard access.

### 3. Image Handling

**Challenge**: Images in OpenAI's interface can be complex to extract and save.

**Solution**: Use a direct extraction strategy and communicate with a background script to handle image uploads.

## Implementation Plan

1. Create the `OpenAIDataRetriever` class extending `AIDataRetriever`
2. Implement the `extractChat()` method to identify and process message containers
3. Implement specialized methods for extracting user messages, assistant messages, and attachments
4. Add error handling and fallback strategies
5. Test the implementation with various conversation types

The implementation will follow the same pattern as the Claude data retriever, adapting the selectors and extraction strategies to match OpenAI's interface structure. 
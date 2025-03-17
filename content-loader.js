// content-loader.js
// This is a non-module script that loads the module-based content.js

console.log('AI Chat Recorder: Content loader initializing');

// Get the extension's base URL
const extensionUrl = chrome.runtime.getURL('');

// Create a script element to load the module
const script = document.createElement('script');
script.type = 'module';
script.src = chrome.runtime.getURL('content.js');
script.onerror = (error) => {
    console.error('Failed to load content.js module:', error);
};

// Add the script to the page
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content loader received message:', request);
    
    if (request.action === 'extractChat') {
        // Forward the message to the page context
        window.postMessage({
            type: 'AI_CHAT_RECORDER_EXTRACT',
            data: request
        }, '*');
        
        // Send an immediate acknowledgment
        sendResponse({ status: 'extracting' });
    }
    
    return true; // Keep the message channel open
});

// Listen for messages from the page context
window.addEventListener('message', (event) => {
    // Only accept messages from the same frame
    if (event.source !== window) return;
    
    if (event.data.type === 'AI_CHAT_RECORDER_RESULT') {
        // Forward the result to the background script
        chrome.runtime.sendMessage({
            action: 'chatExtracted',
            data: event.data.data,
            error: event.data.error
        });
    }
    
    // Handle image upload requests
    if (event.data.type === 'AI_CHAT_RECORDER_UPLOAD_IMAGE') {
        const { requestId, imageUrl, filename } = event.data;
        
        console.log('Content loader received image upload request:', requestId);
        
        // Forward the request to the background script
        chrome.runtime.sendMessage({
            action: 'uploadImage',
            imageUrl: imageUrl,
            filename: filename
        }, response => {
            // Send the response back to the page context
            window.postMessage({
                type: 'AI_CHAT_RECORDER_IMAGE_RESULT',
                requestId: requestId,
                result: response,
                error: response?.error
            }, '*');
        });
    }
    
    // Handle text upload requests
    if (event.data.type === 'AI_CHAT_RECORDER_UPLOAD_TEXT') {
        const { requestId, textContent, filename } = event.data;
        
        console.log('Content loader received text upload request:', requestId, 'length:', textContent?.length || 0);
        
        // Forward the request to the background script
        chrome.runtime.sendMessage({
            action: 'uploadText',
            textContent: textContent,
            filename: filename
        }, response => {
            console.log('Received text upload response:', response);
            // Send the response back to the page context
            window.postMessage({
                type: 'AI_CHAT_RECORDER_TEXT_RESULT',
                requestId: requestId,
                result: response,
                error: response?.error
            }, '*');
        });
    }
}); 
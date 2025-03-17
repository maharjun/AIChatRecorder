// Create context menu items
function createContextMenu() {
    chrome.contextMenus.create({
        id: 'saveChatContextMenu',
        title: 'Save AI Chat',
        contexts: ['page'],
        documentUrlPatterns: [
            'https://chatgpt.com/*',
            'https://claude.ai/*'
        ]
    });
}

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('AI Chat Recorder extension installed');
    createContextMenu();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'saveChatContextMenu') {
        handleSaveChat(tab);
    }
});

// Check if a tab is ready for messaging
async function isTabReady(tab) {
    if (!tab) return false;
    
    try {
        // Try to execute a simple script to check if the page is loaded
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => true
        });
        return true;
    } catch (error) {
        console.error('Tab not ready:', error);
        return false;
    }
}

// Server configuration
const SERVER_URL = 'http://localhost:8000';

// Create notification helper function
function showNotification(title, message) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: title || 'AI Chat Recorder',
            message: message
        });
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

// Handle saving chat
async function handleSaveChat(tab) {
    try {
        // Check if we have a valid tab
        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        // Check if server is running
        try {
            const response = await fetch(`${SERVER_URL}/api/chats`);
            if (!response.ok) {
                throw new Error('Server not responding');
            }
        } catch (error) {
            throw new Error('Server not running. Please start the Python server first.');
        }

        // Check if the tab is ready
        const ready = await isTabReady(tab);
        if (!ready) {
            throw new Error('Tab not ready for messaging');
        }

        // Send message to content script
        console.log('Sending extractChat message to tab:', tab.id);
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'extractChat',
                attempt: Date.now()
            });

            console.log('Received initial response:', response);
            
            if (response.status !== 'extracting') {
                throw new Error('Failed to start chat extraction');
            }
        } catch (error) {
            console.error('Error sending message to content script:', error);
            // If the content script is not responding, it might not be loaded yet
            // This can happen if the user navigates to a page after the extension is loaded
            showNotification('AI Chat Recorder', 'Please refresh the page and try again.');
        }

    } catch (error) {
        console.error('Error initiating chat save:', error);
        showNotification('AI Chat Recorder', 'Error saving chat: ' + error.message);
    }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request.action, 'from:', sender);

    if (request.action === 'createDirectory') {
        // No longer needed as server handles directory creation
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'saveChat') {
        if (!sender.tab) {
            sendResponse({ error: 'No tab found' });
            return true;
        }
        handleSaveChat(sender.tab);
        return true;
    }

    if (request.action === 'downloadImage') {
        // Images are now handled by the server during chat save
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'chatExtracted') {
        console.log('Chat extraction completed, data received:', {
            hasError: !!request.error,
            hasData: !!request.data,
            platform: request.data?.platform,
            messageCount: request.data?.messages?.length
        });

        if (request.error) {
            console.error('Chat extraction error:', request.error);
            showNotification('AI Chat Recorder', 'Error saving chat: ' + request.error);
        } else if (request.data) {
            // Save chat to server
            fetch(`${SERVER_URL}/api/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request.data)
            })
            .then(response => response.json())
            .then(result => {
                console.log('Chat saved to server:', result);
                showNotification('AI Chat Recorder', 'Chat saved successfully!');
            })
            .catch(error => {
                console.error('Error saving chat to server:', error);
                showNotification('AI Chat Recorder', 'Error saving chat: ' + error.message);
            });
        }
    }

    if (request.action === 'uploadImage') {
        console.log('Background script received upload request for:', request.imageUrl);
        
        // Handle image upload
        (async () => {
            try {
                // Fetch the image
                const response = await fetch(request.imageUrl);
                const blob = await response.blob();

                // Create form data
                const formData = new FormData();
                formData.append('file', blob, request.filename);

                // Upload to server
                const uploadResponse = await fetch(`${SERVER_URL}/api/images`, {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image to server');
                }

                const result = await uploadResponse.json();
                console.log('Image upload successful:', result);
                sendResponse(result);
            } catch (error) {
                console.error('Failed to upload image:', error);
                sendResponse({ error: error.message });
            }
        })();

        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'uploadText') {
        console.log('Background script received text upload request for:', request.filename, 'length:', request.textContent?.length || 0);
        
        // Handle text upload
        (async () => {
            try {
                console.log('Sending text content to server...');
                // Upload to server
                const uploadResponse = await fetch(`${SERVER_URL}/api/text`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: request.textContent
                    })
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error('Server responded with error:', uploadResponse.status, errorText);
                    throw new Error(`Failed to upload text to server: ${uploadResponse.status} ${errorText}`);
                }

                const result = await uploadResponse.json();
                console.log('Text upload successful:', result);
                sendResponse(result);
            } catch (error) {
                console.error('Failed to upload text:', error);
                sendResponse({ error: error.message });
            }
        })();

        return true; // Keep the message channel open for async response
    }
}); 
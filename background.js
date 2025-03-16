// Create context menu items
function createContextMenu() {
    chrome.contextMenus.create({
        id: 'saveChatContextMenu',
        title: 'Save AI Chat',
        contexts: ['page'],
        documentUrlPatterns: [
            'https://chat.openai.com/*',
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

// Handle saving chat
async function handleSaveChat(tab) {
    try {
        // Check if we have a valid tab
        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        // Check if the tab is ready
        const ready = await isTabReady(tab);
        if (!ready) {
            throw new Error('Tab not ready for messaging');
        }

        // Inject content script if needed
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (error) {
            console.log('Content script already injected or injection failed:', error);
        }

        // Send message to content script
        console.log('Sending extractChat message to tab:', tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'extractChat',
            attempt: Date.now()
        });

        console.log('Received initial response:', response);
        
        if (response.status !== 'extracting') {
            throw new Error('Failed to start chat extraction');
        }

    } catch (error) {
        console.error('Error initiating chat save:', error);
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI Chat Recorder',
            message: 'Error saving chat: ' + error.message
        });
    }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request.action, 'from:', sender);

    if (request.action === 'createDirectory') {
        // Instead of creating a directory (which we can't do directly),
        // we'll just acknowledge the request. The downloads API will create
        // the directory when needed
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
        const { url, filename } = request;
        chrome.downloads.download({
            url: url,
            filename: `attachments/${filename}`,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });
        return true;
    }

    if (request.action === 'chatExtracted') {
        console.log('Chat extraction completed');
        if (request.error) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'AI Chat Recorder',
                message: 'Error saving chat: ' + request.error
            });
        } else if (request.data) {
            const timestamp = new Date().toISOString();
            const key = `chat_${timestamp}`;
            chrome.storage.local.set({ [key]: request.data })
                .then(() => {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon48.png',
                        title: 'AI Chat Recorder',
                        message: 'Chat saved successfully!'
                    });
                })
                .catch(error => {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon48.png',
                        title: 'AI Chat Recorder',
                        message: 'Error saving chat: ' + error.message
                    });
                });
        }
    }
}); 
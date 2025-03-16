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

// Handle saving chat
async function handleSaveChat(tab) {
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractChat' });
        if (response) {
            const timestamp = new Date().toISOString();
            const key = `chat_${timestamp}`;
            await chrome.storage.local.set({ [key]: response });
            
            // Show notification
            await chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'AI Chat Recorder',
                message: 'Chat saved successfully!'
            });
        }
    } catch (error) {
        console.error('Error saving chat:', error);
        // Show error notification
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AI Chat Recorder',
            message: 'Error saving chat: ' + error.message
        });
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveChat') {
        handleSaveChat(sender.tab);
    }
    // Must return true if response is async
    return true;
});

// Handle saving chat data
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveChat') {
    const chatData = request.data;
    
    // Generate a unique filename based on timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chat_${chatData.platform.toLowerCase()}_${timestamp}.json`;
    
    // Save chat data as JSON file
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      URL.revokeObjectURL(url);
    });
    
    // Also store in chrome.storage for future reference
    chrome.storage.local.get(['savedChats'], (result) => {
      const savedChats = result.savedChats || [];
      savedChats.push({
        timestamp: chatData.timestamp,
        platform: chatData.platform,
        url: chatData.url,
        filename: filename
      });
      
      // Keep only the last 100 entries
      if (savedChats.length > 100) {
        savedChats.shift();
      }
      
      chrome.storage.local.set({ savedChats: savedChats });
    });
  }
}); 
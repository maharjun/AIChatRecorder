document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('saveChat');
    const viewButton = document.getElementById('viewSaved');
    const statusDiv = document.getElementById('status');

    function showStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        statusDiv.className = `status ${isError ? 'error' : 'success'}`;
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    saveButton.addEventListener('click', async () => {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('chatgpt.com') && !tab.url.includes('claude.ai')) {
                showStatus('Please navigate to an OpenAI or Claude chat page', true);
                return;
            }

            // Extract chat data from the content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractChat' });
            
            if (!response) {
                showStatus('No chat data found', true);
                return;
            }

            // Save to chrome storage
            const timestamp = new Date().toISOString();
            const key = `chat_${timestamp}`;
            
            await chrome.storage.local.set({
                [key]: response
            });

            showStatus('Chat saved successfully!');
        } catch (error) {
            showStatus('Error saving chat: ' + error.message, true);
        }
    });

    viewButton.addEventListener('click', async () => {
        // Open a new tab with the saved chats viewer
        const viewerURL = chrome.runtime.getURL('viewer.html');
        await chrome.tabs.create({ url: viewerURL });
    });
}); 
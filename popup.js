document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('saveChat');
    const viewButton = document.getElementById('viewSaved');
    const statusDiv = document.getElementById('status');
    const serverStatusDiv = document.createElement('div');
    
    // Server configuration
    const SERVER_URL = 'http://localhost:8000';
    
    // Variables for controlling server status check
    let lastCheckTime = 0;
    const checkCooldown = 5000; // 5 seconds between checks
    let isMouseOverPopup = false;
    
    // Add server status indicator to the popup
    serverStatusDiv.className = 'server-status';
    serverStatusDiv.style.padding = '5px';
    serverStatusDiv.style.marginBottom = '10px';
    serverStatusDiv.style.borderRadius = '3px';
    serverStatusDiv.style.textAlign = 'center';
    serverStatusDiv.style.fontSize = '12px';
    
    // Populate popup-content div if it doesn't exist
    let popupContent = document.querySelector('.popup-content');
    if (!popupContent) {
        popupContent = document.createElement('div');
        popupContent.className = 'popup-content';
        document.body.appendChild(popupContent);
        popupContent.appendChild(saveButton);
        popupContent.appendChild(viewButton);
    }
    
    // Add server status indicator before the buttons
    popupContent.insertBefore(serverStatusDiv, saveButton);
    
    // Check server status when popup opens
    checkServerStatus();
    
    // Set up mouse enter/leave handlers for the popup
    document.body.addEventListener('mouseenter', () => {
        isMouseOverPopup = true;
        maybeCheckServerStatus();
    });
    
    document.body.addEventListener('mouseleave', () => {
        isMouseOverPopup = false;
    });

    function showStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        statusDiv.className = `status ${isError ? 'error' : 'success'}`;
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
    
    // Check if server is running, with timeout protection
    async function checkServerStatus() {
        try {
            // Update last check time
            lastCheckTime = Date.now();
            
            serverStatusDiv.textContent = 'Checking server...';
            serverStatusDiv.style.backgroundColor = '#f0f0f0';
            serverStatusDiv.style.color = '#333';
            
            // Add timeout to fetch to prevent long waits
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            try {
                const response = await fetch(`${SERVER_URL}/api/chats`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    serverStatusDiv.textContent = 'Server: Running \u2713';
                    serverStatusDiv.style.backgroundColor = '#e6f7e6';
                    serverStatusDiv.style.color = '#2e7d32';
                    saveButton.disabled = false;
                } else {
                    throw new Error('Server not responding');
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        } catch (error) {
            serverStatusDiv.textContent = 'Server: Not Running \u2717';
            serverStatusDiv.style.backgroundColor = '#fde9e9';
            serverStatusDiv.style.color = '#c62828';
            saveButton.disabled = true;
            
            console.error('Server check failed:', error);
        }
    }
    
    // Check server status if enough time has passed
    function maybeCheckServerStatus() {
        const now = Date.now();
        if (now - lastCheckTime >= checkCooldown && isMouseOverPopup) {
            checkServerStatus();
            
            // Schedule another check if mouse is still over
            setTimeout(() => {
                if (isMouseOverPopup) {
                    maybeCheckServerStatus();
                }
            }, checkCooldown);
        }
    }

    saveButton.addEventListener('click', async () => {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('chatgpt.com') && !tab.url.includes('claude.ai')) {
                showStatus('Please navigate to an OpenAI or Claude chat page', true);
                return;
            }
            
            // Force check server status before extraction
            await checkServerStatus();
            
            // Don't proceed if server is not running
            if (saveButton.disabled) {
                showStatus('Server not running. Please start the server first.', true);
                return;
            }

            // Extract chat data from the content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractChat' });
            
            if (!response) {
                showStatus('No chat data found', true);
                return;
            }

            showStatus('Chat extraction started');
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
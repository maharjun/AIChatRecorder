// content.js - Module version
console.log('AI Chat Recorder: Module initializing');

// Server configuration
const SERVER_URL = 'http://localhost:8000';

// Import AIDataRetriever base class
let AIDataRetriever;
try {
    AIDataRetriever = (await import('./AIDataRetriever.js')).default;
    console.log('AIDataRetriever loaded successfully');
} catch (error) {
    console.error('Failed to import AIDataRetriever:', error);
}

// Main function to extract chat data
async function extractChatData() {
    try {
        if (!AIDataRetriever) {
            throw new Error('AIDataRetriever module not loaded. Please refresh the page and try again.');
        }
        
        // Use the factory method to get the appropriate retriever
        const dataRetriever = await AIDataRetriever.createRetriever(SERVER_URL);
        return await dataRetriever.extractChatData();
    } catch (error) {
        console.error('Error extracting chat data:', error);
        return null;
    }
}

// Listen for messages from the content-loader
window.addEventListener('message', (event) => {
    // Only accept messages from the same frame
    if (event.source !== window) return;
    
    const message = event.data;
    
    if (message.type === 'AI_CHAT_RECORDER_EXTRACT') {
        console.log('Content module received extract request');
        
        // Create and show an overlay message
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '20px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.color = 'white';
        overlay.style.padding = '10px 20px';
        overlay.style.borderRadius = '5px';
        overlay.style.zIndex = '10000';
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.textContent = 'Click anywhere on the page to begin saving the chat...';
        document.body.appendChild(overlay);
        
        // Wait for a click on the document
        const clickHandler = () => {
            console.log('Document clicked, beginning extraction...');
            document.removeEventListener('click', clickHandler);
            document.body.removeChild(overlay);
            
            // Process the chat data and send it via a separate message
            extractChatData()
                .then(data => {
                    console.log('Chat data extracted:', data);
                    if (!data) {
                        throw new Error('Failed to extract chat data');
                    }
                    window.postMessage({
                        type: 'AI_CHAT_RECORDER_RESULT',
                        data: data
                    }, '*');
                })
                .catch(error => {
                    console.error('Error in extractChat:', error);
                    window.postMessage({
                        type: 'AI_CHAT_RECORDER_RESULT',
                        error: error.message
                    }, '*');
                    
                    // Show error as overlay
                    const errorOverlay = document.createElement('div');
                    errorOverlay.style.position = 'fixed';
                    errorOverlay.style.top = '20px';
                    errorOverlay.style.left = '50%';
                    errorOverlay.style.transform = 'translateX(-50%)';
                    errorOverlay.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
                    errorOverlay.style.color = 'white';
                    errorOverlay.style.padding = '10px 20px';
                    errorOverlay.style.borderRadius = '5px';
                    errorOverlay.style.zIndex = '10000';
                    errorOverlay.style.whiteSpace = 'pre-wrap';
                    errorOverlay.textContent = `Error: ${error.message}`;
                    document.body.appendChild(errorOverlay);
                    
                    // Remove error overlay after a delay
                    setTimeout(() => {
                        if (document.body.contains(errorOverlay)) {
                            document.body.removeChild(errorOverlay);
                        }
                    }, 3000);
                });
        };
        
        document.addEventListener('click', clickHandler);
    }
});


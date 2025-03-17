// Server configuration
const SERVER_URL = 'http://localhost:8000';

// Helper function to download image
async function downloadImage(imgElement) {
    console.log('Starting image download process for:', imgElement.src);
    try {
        // For data URLs and blob URLs, we need to fetch the data first
        let imageBlob;
        if (imgElement.src.startsWith('data:') || imgElement.src.startsWith('blob:')) {
            const response = await fetch(imgElement.src);
            imageBlob = await response.blob();
        } else {
            // For regular URLs, send them directly to the server
            return {
                originalSrc: imgElement.src,
                alt: imgElement.alt || ''
            };
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', imageBlob, 'image.png');

        // Upload to server
        const response = await fetch(`${SERVER_URL}/api/images`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to upload image to server');
        }

        const result = await response.json();
        console.log('Image upload successful:', result);

        return {
            originalSrc: imgElement.src,
            savedPath: result.path,
            alt: imgElement.alt || ''
        };
    } catch (error) {
        console.error('Failed to process image:', error);
        return null;
    }
}

// Function to detect which chat platform we're on
function detectPlatform() {
    if (window.location.hostname === 'chat.openai.com') {
        return 'openai';
    } else if (window.location.hostname === 'claude.ai') {
        return 'claude';
    }
    return null;
}

// Helper function to get clipboard content with focus handling
async function getClipboardContent() {
    try {
        // Focus the document first
        window.focus();
        
        // Request clipboard permission
        const permission = await navigator.permissions.query({ name: 'clipboard-read' });
        if (permission.state === 'denied') {
            throw new Error('Clipboard permission denied');
        }

        // Create a temporary textarea to handle clipboard operations
        const textarea = document.createElement('textarea');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        // Focus the textarea
        textarea.focus();
        
        // Execute copy command
        const successful = document.execCommand('paste');
        const text = textarea.value;
        
        // Clean up
        document.body.removeChild(textarea);
        
        if (!successful) {
            throw new Error('Clipboard paste failed');
        }
        
        return text;
    } catch (error) {
        console.error('Failed to read clipboard:', error);
        return null;
    }
}

// Helper function to trigger copy operation
async function triggerCopy(button) {
    try {
        // Focus the document and button
        window.focus();
        button.focus();
        
        // Click the copy button
        button.click();
        
        // Wait for the clipboard operation to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the clipboard content
        const text = await navigator.clipboard.readText();
        
        if (!text) {
            console.log('No text content received from clipboard');
            return null;
        }
        
        // Log first few characters to verify content
        console.log('Clipboard content preview:', text.substring(0, 100).replace(/\n/g, '\\n') + '...');
        console.log('Content length:', text.length);
        
        return text;
    } catch (error) {
        console.error('Failed to copy text:', error);
        return null;
    }
}

// Function to extract chat messages from Claude
async function extractClaudeChat() {
    console.log('Extracting Claude chat...');
    const messages = [];
    const messageContainers = document.querySelectorAll('div[data-test-render-count]');
    
    console.log('Found message containers:', messageContainers.length);
    if (!messageContainers.length) return null;

    for (const container of messageContainers) {
        console.log('Processing message container');
        
        // Find all elements with data-testid in this container
        const elements = container.querySelectorAll('[data-testid]');
        let messageContent = null;
        let messageRole = 'assistant';  // Default role
        const images = [];
        
        // Process each element with data-testid
        for (const element of elements) {
            const testId = element.getAttribute('data-testid');
            console.log('Found element with data-testid:', testId);
            
            if (testId === 'user-message') {
                // This is a user message
                messageRole = 'user';
                messageContent = element.innerText;
                console.log('Found user message');
            } else if (testId === 'action-bar-copy') {
                // This is Claude's message with a copy button
                const copyButton = element.closest('button');
                if (copyButton) {
                    console.log('Found copy button, attempting to copy');
                    messageContent = await triggerCopy(copyButton);
                }
            } else if (testId && !testId.startsWith('file-thumbnail') && !testId.startsWith('user-message')) {
                // This might be an image preview
                console.log('Found potential image:', testId);
                const previewButton = element.querySelector('button[data-testid="file-thumbnail"]');
                
                if (previewButton) {
                    try {
                        console.log('Found preview button for:', testId);
                        previewButton.click();
                        
                        // Wait for the popup to appear
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Find the popup image
                        const popup = document.querySelector('#headlessui-portal-root img[alt^="Preview of"]');
                        if (popup) {
                            console.log('Processing popup image:', popup.src);
                            try {
                                // Send message to background script to handle image upload
                                const result = await new Promise((resolve, reject) => {
                                    chrome.runtime.sendMessage({
                                        action: 'uploadImage',
                                        imageUrl: popup.src,
                                        filename: testId + '.png'
                                    }, response => {
                                        if (response.error) {
                                            reject(new Error(response.error));
                                        } else {
                                            resolve(response);
                                        }
                                    });
                                });

                                images.push({
                                    originalSrc: popup.src,
                                    alt: testId,
                                    savedPath: result.path
                                });
                                console.log('Successfully processed image:', popup.src);
                                
                                // Close the popup
                                const closeButton = document.querySelector('button[aria-label="Close image preview"]');
                                if (closeButton) {
                                    closeButton.click();
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            } catch (error) {
                                console.error('Failed to process popup image:', error);
                                images.push({
                                    originalSrc: popup.src,
                                    alt: testId
                                });
                            }
                        } else {
                            console.error('Popup image not found after clicking preview');
                        }
                    } catch (error) {
                        console.error('Failed to process image preview:', error);
                    }
                }
            }
        }
        
        // If we didn't get content from the copy button, try getting it from the message container
        if (!messageContent && messageRole === 'assistant') {
        const claudeMessage = container.querySelector('.font-claude-message');
        if (claudeMessage) {
                messageContent = claudeMessage.innerText;
                }
            }

            // Extract code blocks
        const codeBlocks = Array.from(container.querySelectorAll('pre code')).map(code => ({
            language: code.className.replace('language-', ''),
                code: code.textContent
            }));

        // Add the message if we have content
        if (messageContent) {
            messages.push({
                role: messageRole,
                content: messageContent,
                images: images,
                codeBlocks: codeBlocks,
                timestamp: new Date().toISOString()
            });
        }
    }

    return {
        platform: 'claude',
        title: document.title,
        url: window.location.href,
        messages: messages,
        captured_at: new Date().toISOString()
    };
}

// Function to extract chat messages from OpenAI
async function extractOpenAIChat() {
    const messages = [];
    const threadContainer = document.querySelector('main div.flex.flex-col');
    
    if (!threadContainer) return null;

    const messageElements = threadContainer.querySelectorAll('[data-message-author-role]');
    
    for (const messageEl of messageElements) {
        const role = messageEl.getAttribute('data-message-author-role');
        const contentEl = messageEl.querySelector('.markdown');
        
        if (!contentEl) continue;

        // Click copy button if available
        const copyButton = messageEl.querySelector('button[aria-label="Copy message"]');
        let markdownContent = null;
        if (copyButton) {
            copyButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            markdownContent = await getClipboardContent();
        }

        // Handle images
        const images = [];
        const imgElements = contentEl.querySelectorAll('img');
        for (const img of imgElements) {
            const imageInfo = await downloadImage(img);
            if (imageInfo) {
                images.push(imageInfo);
            }
        }

        // Extract code blocks
        const codeBlocks = Array.from(contentEl.querySelectorAll('pre code')).map(code => ({
            language: code.className.replace('language-', ''),
            code: code.textContent
        }));

        messages.push({
            role: role,
            content: markdownContent || contentEl.textContent,
            images: images,
            codeBlocks: codeBlocks,
            timestamp: new Date().toISOString()
        });
    }

    return {
        platform: 'openai',
        title: document.title,
        url: window.location.href,
        messages: messages,
        captured_at: new Date().toISOString()
    };
}

// Main function to extract chat data
async function extractChatData() {
    console.log('Extracting chat data...');
    const platform = detectPlatform();
    console.log('Detected platform:', platform);
    if (!platform) return null;

    try {
        let chatData;
        if (platform === 'claude') {
            chatData = await extractClaudeChat();
        } else if (platform === 'openai') {
            chatData = await extractOpenAIChat();
        }

        // Validate chat data structure
        if (chatData) {
            // Ensure all required fields are present
            chatData = {
                platform: chatData.platform,
                title: chatData.title || 'Untitled Chat',
                url: chatData.url,
                messages: chatData.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content || '',
                    images: msg.images || [],
                    codeBlocks: msg.codeBlocks || [],
                    timestamp: msg.timestamp
                })),
                capturedAt: chatData.captured_at || new Date().toISOString()
            };
            console.log('Validated chat data:', chatData);
        }

        return chatData;
    } catch (error) {
        console.error('Error extracting chat:', error);
        return null;
    }
}

// Add message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'extractChat') {
        console.log('Waiting for document click to begin extraction...');
        
        // First, send an immediate acknowledgment
        sendResponse({ status: 'extracting' });
        
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
                    chrome.runtime.sendMessage({
                        action: 'chatExtracted',
                        data: data
                    });
                })
                .catch(error => {
                    console.error('Error in extractChat:', error);
                    chrome.runtime.sendMessage({
                        action: 'chatExtracted',
                        error: error.message
                    });
                });
        };
        
        document.addEventListener('click', clickHandler);
        
        return true; // Keep the message channel open
    }
});


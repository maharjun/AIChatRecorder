// Helper function to extract attachments
async function extractAttachments() {
  const attachments = [];
  
  // For images
  const images = document.querySelectorAll('img[src^="data:"], img[src^="blob:"], img[src^="http"]');
  for (const img of images) {
    try {
      attachments.push({
        type: 'image',
        url: img.src,
        alt: img.alt || ''
      });
    } catch (error) {
      console.error('Error extracting image:', error);
    }
  }
  
  // For file attachments (PDFs, etc.)
  const fileLinks = document.querySelectorAll('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"]');
  for (const link of fileLinks) {
    attachments.push({
      type: 'file',
      url: link.href,
      name: link.textContent || link.href.split('/').pop()
    });
  }
  
  return attachments;
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

// Helper function to download image
async function downloadImage(imgElement) {
    try {
        // Click the image thumbnail to open full view
        const thumbnailButton = imgElement.closest('[data-testid^="render_"]').querySelector('[data-testid="file-thumbnail"]');
        thumbnailButton.click();
        
        // Wait for the full-size image to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the full-size image
        const fullImage = document.querySelector('#headlessui-dialog-\\:r32\\: img');
        if (!fullImage) {
            throw new Error('Full size image not found');
        }

        // Create a unique filename
        const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
        const originalName = fullImage.alt || 'image';
        const filename = `${timestamp}-${originalName}`;

        // Send download request to background script
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'downloadImage',
                url: fullImage.src,
                filename: filename
            }, resolve);
        });
        
        // Close the image preview
        const closeButton = document.querySelector('[data-testid="close-file-preview"]');
        if (closeButton) {
            closeButton.click();
        }
        
        // Wait for the dialog to close
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (response.success) {
            return {
                originalSrc: imgElement.src,
                savedPath: `attachments/${filename}`,
                alt: imgElement.alt || ''
            };
        } else {
            throw new Error(response.error || 'Failed to download image');
        }
    } catch (error) {
        console.error('Failed to download image:', error);
        return null;
    }
}

// Function to extract chat messages from Claude
async function extractClaudeChat() {
    console.log('Extracting Claude chat...');
    const messages = [];
    // Find all message containers in the chat
    const messageContainers = document.querySelectorAll('div[data-test-render-count]');
    
    console.log('Found message containers:', messageContainers.length);
    if (!messageContainers.length) return null;

    for (const container of messageContainers) {
        // Check for human message
        const humanMessage = container.querySelector('[data-testid="user-message"]');
        if (humanMessage) {
            console.log('Found human message');
            messages.push({
                role: 'human',
                content: humanMessage.textContent,
                timestamp: new Date().toISOString()
            });
        }

        // Check for Claude's message
        const claudeMessage = container.querySelector('.font-claude-message');
        if (claudeMessage) {
            console.log('Found Claude message');
            
            // Find the copy button's parent button element
            const copyButtonSvg = container.querySelector('[data-testid="action-bar-copy"]');
            const copyButton = copyButtonSvg?.closest('button');
            
            let markdownContent = null;
            if (copyButton) {
                console.log('Found copy button, attempting to copy');
                markdownContent = await triggerCopy(copyButton);
                if (markdownContent) {
                    console.log('Successfully got markdown content, length:', markdownContent.length);
                } else {
                    console.log('Failed to get markdown content, falling back to textContent');
                }
            } else {
                console.log('No copy button found');
            }
                
            // Handle images
            const images = [];
            const imgElements = claudeMessage.querySelectorAll('img');
            for (const img of imgElements) {
                const imageInfo = await downloadImage(img);
                if (imageInfo) {
                    images.push(imageInfo);
                }
            }

            // Extract code blocks
            const codeBlocks = Array.from(claudeMessage.querySelectorAll('pre code')).map(code => ({
                language: code.className,
                code: code.textContent
            }));

            messages.push({
                role: 'assistant',
                content: markdownContent || claudeMessage.textContent,
                images: images,
                codeBlocks: codeBlocks,
                timestamp: new Date().toISOString()
            });
        }
    }

    const result = {
        platform: 'claude',
        title: document.title,
        url: window.location.href,
        messages: messages,
        capturedAt: new Date().toISOString()
    };
    console.log('Extracted chat data:', result);
    return result;
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
        capturedAt: new Date().toISOString()
    };
}

// Main function to extract chat data
async function extractChatData() {
    console.log('Extracting chat data...');
    const platform = detectPlatform();
    console.log('Detected platform:', platform);
    if (!platform) return null;

    // Create attachments directory if needed
    try {
        await chrome.runtime.sendMessage({ 
            action: 'createDirectory', 
            path: 'attachments' 
        });
    } catch (error) {
        console.error('Error creating attachments directory:', error);
    }

    try {
        if (platform === 'claude') {
            return await extractClaudeChat();
        } else if (platform === 'openai') {
            return await extractOpenAIChat();
        }
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
        sendResponse({ status: 'waiting_for_click' });
        
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
        
        return false; // We've already sent our response
    }
}); 
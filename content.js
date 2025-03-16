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

// Function to extract chat messages from OpenAI
function extractOpenAIChat() {
    const messages = [];
    const threadContainer = document.querySelector('main div.flex.flex-col');
    
    if (!threadContainer) return null;

    const messageElements = threadContainer.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach(messageEl => {
        const role = messageEl.getAttribute('data-message-author-role');
        const contentEl = messageEl.querySelector('.markdown');
        
        if (!contentEl) return;

        // Extract text content
        const text = contentEl.textContent;

        // Extract images if any
        const images = Array.from(contentEl.querySelectorAll('img')).map(img => ({
            src: img.src,
            alt: img.alt
        }));

        // Extract code blocks if any
        const codeBlocks = Array.from(contentEl.querySelectorAll('pre code')).map(code => ({
            language: code.className.replace('language-', ''),
            code: code.textContent
        }));

        messages.push({
            role: role,
            content: text,
            images: images,
            codeBlocks: codeBlocks,
            timestamp: new Date().toISOString()
        });
    });

    return {
        platform: 'openai',
        title: document.title,
        url: window.location.href,
        messages: messages,
        capturedAt: new Date().toISOString()
    };
}

// Function to extract chat messages from Claude
function extractClaudeChat() {
    console.log('Extracting Claude chat...');
    const messages = [];
    // Find all message containers in the chat
    const messageContainers = document.querySelectorAll('div[data-test-render-count]');
    
    console.log('Found message containers:', messageContainers.length);
    if (!messageContainers.length) return null;

    messageContainers.forEach(container => {
        // Check for human message
        const humanMessage = container.querySelector('[data-testid="user-message"]');
        if (humanMessage) {
            console.log('Found human message:', humanMessage.textContent);
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
            // Extract text content
            const text = claudeMessage.textContent;

            // Extract code blocks if any
            const codeBlocks = Array.from(claudeMessage.querySelectorAll('pre code')).map(code => ({
                language: code.className,
                code: code.textContent
            }));

            // Extract images if any
            const images = Array.from(claudeMessage.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt
            }));

            messages.push({
                role: 'assistant',
                content: text,
                images: images,
                codeBlocks: codeBlocks,
                timestamp: new Date().toISOString()
            });
        }
    });

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

// Main function to extract chat data
function extractChatData() {
    console.log('Extracting chat data...');
    const platform = detectPlatform();
    console.log('Detected platform:', platform);
    if (!platform) return null;

    return platform === 'openai' ? extractOpenAIChat() : extractClaudeChat();
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    if (request.action === 'extractChat') {
        try {
            const chatData = extractChatData();
            console.log('Sending response:', chatData);
            sendResponse(chatData);
        } catch (error) {
            console.error('Error extracting chat:', error);
            sendResponse({ error: error.message });
        }
    }
    return true; // Keep the message channel open for the async response
}); 
// AIDataRetriever.js
// Base interface for AI chat data retrieval

/**
 * Base interface for retrieving data from AI chat interfaces
 * This class defines the methods that platform-specific implementations should provide
 */
class AIDataRetriever {
    constructor(serverUrl = 'http://localhost:8000') {
        this.SERVER_URL = serverUrl;
        
        // Ensure this class is not instantiated directly
        if (this.constructor === AIDataRetriever) {
            throw new Error("AIDataRetriever is an abstract class and cannot be instantiated directly");
        }
    }

    /**
     * Detect which AI platform we're on
     * @returns {string|null} The platform name or null if not recognized
     */
    static detectPlatform() {
        if (window.location.hostname === 'chat.openai.com') {
            return 'openai';
        } else if (window.location.hostname === 'claude.ai') {
            return 'claude';
        }
        return null;
    }

    /**
     * Factory method to create the appropriate retriever based on the platform
     * @param {string} serverUrl - The server URL
     * @returns {AIDataRetriever} The appropriate retriever instance
     */
    static createRetriever(serverUrl = 'http://localhost:8000') {
        const platform = AIDataRetriever.detectPlatform();
        
        if (platform === 'claude') {
            // Dynamically import the Claude implementation
            return import('./AI_providers/Claude/ClaudeDataRetriever.js')
                .then(module => new module.default(serverUrl));
        } else if (platform === 'openai') {
            // Dynamically import the OpenAI implementation
            return import('./AI_providers/OpenAI/OpenAIDataRetriever.js')
                .then(module => new module.default(serverUrl));
        }
        
        throw new Error(`Unsupported platform: ${window.location.hostname}`);
    }

    /**
     * Extract chat data from the current page
     * @returns {Promise<Object|null>} The extracted chat data or null if extraction failed
     */
    async extractChatData() {
        console.log('Extracting chat data...');
        
        try {
            const chatData = await this.extractChat();

            // Validate chat data structure
            if (chatData) {
                // Ensure all required fields are present
                const validatedData = {
                    platform: chatData.platform,
                    title: chatData.title || 'Untitled Chat',
                    url: chatData.url,
                    messages: chatData.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content || '',
                        images: msg.images || [],
                        textAttachments: msg.textAttachments || [],
                        timestamp: msg.timestamp
                    })),
                    capturedAt: chatData.captured_at || new Date().toISOString()
                };
                console.log('Validated chat data:', validatedData);
                return validatedData;
            }
            return null;
        } catch (error) {
            console.error('Error extracting chat:', error);
            return null;
        }
    }

    /**
     * Extract chat from the current interface - to be implemented by subclasses
     * @returns {Promise<Object|null>} The extracted chat data
     */
    async extractChat() {
        throw new Error("Method 'extractChat' must be implemented by subclasses");
    }

    /**
     * Extract user message - to be implemented by subclasses
     * @param {Element} container - The message container
     * @param {Element} element - The user message element
     * @returns {Promise<string>} The extracted user message
     */
    async retrieveUserMessage(container, element) {
        throw new Error("Method 'retrieveUserMessage' must be implemented by subclasses");
    }

    /**
     * Extract AI reply - to be implemented by subclasses
     * @param {Element} element - The AI message element
     * @returns {Promise<string|null>} The extracted AI reply
     */
    async retrieveAIReply(element) {
        throw new Error("Method 'retrieveAIReply' must be implemented by subclasses");
    }

    /**
     * Extract file attachment - to be implemented by subclasses
     * @param {Element} element - The element containing the file attachment
     * @param {string} id - An identifier for the attachment
     * @returns {Promise<Object|null>} The extracted file information
     */
    async retrieveFileAttachment(element, id) {
        throw new Error("Method 'retrieveFileAttachment' must be implemented by subclasses");
    }

    /**
     * Helper function to trigger copy operation
     * @param {Element} button - The copy button element
     * @returns {Promise<string|null>} The copied text
     */
    async triggerCopy(button) {
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

    /**
     * Helper function to get clipboard content with focus handling
     * @returns {Promise<string|null>} The clipboard content
     */
    async getClipboardContent() {
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

    /**
     * Helper function to download image
     * @param {Element} imgElement - The image element
     * @returns {Promise<Object|null>} The image information
     */
    async downloadImage(imgElement) {
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
            const response = await fetch(`${this.SERVER_URL}/api/images`, {
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
}

// Export the class
export default AIDataRetriever; 
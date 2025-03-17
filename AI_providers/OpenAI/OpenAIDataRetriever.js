// OpenAIDataRetriever.js
// OpenAI-specific implementation of AIDataRetriever

import AIDataRetriever from '../../AIDataRetriever.js';

class OpenAIDataRetriever extends AIDataRetriever {
    constructor(serverUrl = 'http://localhost:8000') {
        super(serverUrl);
    }

    /**
     * Extract chat from OpenAI interface
     * @returns {Promise<Object|null>} The extracted chat data
     */
    async extractChat() {
        console.log('Extracting OpenAI chat...');
        const messages = [];
        const messageContainers = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
        
        console.log('Found message containers:', messageContainers.length);
        if (!messageContainers.length) return null;

        for (const container of messageContainers) {
            console.log('Processing message container');
            
            // Determine if this is a user or assistant message
            const userMessageElement = container.querySelector('div[data-message-author-role="user"]');
            const assistantMessageElement = container.querySelector('div[data-message-author-role="assistant"]');
            
            let messageContent = null;
            let messageRole = null;
            const images = [];
            
            if (userMessageElement) {
                // This is a user message
                messageRole = 'user';
                messageContent = await this.retrieveUserMessage(container, userMessageElement);
                
                // Check for images in user messages
                const imageElements = userMessageElement.querySelectorAll('img[alt="Uploaded image"]');
                for (const imgElement of imageElements) {
                    const imageInfo = await this.retrieveImageAttachment(imgElement);
                    if (imageInfo) {
                        images.push(imageInfo);
                    }
                }
            } else if (assistantMessageElement) {
                // This is an assistant message
                messageRole = 'assistant';
                
                // Try to get content using the copy button
                const copyButton = container.querySelector('button[data-testid="copy-turn-action-button"]');
                if (copyButton) {
                    messageContent = await this.retrieveAIReply(copyButton);
                }
                
                // If copy button method failed, try direct extraction
                if (!messageContent) {
                    const markdownContent = assistantMessageElement.querySelector('.markdown');
                    if (markdownContent) {
                        messageContent = markdownContent.innerText;
                    }
                }
                
                // Check for images in assistant messages
                const imageElements = assistantMessageElement.querySelectorAll('img[alt="Uploaded image"]');
                for (const imgElement of imageElements) {
                    const imageInfo = await this.retrieveImageAttachment(imgElement);
                    if (imageInfo) {
                        images.push(imageInfo);
                    }
                }
            }

            // Add the message if we have content
            if (messageContent) {
                messages.push({
                    role: messageRole,
                    content: messageContent,
                    images: images,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return {
            platform: 'openai',
            title: document.title,
            url: window.location.href,
            messages: messages,
            captured_at: new Date().toISOString()
        };
    }

    /**
     * Extract user message using the edit button strategy
     * @param {Element} container - The message container
     * @param {Element} element - The user message element
     * @returns {Promise<string>} The extracted user message
     */
    async retrieveUserMessage(container, element) {
        console.log('Retrieving user message');
        
        // Find and click the edit button
        const editButton = container.querySelector('button[aria-label="Edit message"]');
        
        if (editButton) {
            console.log('Found edit button, clicking...');
            editButton.click();
            
            // Wait for textarea to appear
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Find the textarea and get its content
            const textarea = document.querySelector('textarea');
            const messageContent = textarea ? textarea.value : element.innerText;
            
            // Find and click the cancel button
            const cancelButton = Array.from(document.querySelectorAll('button')).find(button => {
                const buttonText = button.textContent.trim();
                const isSecondary = button.classList.contains('btn-secondary');
                return buttonText === 'Cancel' && isSecondary;
            });
            
            if (cancelButton) {
                cancelButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                return messageContent;
            } else {
                console.error('Cancel button not found');
                return element.innerText;
            }
        } else {
            console.log('Edit button not found, using innerText');
            // Try to find the text content directly
            const textContent = element.querySelector('.whitespace-pre-wrap');
            return textContent ? textContent.innerText : element.innerText;
        }
    }

    /**
     * Extract AI reply using the copy button strategy
     * @param {Element} copyButton - The copy button element
     * @returns {Promise<string|null>} The extracted AI reply
     */
    async retrieveAIReply(copyButton) {
        if (copyButton) {
            console.log('Found copy button, attempting to copy');
            return await this.triggerCopy(copyButton);
        }
        return null;
    }

    /**
     * Extract image attachment from the message
     * @param {Element} imgElement - The image element
     * @returns {Promise<Object|null>} The extracted image information
     */
    async retrieveImageAttachment(imgElement) {
        console.log('Processing image attachment');
        try {
            const imgSrc = imgElement.src;
            if (!imgSrc) {
                console.error('No image source found');
                return null;
            }
            
            console.log('Found image source:', imgSrc);
            
            // Generate a filename based on the current time
            const filename = 'image_' + Date.now();
            
            // Send message to content-loader script to handle image upload
            const result = await new Promise((resolve, reject) => {
                // Create a unique ID for this request
                const requestId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                // Create a one-time listener for the response
                const messageListener = (event) => {
                    if (event.source !== window) return;
                    if (event.data.type === 'AI_CHAT_RECORDER_IMAGE_RESULT' && event.data.requestId === requestId) {
                        window.removeEventListener('message', messageListener);
                        if (event.data.error) {
                            reject(new Error(event.data.error));
                        } else {
                            resolve(event.data.result);
                        }
                    }
                };
                
                window.addEventListener('message', messageListener);
                
                // Send the request
                window.postMessage({
                    type: 'AI_CHAT_RECORDER_UPLOAD_IMAGE',
                    requestId: requestId,
                    imageUrl: imgSrc,
                    filename: filename
                }, '*');
                
                // Set a timeout to prevent hanging
                setTimeout(() => {
                    window.removeEventListener('message', messageListener);
                    reject(new Error('Image upload timed out'));
                }, 30000);
            });

            const imageInfo = {
                type: 'image',
                originalSrc: imgSrc,
                originalFilename: filename,
                alt: imgElement.alt || 'Image',
                savedPath: result.path
            };
            
            console.log('Successfully processed image:', imgSrc);
            return imageInfo;
        } catch (error) {
            console.error('Failed to process image:', error);
            return {
                type: 'image',
                originalSrc: imgElement.src,
                alt: imgElement.alt || 'Image'
            };
        }
    }
}

export default OpenAIDataRetriever; 
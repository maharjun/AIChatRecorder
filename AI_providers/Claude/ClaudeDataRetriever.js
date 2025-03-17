// ClaudeDataRetriever.js
// Claude-specific implementation of AIDataRetriever

import AIDataRetriever from '../../AIDataRetriever.js';

class ClaudeDataRetriever extends AIDataRetriever {
    constructor(serverUrl = 'http://localhost:8000') {
        super(serverUrl);
    }

    /**
     * Extract chat from Claude interface
     * @returns {Promise<Object|null>} The extracted chat data
     */
    async extractChat() {
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
            const textAttachments = [];
            
            // Process each element with data-testid
            for (const element of elements) {
                const testId = element.getAttribute('data-testid');
                console.log('Found element with data-testid:', testId);
                
                if (testId === 'user-message') {
                    // This is a user message
                    messageRole = 'user';
                    messageContent = await this.retrieveUserMessage(container, element);
                } else if (testId === 'action-bar-copy') {
                    // This is Claude's message with a copy button
                    messageContent = await this.retrieveAIReply(element);
                } else if (testId && !testId.startsWith('file-thumbnail') && !testId.startsWith('user-message')) {
                    // This might be an attachment (image or text)
                    const attachmentInfo = await this.retrieveAttachment(element, testId);
                    if (attachmentInfo) {
                        if (attachmentInfo.type === 'image') {
                            images.push(attachmentInfo);
                        } else if (attachmentInfo.type === 'text') {
                            textAttachments.push(attachmentInfo);
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
                    textAttachments: textAttachments,
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

    /**
     * Extract user message using the edit button strategy
     * @param {Element} container - The message container
     * @param {Element} element - The user message element
     * @returns {Promise<string>} The extracted user message
     */
    async retrieveUserMessage(container, element) {
        console.log('Retrieving user message');
        
        // Find and click the edit button
        const editButton = Array.from(container.querySelectorAll('button')).find(button => {
            const hasSvg = button.querySelector('svg');
            const hasEditText = button.textContent.trim() === 'Edit';
            return hasSvg && hasEditText;
        });
        
        if (editButton) {
            console.log('Found edit button, clicking...');
            editButton.click();
            
            // Wait for textarea to appear
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Find the textarea and get its content
            const textarea = document.querySelector('textarea[data-1p-ignore="true"]');
            const messageContent = textarea ? textarea.value : element.innerText;
            
            // Find and click the cancel button
            const cancelButton = Array.from(document.querySelectorAll('button')).find(button => 
                button.textContent === 'Cancel' && 
                button.getAttribute('type') === 'button' &&
                !button.getAttribute('id') &&
                !button.getAttribute('data-state')
            );
            
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
            return element.innerText;
        }
    }

    /**
     * Extract AI reply using the copy button strategy
     * @param {Element} element - The copy button element
     * @returns {Promise<string|null>} The extracted AI reply
     */
    async retrieveAIReply(element) {
        const copyButton = element.closest('button');
        if (copyButton) {
            console.log('Found copy button, attempting to copy');
            return await this.triggerCopy(copyButton);
        }
        return null;
    }

    /**
     * Extract attachment (image or text) from the message
     * @param {Element} element - The element containing the attachment
     * @param {string} testId - The data-testid attribute value
     * @returns {Promise<Object|null>} The extracted attachment information
     */
    async retrieveAttachment(element, testId) {
        console.log('Found potential attachment:', testId);
        const previewButton = element.querySelector('button[data-testid="file-thumbnail"]');
        
        if (!previewButton) return null;
        
        try {
            console.log('Found preview button for:', testId);
            previewButton.click();
            
            // Wait for the popup to appear
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check what type of popup appeared
            console.log('Checking popup type...');
            
            // Try to find an image popup
            const imagePopup = document.querySelector('#headlessui-portal-root img[alt^="Preview of"]');
            if (imagePopup) {
                console.log('Detected image popup');
                return await this.retrieveImageAttachment(imagePopup, testId);
            }
            
            // Try to find a text popup - more specific selector based on the HTML structure
            const textPopupContainer = document.querySelector('div[style="width: auto;"]');
            if (textPopupContainer) {
                const textPopup = textPopupContainer.querySelector('div.overflow-y-auto.font-mono');
                if (textPopup) {
                    console.log('Detected text popup');
                    return await this.retrieveTextAttachment(textPopup, testId);
                }
                
                // If we found the container but not the specific text element,
                // check if there's any content we can extract
                const anyTextContent = textPopupContainer.querySelector('.whitespace-pre-wrap');
                if (anyTextContent) {
                    console.log('Detected text popup with alternative structure');
                    return await this.retrieveTextAttachment(anyTextContent, testId);
                }
            }
            
            console.log('Could not determine attachment type, no matching popup found');
            
            // Try to close any popup that might be open
            // First try text popup close button
            const textPopupCloseContainer = document.querySelector('div[style="width: auto;"]');
            if (textPopupCloseContainer) {
                const titleElement = textPopupCloseContainer.querySelector('h2');
                if (titleElement) {
                    const closeButton = titleElement.parentElement.querySelector('button[data-testid="close-file-preview"]');
                    if (closeButton) {
                        closeButton.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            // Fallback to image popup close button
            const closeButton = document.querySelector('button[aria-label="Close image preview"]');
            if (closeButton) {
                closeButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            return null;
        } catch (error) {
            console.error('Failed to process attachment preview:', error);
            
            // Attempt to close any popup that might be open
            try {
                // Try text popup close button first
                const textPopupErrorContainer = document.querySelector('div[style="width: auto;"]');
                if (textPopupErrorContainer) {
                    const titleElement = textPopupErrorContainer.querySelector('h2');
                    if (titleElement) {
                        const closeButton = titleElement.parentElement.querySelector('button[data-testid="close-file-preview"]');
                        if (closeButton) {
                            closeButton.click();
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                }
                
                // Fallback to image popup close button
                const closeButton = document.querySelector('button[aria-label="Close image preview"]');
                if (closeButton) {
                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.error('Failed to close popup:', e);
            }
            
            return null;
        }
    }

    /**
     * Extract image attachment from the message
     * @param {Element} popup - The popup image element
     * @param {string} testId - The data-testid attribute value
     * @returns {Promise<Object|null>} The extracted image information
     */
    async retrieveImageAttachment(popup, testId) {
        console.log('Processing popup image:', popup.src);
        try {
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
                    imageUrl: popup.src,
                    filename: testId + '.png'
                }, '*');
                
                // Set a timeout to prevent hanging
                setTimeout(() => {
                    window.removeEventListener('message', messageListener);
                    reject(new Error('Image upload timed out'));
                }, 30000);
            });

            const imageInfo = {
                type: 'image',
                originalSrc: popup.src,
                alt: testId,
                savedPath: result.path
            };
            console.log('Successfully processed image:', popup.src);
            
            // Close the popup
            const closeButton = document.querySelector('button[aria-label="Close image preview"]');
            if (closeButton) {
                closeButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            return imageInfo;
        } catch (error) {
            console.error('Failed to process popup image:', error);
            
            // Attempt to close the popup
            try {
                const closeButton = document.querySelector('button[aria-label="Close image preview"]');
                if (closeButton) {
                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.error('Failed to close popup:', e);
            }
            
            return {
                type: 'image',
                originalSrc: popup.src,
                alt: testId
            };
        }
    }

    /**
     * Extract text attachment from the message
     * @param {Element} textElement - The text content element
     * @param {string} testId - The data-testid attribute value
     * @returns {Promise<Object|null>} The extracted text information
     */
    async retrieveTextAttachment(textElement, testId) {
        console.log('Processing text attachment');
        try {
            // Extract the text content
            const textContent = textElement.innerText;
            
            if (!textContent) {
                console.error('No text content found in the popup');
                return null;
            }
            
            console.log('Text content preview:', textContent.substring(0, 100).replace(/\n/g, '\\n') + '...');
            
            // Send message to content-loader script to handle text upload
            const result = await new Promise((resolve, reject) => {
                // Create a unique ID for this request
                const requestId = 'txt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                // Create a one-time listener for the response
                const messageListener = (event) => {
                    if (event.source !== window) return;
                    if (event.data.type === 'AI_CHAT_RECORDER_TEXT_RESULT' && event.data.requestId === requestId) {
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
                    type: 'AI_CHAT_RECORDER_UPLOAD_TEXT',
                    requestId: requestId,
                    textContent: textContent,
                    filename: testId + '.txt'
                }, '*');
                
                // Set a timeout to prevent hanging
                setTimeout(() => {
                    window.removeEventListener('message', messageListener);
                    reject(new Error('Text upload timed out'));
                }, 30000);
            });
            
            const textInfo = {
                type: 'text',
                title: testId,
                content: textContent,
                savedPath: result.path
            };
            
            console.log('Successfully processed text attachment');
            
            // Find and close the text popup
            // First, find the popup container
            const popupContainer = document.querySelector('div[style="width: auto;"]');
            if (popupContainer) {
                // Find the h2 element within the popup (title)
                const titleElement = popupContainer.querySelector('h2');
                if (titleElement) {
                    // Find the close button which is a sibling of the title
                    const closeButton = titleElement.parentElement.querySelector('button[data-testid="close-file-preview"]');
                    if (closeButton) {
                        console.log('Found close button for text popup, clicking...');
                        closeButton.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.error('Close button not found for text popup');
                    }
                } else {
                    console.error('Title element not found in text popup');
                }
            } else {
                console.error('Text popup container not found');
                // Fallback to the image popup close button
                const closeButton = document.querySelector('button[aria-label="Close image preview"]');
                if (closeButton) {
                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            return textInfo;
        } catch (error) {
            console.error('Failed to process text attachment:', error);
            
            // Attempt to close the popup
            try {
                // Try to find and close the text popup
                const popupContainer = document.querySelector('div[style="width: auto;"]');
                if (popupContainer) {
                    const titleElement = popupContainer.querySelector('h2');
                    if (titleElement) {
                        const closeButton = titleElement.parentElement.querySelector('button[data-testid="close-file-preview"]');
                        if (closeButton) {
                            closeButton.click();
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                }
                
                // Fallback to the image popup close button
                const closeButton = document.querySelector('button[aria-label="Close image preview"]');
                if (closeButton) {
                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.error('Failed to close popup:', e);
            }
            
            return {
                type: 'text',
                title: testId,
                content: textElement.innerText
            };
        }
    }
}

export default ClaudeDataRetriever; 
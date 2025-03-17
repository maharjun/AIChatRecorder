// Server configuration
const SERVER_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', async () => {
    const chatList = document.getElementById('chatList');
    console.log('Viewer loaded - attempting to fetch chats from server');

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    function createChatCard(chat) {
        console.log('Creating chat card:', chat);
        
        const card = document.createElement('div');
        card.className = 'chat-card';

        const title = document.createElement('div');
        title.className = 'chat-title';
        title.textContent = chat.title || 'Untitled Chat';

        const meta = document.createElement('div');
        meta.className = 'chat-meta';
        meta.textContent = `${chat.platform || 'Unknown'} • ${formatDate(chat.captured_at)}`;

        const preview = document.createElement('div');
        preview.className = 'chat-preview';
        preview.textContent = `${chat.message_count} messages`;

        const actions = document.createElement('div');
        actions.className = 'chat-actions';

        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'button view-button';
        viewBtn.textContent = 'View';
        viewBtn.addEventListener('click', () => viewChat(chat.id));

        // Export button
        const exportBtn = document.createElement('button');
        exportBtn.className = 'button export-button';
        exportBtn.textContent = 'Export';
        exportBtn.addEventListener('click', () => exportChat(chat.id));

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'button delete-button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${SERVER_URL}/api/chats/${chat.id}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    throw new Error('Failed to delete chat');
                }
                card.remove();
                if (chatList.children.length === 0) {
                    showNoChats();
                }
            } catch (error) {
                console.error('Error deleting chat:', error);
            }
        });

        actions.appendChild(viewBtn);
        actions.appendChild(exportBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(preview);
        card.appendChild(actions);

        return card;
    }

    function showNoChats() {
        console.log('No chats found - displaying empty state');
        chatList.innerHTML = '<div class="no-chats">No saved chats found</div>';
    }

    async function viewChat(chatId) {
        console.log('Opening chat view for ID:', chatId);
        
        try {
            // Fetch chat data from server
            const response = await fetch(`${SERVER_URL}/api/chats/${chatId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch chat data');
            }
            const chatData = await response.json();
            
            // Create a new window to display the chat
            const win = window.open(chrome.runtime.getURL('chat-view.html'), '_blank');
            
            // Wait for the window to load
            win.addEventListener('load', () => {
                // Set the title
                win.document.title = chatData.title || 'Chat View';
                
                // Create the content
                const content = win.document.getElementById('chat-content');
                
                // Add header
                const header = win.document.createElement('h1');
                header.textContent = chatData.title || 'Chat View';
                content.appendChild(header);
                
                // Add metadata
                const meta = win.document.createElement('div');
                meta.className = 'meta';
                meta.innerHTML = `
                    Platform: ${chatData.platform}<br>
                    Captured: ${formatDate(chatData.captured_at)}<br>
                    URL: <a href="${chatData.url}" target="_blank">${chatData.url}</a>
                `;
                content.appendChild(meta);
                
                // Add messages
                chatData.messages.forEach((msg, msgIndex) => {
                    console.log(`Processing message ${msgIndex + 1}, role: ${msg.role}`);
                    
                    const messageDiv = win.document.createElement('div');
                    messageDiv.className = `message ${msg.role}`;
                    
                    // Add role
                    const roleDiv = win.document.createElement('div');
                    roleDiv.className = 'meta';
                    roleDiv.textContent = `Role: ${msg.role}`;
                    messageDiv.appendChild(roleDiv);
                    
                    // Add content
                    const contentDiv = win.document.createElement('div');
                    contentDiv.className = 'content';
                    contentDiv.textContent = msg.content;
                    messageDiv.appendChild(contentDiv);
                    
                    // Add images
                    if (msg.images && msg.images.length > 0) {
                        msg.images.forEach((img, imgIndex) => {
                            console.log(`Processing image ${imgIndex + 1} in message ${msgIndex + 1}:`, img.savedPath);
                            
                            const imgContainer = win.document.createElement('div');
                            imgContainer.className = 'image-container';
                            
                            const imgElement = win.document.createElement('img');
                            imgElement.className = 'thumbnail';
                            imgElement.src = `${SERVER_URL}${img.savedPath}`;
                            imgElement.alt = img.alt || '';
                            imgElement.dataset.originalSrc = img.originalSrc;
                            
                            // Add click event to open the overlay
                            imgElement.addEventListener('click', () => {
                                const fullImageSrc = `${SERVER_URL}${img.savedPath}`;
                                const caption = `Original source: ${img.originalSrc}`;
                                win.openImageOverlay(fullImageSrc, caption);
                            });
                            
                            const imgMeta = win.document.createElement('div');
                            imgMeta.className = 'image-meta';
                            imgMeta.innerHTML = `Original source: <a href="${img.originalSrc}" target="_blank">View original</a>`;
                            
                            imgContainer.appendChild(imgElement);
                            imgContainer.appendChild(imgMeta);
                            messageDiv.appendChild(imgContainer);
                        });
                    }
                    
                    // Add text attachments
                    if (msg.textAttachments && msg.textAttachments.length > 0) {
                        msg.textAttachments.forEach((txt, txtIndex) => {
                            console.log(`Processing text attachment ${txtIndex + 1} in message ${msgIndex + 1}:`, txt.savedPath);
                            
                            const textContainer = win.document.createElement('div');
                            textContainer.className = 'text-container';
                            
                            // Create text thumbnail
                            const textThumbnail = win.document.createElement('div');
                            textThumbnail.className = 'text-thumbnail';
                            
                            // Add text icon
                            const textIcon = win.document.createElement('div');
                            textIcon.className = 'text-icon';
                            textIcon.innerHTML = '📄';
                            textThumbnail.appendChild(textIcon);
                            
                            // Add filename
                            const filename = txt.title || 'text-attachment.txt';
                            const filenameDiv = win.document.createElement('div');
                            filenameDiv.className = 'text-filename';
                            filenameDiv.textContent = filename;
                            textThumbnail.appendChild(filenameDiv);
                            
                            // Add click event to open the text overlay
                            textThumbnail.addEventListener('click', async () => {
                                try {
                                    // Fetch the text content from the server
                                    const textResponse = await fetch(`${SERVER_URL}${txt.savedPath}`);
                                    if (!textResponse.ok) {
                                        throw new Error('Failed to fetch text content');
                                    }
                                    const textContent = await textResponse.text();
                                    
                                    // Open the text overlay
                                    win.openTextOverlay(textContent, filename, filename);
                                } catch (error) {
                                    console.error('Error loading text content:', error);
                                    win.openTextOverlay(txt.content || 'Failed to load content from server', filename, filename);
                                }
                            });
                            
                            const textMeta = win.document.createElement('div');
                            textMeta.className = 'text-meta';
                            textMeta.textContent = `Text attachment: ${filename}`;
                            
                            textContainer.appendChild(textThumbnail);
                            textContainer.appendChild(textMeta);
                            messageDiv.appendChild(textContainer);
                        });
                    }
                                        
                    content.appendChild(messageDiv);
                });
            });
            
            console.log('Chat view window created and populated');
        } catch (error) {
            console.error('Error viewing chat:', error);
        }
    }

    async function exportChat(chatId) {
        try {
            const response = await fetch(`${SERVER_URL}/api/chats/${chatId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch chat data');
            }
            const chatData = await response.json();
            
            const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat_${chatData.platform}_${new Date(chatData.captured_at).toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting chat:', error);
        }
    }

    // Load and display saved chats
    try {
        const response = await fetch(`${SERVER_URL}/api/chats`);
        if (!response.ok) {
            throw new Error('Failed to fetch chats from server');
        }
        const chats = await response.json();
        
        if (chats.length === 0) {
            showNoChats();
        } else {
            chats.forEach(chat => {
                const card = createChatCard(chat);
                if (card) {
                    chatList.appendChild(card);
                }
            });
            
            // Check if any valid cards were created
            if (chatList.children.length === 0) {
                showNoChats();
            }
        }
    } catch (error) {
        console.error('Error loading chats:', error);
        chatList.innerHTML = '<div class="error">Error connecting to server. Please ensure the Python server is running.</div>';
    }
}); 
document.addEventListener('DOMContentLoaded', async () => {
    const chatList = document.getElementById('chatList');

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    function createChatCard(key, chatData) {
        const card = document.createElement('div');
        card.className = 'chat-card';

        const title = document.createElement('div');
        title.className = 'chat-title';
        title.textContent = chatData.title || 'Untitled Chat';

        const meta = document.createElement('div');
        meta.className = 'chat-meta';
        meta.textContent = `${chatData.platform} • ${formatDate(chatData.capturedAt)}`;

        const preview = document.createElement('div');
        preview.className = 'chat-preview';
        preview.textContent = `${chatData.messages.length} messages`;

        const actions = document.createElement('div');
        actions.className = 'chat-actions';

        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'button view-button';
        viewBtn.textContent = 'View';
        viewBtn.addEventListener('click', () => viewChat(chatData));

        // Export button
        const exportBtn = document.createElement('button');
        exportBtn.className = 'button export-button';
        exportBtn.textContent = 'Export';
        exportBtn.addEventListener('click', () => exportChat(chatData));

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'button delete-button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async () => {
            await chrome.storage.local.remove(key);
            card.remove();
            if (chatList.children.length === 0) {
                showNoChats();
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
        chatList.innerHTML = '<div class="no-chats">No saved chats found</div>';
    }

    function viewChat(chatData) {
        // Create a new window to display the chat
        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${chatData.title || 'Chat View'}</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 0 20px; }
                    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
                    .human { background: #f0f0f0; }
                    .assistant { background: #e3f2fd; }
                    .meta { color: #666; font-size: 14px; margin-bottom: 10px; }
                    img { max-width: 100%; height: auto; margin: 10px 0; }
                    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h1>${chatData.title || 'Chat View'}</h1>
                <div class="meta">
                    Platform: ${chatData.platform}<br>
                    Captured: ${formatDate(chatData.capturedAt)}<br>
                    URL: <a href="${chatData.url}" target="_blank">${chatData.url}</a>
                </div>
                ${chatData.messages.map(msg => `
                    <div class="message ${msg.role}">
                        <div class="meta">Role: ${msg.role}</div>
                        <div>${msg.content}</div>
                        ${msg.images ? msg.images.map(img => 
                            `<img src="${img.src}" alt="${img.alt || ''}">`
                        ).join('') : ''}
                        ${msg.codeBlocks ? msg.codeBlocks.map(code => 
                            `<pre><code class="${code.language}">${code.code}</code></pre>`
                        ).join('') : ''}
                        ${msg.attachments ? msg.attachments.map(attachment => 
                            `<div><a href="${attachment.url}" target="_blank">${attachment.name}</a> (${attachment.type})</div>`
                        ).join('') : ''}
                    </div>
                `).join('')}
            </body>
            </html>
        `);
    }

    function exportChat(chatData) {
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${chatData.platform}_${new Date(chatData.capturedAt).toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Load and display saved chats
    const storage = await chrome.storage.local.get(null);
    const chatKeys = Object.keys(storage).filter(key => key.startsWith('chat_'));

    if (chatKeys.length === 0) {
        showNoChats();
    } else {
        chatKeys.sort().reverse().forEach(key => {
            const chatData = storage[key];
            chatList.appendChild(createChatCard(key, chatData));
        });
    }
}); 
// Load saved settings when the options page opens
document.addEventListener('DOMContentLoaded', async () => {
    const settings = await chrome.storage.sync.get({
        attachmentsPath: 'attachments',
        storageType: 'local',
        jsonStoragePath: 'chats'
    });

    document.getElementById('attachmentsPath').value = settings.attachmentsPath;
    document.getElementById('storageType').value = settings.storageType;
    document.getElementById('jsonStoragePath').value = settings.jsonStoragePath;

    // Show/hide JSON path based on storage type
    document.getElementById('jsonPathGroup').style.display = 
        settings.storageType === 'json' ? 'block' : 'none';
});

// Handle storage type change
document.getElementById('storageType').addEventListener('change', (e) => {
    document.getElementById('jsonPathGroup').style.display = 
        e.target.value === 'json' ? 'block' : 'none';
});

// Save settings
document.getElementById('save').addEventListener('click', async () => {
    const status = document.getElementById('status');
    const settings = {
        attachmentsPath: document.getElementById('attachmentsPath').value.trim() || 'attachments',
        storageType: document.getElementById('storageType').value,
        jsonStoragePath: document.getElementById('jsonStoragePath').value.trim() || 'chats'
    };

    try {
        await chrome.storage.sync.set(settings);
        
        status.textContent = 'Settings saved successfully!';
        status.className = 'status success';
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    } catch (error) {
        status.textContent = 'Error saving settings: ' + error.message;
        status.className = 'status error';
        status.style.display = 'block';
    }
}); 
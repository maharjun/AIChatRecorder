// Load saved settings when the options page opens
document.addEventListener('DOMContentLoaded', async () => {
    // In the future, settings will be loaded here
    // For now, we have no settings to load
});

// Save settings
document.getElementById('save').addEventListener('click', async () => {
    const status = document.getElementById('status');
    
    try {
        // In the future, settings will be saved here
        // For now, we have no settings to save
        
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
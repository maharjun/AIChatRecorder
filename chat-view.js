// Add image and text attachment handling and overlay functionality
window.addEventListener('load', () => {
    // Set up image error handling
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', (e) => {
            console.error('Failed to load image:', e.target.src);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'image-error';
            errorDiv.textContent = 'Failed to load image. Original source: ' + e.target.dataset.originalSrc;
            e.target.parentNode.appendChild(errorDiv);
        });
        img.addEventListener('load', (e) => {
            console.log('Successfully loaded image:', e.target.src);
        });
    });

    // Set up image overlay functionality
    const imageOverlay = document.getElementById('image-overlay');
    const overlayImage = document.getElementById('overlay-image');
    const overlayCaption = document.getElementById('overlay-caption');
    const overlayClose = document.getElementById('overlay-close');

    // Close image overlay when clicking the close button
    overlayClose.addEventListener('click', () => {
        imageOverlay.style.display = 'none';
    });

    // Close image overlay when clicking outside the image
    imageOverlay.addEventListener('click', (e) => {
        if (e.target === imageOverlay) {
            imageOverlay.style.display = 'none';
        }
    });

    // Set up text overlay functionality
    const textOverlay = document.getElementById('text-overlay');
    const overlayTextContent = document.getElementById('overlay-text-content');
    const textOverlayTitle = document.getElementById('text-overlay-title');
    const textOverlayClose = document.getElementById('text-overlay-close');
    const downloadTextButton = document.getElementById('download-text-button');
    const closeTextButton = document.getElementById('close-text-button');

    // Close text overlay when clicking the close button
    textOverlayClose.addEventListener('click', () => {
        textOverlay.style.display = 'none';
    });

    // Close text overlay when clicking the close button
    closeTextButton.addEventListener('click', () => {
        textOverlay.style.display = 'none';
    });

    // Close text overlay when clicking outside the content
    textOverlay.addEventListener('click', (e) => {
        if (e.target === textOverlay) {
            textOverlay.style.display = 'none';
        }
    });

    // Download text content
    downloadTextButton.addEventListener('click', () => {
        const content = overlayTextContent.textContent;
        const filename = downloadTextButton.dataset.filename || 'attachment.txt';
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Close overlay when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (imageOverlay.style.display === 'flex') {
                imageOverlay.style.display = 'none';
            }
            if (textOverlay.style.display === 'flex') {
                textOverlay.style.display = 'none';
            }
        }
    });
});

// Function to open the image overlay
function openImageOverlay(src, caption) {
    const overlay = document.getElementById('image-overlay');
    const overlayImage = document.getElementById('overlay-image');
    const overlayCaption = document.getElementById('overlay-caption');
    
    overlayImage.src = src;
    
    if (caption) {
        overlayCaption.textContent = caption;
        overlayCaption.style.display = 'block';
    } else {
        overlayCaption.style.display = 'none';
    }
    
    overlay.style.display = 'flex';
}

// Function to open the text overlay
function openTextOverlay(content, title, filename) {
    const overlay = document.getElementById('text-overlay');
    const overlayTextContent = document.getElementById('overlay-text-content');
    const textOverlayTitle = document.getElementById('text-overlay-title');
    const downloadTextButton = document.getElementById('download-text-button');
    
    overlayTextContent.textContent = content;
    
    if (title) {
        textOverlayTitle.textContent = title;
        textOverlayTitle.style.display = 'block';
    } else {
        textOverlayTitle.style.display = 'none';
    }
    
    // Set the filename for download
    if (filename) {
        downloadTextButton.dataset.filename = filename;
    } else {
        downloadTextButton.dataset.filename = 'attachment.txt';
    }
    
    overlay.style.display = 'flex';
}

// Expose functions to window object
window.openImageOverlay = openImageOverlay;
window.openTextOverlay = openTextOverlay; 
// Add image load error handling and overlay functionality
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
    const overlay = document.getElementById('image-overlay');
    const overlayImage = document.getElementById('overlay-image');
    const overlayCaption = document.getElementById('overlay-caption');
    const overlayClose = document.getElementById('overlay-close');

    // Close overlay when clicking the close button
    overlayClose.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    // Close overlay when clicking outside the image
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    // Close overlay when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.style.display === 'flex') {
            overlay.style.display = 'none';
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
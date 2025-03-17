// Add image load error handling
window.addEventListener('load', () => {
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
}); 
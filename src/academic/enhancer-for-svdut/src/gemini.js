/**
 * Logic for automatically copying Gemini's answer to clipboard.
 * Specifically handles JSON answer structures from the LMS script.
 */
export function handleGeminiPages() {
    console.log('[Enhancer] Gemini auto-copy enabled.');

    const processedTexts = new Set();

    const observer = new MutationObserver((mutations) => {
        // Look for model responses or message contents
        const targets = document.querySelectorAll('model-response, .message-content, [data-message-author-role="assistant"]');
        
        targets.forEach(target => {
            const content = (target.innerText || target.textContent || '').trim();
            if (!content || content.length < 20) return;

            // Look for the specific JSON format
            const jsonMatch = content.match(/\{[\s\S]*?"answers"[\s\S]*?\}/);
            
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                if (processedTexts.has(jsonStr)) return;

                try {
                    // Validate it is actual JSON
                    JSON.parse(jsonStr);
                    
                    // Copy to clipboard
                    if (typeof GM_setClipboard !== 'undefined') {
                        GM_setClipboard(jsonStr);
                    } else {
                        navigator.clipboard.writeText(jsonStr);
                    }

                    console.log('[Enhancer] Detected JSON and copied to clipboard:', jsonStr);
                    processedTexts.add(jsonStr);

                    // Show a small notification on top
                    showCopyToast();
                } catch (e) {
                    // Not valid JSON yet, might still be generating
                }
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

/**
 * Displays a temporary toast notification indicating successful copy.
 */
function showCopyToast() {
    let toast = document.getElementById('svdut-copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'svdut-copy-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: sans-serif;
            font-weight: bold;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = '✅ Đã tự động copy đáp án!';
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

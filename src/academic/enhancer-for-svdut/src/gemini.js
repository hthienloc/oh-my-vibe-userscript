import { showNotification } from "./utils.js";
/**
 * Logic for automatically sending Gemini's answer back to LMS via bridge server.
 * Specifically handles JSON answer structures from the LMS script.
 */
const RELAY_URL = 'http://localhost:8081';

export function handleGeminiPages() {
    console.log('[Enhancer] Gemini auto-send to LMS enabled.');

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
                    
                    console.log('[Enhancer] Detected JSON answer:', jsonStr);
                    processedTexts.add(jsonStr);

                    // Gửi về LMS qua server nếu server đang chạy
                    if (serverAvailable) {
                        sendAnswerToLMS(jsonStr);
                    } else {
                        // Fallback: copy to clipboard
                        copyToClipboard(jsonStr);
                        showNotification('📋 Đã copy vào clipboard (server chưa chạy)', 'info');
                    }
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

// Gửi câu trả lời về LMS qua bridge server
async function sendAnswerToLMS(answer) {
    try {
        showNotification('📤 Đang gửi đáp án về LMS...', 'info');

        const res = await fetch(RELAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'gemini_answer',
                answer: answer
            }),
            mode: 'cors'
        });

        if (res.ok) {
            showNotification('✅ Đã gửi đáp án về LMS!', 'success');
        } else {
            throw new Error('Server error');
        }
    } catch (err) {
        console.error('[Enhancer] Error sending to LMS:', err);
        // Fallback to clipboard
        copyToClipboard(answer);
        showNotification('❌ Lỗi gửi server, đã copy vào clipboard', 'error');
    }
}

// Copy to clipboard helper
function copyToClipboard(text) {
    if (typeof GM_setClipboard !== 'undefined') {
        GM_setClipboard(text);
    } else {
        navigator.clipboard.writeText(text).catch(() => {});
    }
}


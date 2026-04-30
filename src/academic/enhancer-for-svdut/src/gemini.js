/**
 * Logic for automatically sending Gemini's answer back to LMS via bridge server.
 * Specifically handles JSON answer structures from the LMS script.
 */
const RELAY_URL = 'http://localhost:8081';

let serverAvailable = null;

// Kiểm tra server có đang chạy không
async function checkServer() {
    try {
        const res = await fetch(`${RELAY_URL}/status?t=${Date.now()}`, { 
            mode: 'cors',
            signal: AbortSignal.timeout(2000)
        });
        const data = await res.json();
        serverAvailable = data && data.status === 'running';
        return serverAvailable;
    } catch (e) {
        serverAvailable = false;
        return false;
    }
}

// Hiển thị thông báo nhắc chạy server
function showServerReminder() {
    const existing = document.getElementById('server-reminder-gemini');
    if (existing) existing.remove();

    const reminder = document.createElement('div');
    reminder.id = 'server-reminder-gemini';
    Object.assign(reminder.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '20px 25px',
        background: '#fff3cd',
        color: '#856404',
        border: '3px solid #ffc107',
        borderRadius: '12px',
        zIndex: '2147483647',
        fontSize: '15px',
        fontWeight: 'bold',
        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        maxWidth: '550px',
        textAlign: 'center',
        lineHeight: '1.6'
    });
    reminder.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 12px;">⚠️ Chưa khởi chạy Bridge Server!</div>
        <div style="font-size: 13px; font-weight: normal; margin-bottom: 15px; text-align: left;">
            Để tự động gửi đáp án về LMS, hãy chạy server trong terminal:
        </div>
        <div style="background: #212529; color: #00ff00; padding: 12px 15px; borderRadius: 6px; font-family: monospace; fontSize: 13px; margin-bottom: 12px; text-align: left;">
            cd ~/Documents/GitHub/oh-my-vibe-userscript/src/productivity/lms-gemini-bridge/server<br>
            python3 bridge_server.py
        </div>
        <div style="font-size: 12px; font-weight: normal; color: #856404; margin-bottom: 10px;">
            Server sẽ chạy tại <b>http://localhost:8081</b>
        </div>
        <button id="reminder-close-gemini" style="padding: 8px 20px; background: #856404; color: white; border: none; borderRadius: 6px; cursor: pointer; fontSize: 13px;">Đã hiểu</button>
    `;
    document.body.appendChild(reminder);

    document.getElementById('reminder-close-gemini').onclick = () => reminder.remove();

    setTimeout(() => {
        if (reminder.parentNode) reminder.remove();
    }, 15000);
}

export function handleGeminiPages() {
    console.log('[Enhancer] Gemini auto-send to LMS enabled.');

    // Kiểm tra server khi trang load
    checkServer().then(available => {
        if (!available) {
            showServerReminder();
        }
    });

    // Kiểm tra định kỳ
    setInterval(() => {
        checkServer().then(available => {
            if (!available && serverAvailable !== false) {
                showServerReminder();
            }
        });
    }, 30000);

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

/**
 * Displays a temporary toast notification
 */
function showNotification(message, type) {
    const existing = document.getElementById('svdut-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.id = 'svdut-notification';
    Object.assign(notif.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '15px 25px',
        background: type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3',
        color: 'white',
        borderRadius: '8px',
        zIndex: '2147483647',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '500px',
        textAlign: 'center'
    });
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
        if (notif.parentNode) notif.remove();
    }, 5000);
}

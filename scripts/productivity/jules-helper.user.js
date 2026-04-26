// ==UserScript==
// @name         Jules Session & Message Copier (V3.4 Manual Refresh)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Full bi-directional bridge with Manual Refresh button and robust state management.
// @author       Gemini Orchestrator
// @match        https://jules.google.com/session/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/jules-helper.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/jules-helper.user.js
// ==/UserScript==

/**
 * ARCHITECTURE OVERVIEW:
 * 
 * 1. SYNC (Jules -> Gemini): Transfers Jules message content to local relay.
 * 2. PROPOSAL (Gemini -> Jules): Polls for replies targeting this specific Session ID.
 * 3. MANUAL REFRESH: A button to immediately trigger polling without waiting for the interval.
 * 4. APPROVAL: User confirms delivery of Gemini's reply to Jules via UI panel.
 * 5. SECURITY (CSP): Pure DOM construction (createElement) to bypass strict CSP.
 */

(function() {
    'use strict';

    const RELAY_URL = 'http://localhost:8080';
    
    /**
     * Extracts the core Session ID from the URL using Regex.
     */
    function extractSessionID() {
        const match = window.location.href.match(/\/session\/([^\/]+)/);
        return match ? match[1] : null;
    }

    const SESSION_ID = extractSessionID();
    let handledMessages = new Set();

    console.log(`%c[Lotus Bridge V3.4] Manual Refresh Active for: ${SESSION_ID}`, 'color: #3d5afe; font-weight: bold;');

    function getMessageFingerprint(msg) {
        try {
            return btoa(unescape(encodeURIComponent(msg))).slice(0, 32);
        } catch (e) {
            return msg.slice(0, 32);
        }
    }

    function getChatInput() {
        return document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    }

    /**
     * Polling mechanism with Cache Buster
     */
    function poll() {
        if (!SESSION_ID) return;
        const cacheBusterUrl = `${RELAY_URL}?t=${Date.now()}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: cacheBusterUrl,
            onload: function(res) {
                try {
                    const data = JSON.parse(res.responseText);
                    
                    if (!data || !data.message || data.status !== 'pending') {
                        if (handledMessages.size > 0) {
                            handledMessages.clear();
                        }
                        const existing = document.getElementById('gemini-safe-panel');
                        if (existing) existing.remove();
                        return;
                    }

                    if (data.target_session_id === SESSION_ID) {
                        const fingerprint = getMessageFingerprint(data.message);
                        if (!handledMessages.has(fingerprint)) {
                            injectProposalUI(data.message, fingerprint);
                        }
                    }
                } catch (e) {}
            }
        });
    }

    function injectProposalUI(message, fingerprint) {
        if (document.getElementById('gemini-safe-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'gemini-safe-panel';
        Object.assign(panel.style, {
            position: 'fixed', bottom: '120px', left: '50%', transform: 'translateX(-50%)',
            width: '450px', padding: '20px', background: '#ffffff', border: '4px solid #3d5afe',
            borderRadius: '16px', zIndex: '2147483647', boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            fontFamily: 'sans-serif'
        });

        const title = document.createElement('div');
        title.textContent = '⚡ GEMINI PROPOSED REPLY';
        Object.assign(title.style, { fontWeight: 'bold', color: '#1a237e', marginBottom: '12px', fontSize: '14px' });
        panel.appendChild(title);

        const msgBox = document.createElement('div');
        msgBox.textContent = message;
        Object.assign(msgBox.style, {
            fontSize: '13px', color: '#333', textAlign: 'left', maxHeight: '150px',
            overflowY: 'auto', background: '#f5f5f5', padding: '12px', borderRadius: '8px',
            border: '1px solid #ddd', whiteSpace: 'pre-wrap', marginBottom: '15px', lineHeight: '1.5'
        });
        panel.appendChild(msgBox);

        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', gap: '10px' });

        const sendBtn = document.createElement('button');
        sendBtn.textContent = '✅ CONFIRM & SEND';
        Object.assign(sendBtn.style, {
            flex: '2', padding: '12px', background: '#2e7d32', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
        });
        
        sendBtn.onclick = () => {
            const chat = getChatInput();
            if (chat) {
                chat.value = message;
                chat.textContent = message;
                chat.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => {
                    const sendBtnReal = document.querySelector('button[type="submit"]') || 
                                     document.querySelector('button[aria-label*="Send"]');
                    if (sendBtnReal) sendBtnReal.click();
                }, 100);
            }
            handledMessages.add(fingerprint);
            panel.remove();
            clearOutboxOnServer();
        };

        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = '❌ REJECT';
        Object.assign(rejectBtn.style, {
            flex: '1', padding: '12px', background: '#eceff1', color: '#37474f',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
        });
        rejectBtn.onclick = () => {
            handledMessages.add(fingerprint);
            panel.remove();
            clearOutboxOnServer();
        };

        btnGroup.appendChild(sendBtn);
        btnGroup.appendChild(rejectBtn);
        panel.appendChild(btnGroup);
        document.body.appendChild(panel);
    }

    function clearOutboxOnServer() {
        GM_xmlhttpRequest({
            method: "POST",
            url: RELAY_URL,
            data: JSON.stringify({ action: 'clear_outbox' })
        });
    }

    /**
     * Injects both SYNC and MANUAL REFRESH buttons.
     */
    function injectActionButtons(container, textGetter) {
        if (container.getAttribute('data-gemini-injected') === 'true') return;
        
        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', gap: '8px', marginTop: '8px' });

        // 1. SYNC TO GEMINI
        const syncBtn = document.createElement('button');
        syncBtn.textContent = '🚀 SYNC TO GEMINI';
        Object.assign(syncBtn.style, {
            padding: '6px 12px', background: '#1a73e8', color: 'white', border: 'none', 
            borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
        });
        syncBtn.onclick = () => {
            GM_xmlhttpRequest({
                method: "POST", url: RELAY_URL,
                data: JSON.stringify({ url: window.location.href, message: textGetter() }),
                headers: { "Content-Type": "application/json" }
            });
            syncBtn.textContent = '✅ SYNCED';
            setTimeout(() => syncBtn.textContent = '🚀 SYNC TO GEMINI', 2000);
        };

        // 2. MANUAL REFRESH (Force Poll)
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 FORCE REFRESH';
        Object.assign(refreshBtn.style, {
            padding: '6px 12px', background: '#f1f3f4', color: '#3c4043', border: '1px solid #ddd', 
            borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
        });
        refreshBtn.onclick = () => {
            poll(); // Immediate poll
            refreshBtn.textContent = '⚡ CHECKING...';
            refreshBtn.style.background = '#e8f0fe';
            setTimeout(() => {
                refreshBtn.textContent = '🔄 FORCE REFRESH';
                refreshBtn.style.background = '#f1f3f4';
            }, 1000);
        };

        btnGroup.appendChild(syncBtn);
        btnGroup.appendChild(refreshBtn);
        container.appendChild(btnGroup);
        container.setAttribute('data-gemini-injected', 'true');
    }

    function scanMessages() {
        document.querySelectorAll('swebot-agent-chat-bubble .message-container').forEach(container => {
            const content = container.querySelector('swebot-markdown-viewer') || container;
            injectActionButtons(container, () => content.innerText);
        });
    }

    setInterval(scanMessages, 1000);
    setInterval(poll, 3000);
})();

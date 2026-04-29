// ==UserScript==
// @name         Jules Session & Message Copier (V3.4 Manual Refresh)
// @namespace    http://tampermonkey.net/
// @version      3.4.3
// @description  Full bi-directional bridge with Manual Refresh button and robust state management.
// @author       hthienloc
// @match        https://jules.google.com/session/*
// @icon         https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/jules-helper.svg
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
     * @returns {string|null} The session ID if found, otherwise null.
     */
    function extractSessionID() {
        const match = window.location.href.match(/\/session\/([^\/]+)/);
        return match ? match[1] : null;
    }

    const SESSION_ID = extractSessionID();
    let handledMessages = new Set();

    console.log(`%c[Lotus Bridge V3.4] Manual Refresh Active for: ${SESSION_ID}`, 'color: #3d5afe; font-weight: bold;');

    /**
     * Creates a short fingerprint to uniquely identify a message and prevent duplicates.
     * @param {string} msg The message string.
     * @returns {string} The base64 fingerprint or truncated string.
     */
    function getMessageFingerprint(msg) {
        try {
            return btoa(unescape(encodeURIComponent(msg))).slice(0, 32);
        } catch (e) {
            return msg.slice(0, 32);
        }
    }

    /**
     * Retrieves the chat input element.
     * @returns {HTMLElement|null}
     */
    function getChatInput() {
        return document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    }

    /**
     * Polling mechanism with Cache Buster. Polls the local server for proposed responses.
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
                        const existing = document.getElementById('vibecode-gemini-safe-panel');
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

    /**
     * Injects the UI panel presenting Gemini's proposed reply.
     * @param {string} message The proposed message from Gemini.
     * @param {string} fingerprint The unique fingerprint for the message.
     */
    function injectProposalUI(message, fingerprint) {
        if (document.getElementById('vibecode-gemini-safe-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'vibecode-gemini-safe-panel';
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

    /**
     * Sends a request to clear the server's outbox.
     */
    function clearOutboxOnServer() {
        GM_xmlhttpRequest({
            method: "POST",
            url: RELAY_URL,
            data: JSON.stringify({ action: 'clear_outbox' })
        });
    }

    /**
     * Injects QUICK REPLIES, SYNC, and MANUAL REFRESH buttons.
     * @param {HTMLElement} container The container to inject buttons into.
     * @param {Function} textGetter Function to extract text from the container.
     */
    function injectActionButtons(container, textGetter) {
        if (container.getAttribute('data-gemini-injected') === 'true') return;
        
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' });

        // --- ROW 1: QUICK REPLIES ---
        const quickRow = document.createElement('div');
        Object.assign(quickRow.style, { display: 'flex', gap: '6px', flexWrap: 'wrap' });

        const quickPrompts = [
            { label: '➡️ Continue', text: 'Can you continue?' },
            { label: '🧐 Explain', text: 'Can you explain this logic?' },
            { label: '🛠️ Fix', text: 'I found an issue here, please fix it.' },
            { label: '✅ Done', text: 'Everything looks good, thank you!' }
        ];

        quickPrompts.forEach(p => {
            const qBtn = document.createElement('button');
            qBtn.textContent = p.label;
            Object.assign(qBtn.style, {
                padding: '4px 8px', background: '#f8f9fa', color: '#5f6368', border: '1px solid #dadce0', 
                borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
            });
            qBtn.onmouseover = () => qBtn.style.background = '#e8f0fe';
            qBtn.onmouseout = () => qBtn.style.background = '#f8f9fa';
            qBtn.onclick = () => {
                const input = getChatInput();
                if (input) {
                    input.value = p.text;
                    input.textContent = p.text;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    setTimeout(() => {
                        const sendBtn = document.querySelector('button[type="submit"]') || 
                                         document.querySelector('button[aria-label*="Send"]');
                        if (sendBtn) sendBtn.click();
                    }, 50);
                }
            };
            quickRow.appendChild(qBtn);
        });
        wrapper.appendChild(quickRow);

        // --- ROW 2: CORE ACTIONS ---
        const btnGroup = document.createElement('div');
        Object.assign(btnGroup.style, { display: 'flex', gap: '8px' });

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
        wrapper.appendChild(btnGroup);

        container.appendChild(wrapper);
        container.setAttribute('data-gemini-injected', 'true');
    }

    /**
     * Scans for new chat bubbles and injects action buttons if needed.
     */
    function scanMessages() {
        document.querySelectorAll('swebot-agent-chat-bubble .message-container').forEach(container => {
            const content = container.querySelector('swebot-markdown-viewer') || container;
            injectActionButtons(container, () => content.innerText);
        });
    }

    /**
     * Initializes intervals for scanning messages and polling.
     */
    function init() {
        setInterval(scanMessages, 1000);
        setInterval(poll, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

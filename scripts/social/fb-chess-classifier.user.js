// ==UserScript==
// @name         Facebook Chess Move Classifier
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.0.16
// @description  Classifies Facebook messages and comments using Chess.com move evaluation icons based on vocabulary.
// @author       hthienloc
// @match        https://www.facebook.com/*
// @match        https://www.messenger.com/*
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/social/fb-chess-classifier.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/social/fb-chess-classifier.user.js
// ==/UserScript==

(function() {
    'use strict';

    const CLASSIFICATIONS = {
        BRILLIANT: { id: 'brilliant', label: '!!', color: '#1baca6', title: 'Brilliant', priority: 1, keywords: ['tối ưu', 'kiến trúc', 'đỉnh cao', 'hoàn hảo', 'thiên tài', 'xuất sắc', 'đột phá', 'refactor'] },
        GREAT: { id: 'great', label: '!', color: '#5c8bb0', title: 'Great Move', priority: 2, keywords: ['tuyệt vời', 'hay quá', 'giỏi', 'ấn tượng', 'cháy', 'khét', 'uy tín', 'cook', 'flex', 'slay', 'mãi đỉnh', 'out trình'] },
        EXCELLENT: { id: 'excellent', label: '!!', color: '#96bc4b', title: 'Excellent', priority: 2.5, keywords: ['hay', 'tốt', 'hợp lý', 'chính xác', 'cháy', 'khét', 'uy tín', 'cook', 'flex', 'slay', 'mãi đỉnh', 'out trình'] },
        BEST: { id: 'best', label: '★', color: '#81b64c', title: 'Best Move', priority: 3, keywords: ['chuẩn', 'đúng rồi', 'nhất trí'] },
        GOOD: { id: 'good', label: '✓', color: '#95bb4a', title: 'Good Move', priority: 4, keywords: ['được', 'ổn', 'ok', 'tạm', 'ủa', 'ảo ma', 'lú', 'jztr'] },
        BOOK: { id: 'book', label: '📚', color: '#a88865', title: 'Book Move', priority: 5, keywords: ['chào', 'hello', 'hi', 'bye', 'tạm biệt', 'hẹn gặp'] },
        INACCURACY: { id: 'inaccuracy', label: '?!', color: '#f3a632', title: 'Inaccuracy', priority: 6, keywords: ['hả', 'saooo', 'lạ vậy', 'ảo'] },
        MISTAKE: { id: 'mistake', label: '?', color: '#e58f2a', title: 'Mistake', priority: 7, keywords: ['sai', 'nhầm', 'lỗi', 'bug', 'hỏng', 'quên'] },
        MISS: { id: 'miss', label: 'X', color: '#ff7769', title: 'Missed Win', priority: 8, keywords: ['tiếc', 'bó tay', 'bỏ lỡ', 'đành chịu'] },
        BLUNDER: { id: 'blunder', label: '??', color: '#fa412d', title: 'Blunder', priority: 9, keywords: ['ngu', 'đần', 'chó', 'vcl', 'dkm', 'đkm', 'địt', 'đụ', 'cặc', 'lồn', 'câm', 'sủa', 'đm', 'cl', 'vkl', 'ml', 'đcm'] }
    };

    const ASSET_BASE_URL = 'https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/chess-icons/';
    
    // Global cache for base64 icons to prevent redundant network requests
    const imageCache = {};

    function getClassification(text) {
        let score = 0;
        const lowerText = text.toLowerCase();
        
        // --- Penalties ---
        // Profanity
        if (CLASSIFICATIONS.BLUNDER.keywords.some(k => lowerText.includes(k))) score -= 50;
        
        // Excessive emojis (>3 in a row)
        const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}){4,}/gu;
        if (emojiRegex.test(text)) score -= 15;
        
        // ALL CAPS shouting
        const letters = text.replace(/[^a-zA-Z]/g, '');
        if (letters.length > 5) {
            const upperCount = (letters.match(/[A-Z]/g) || []).length;
            if (upperCount / letters.length > 0.5) score -= 15;
        }
        
        // Excessive punctuation
        if (/([!?])\1{2,}/.test(text)) score -= 10;
        
        // Repeated characters
        if (/(.)\1{4,}/i.test(text)) score -= 10;

        // Negative keywords
        if (CLASSIFICATIONS.MISTAKE.keywords.some(k => lowerText.includes(k))) score -= 20;
        if (CLASSIFICATIONS.MISS.keywords.some(k => lowerText.includes(k))) score -= 15;
        if (CLASSIFICATIONS.INACCURACY.keywords.some(k => lowerText.includes(k))) score -= 10;
        
        const teencodeKeywords = ['k', 'ko', 'dc', 'đc', 'v', 'm', 't', 'ae', 'r', 'j'];
        if (teencodeKeywords.some(k => lowerText.includes(k))) score -= 2;

        // --- Rewards ---
        // Proper punctuation
        if (/[.,]/.test(text)) score += 5;
        
        // Sentence length
        if (text.length > 20) score += 5;

        // Proper capitalization and ending punctuation
        if (/^[A-Z]/.test(text) && /[.!?]$/.test(text.trim())) score += 10;
        
        // Professional and positive keywords
        if (CLASSIFICATIONS.BRILLIANT.keywords.some(k => lowerText.includes(k))) score += 30;
        else if (CLASSIFICATIONS.GREAT.keywords.some(k => lowerText.includes(k))) score += 20;
        else if (CLASSIFICATIONS.EXCELLENT.keywords.some(k => lowerText.includes(k))) score += 15;
        else if (CLASSIFICATIONS.BEST.keywords.some(k => lowerText.includes(k))) score += 10;
        else if (CLASSIFICATIONS.GOOD.keywords.some(k => lowerText.includes(k))) score += 5;

        // Book move fallback
        if (score === 0 && CLASSIFICATIONS.BOOK.keywords.some(k => lowerText.includes(k))) {
            return CLASSIFICATIONS.BOOK;
        }

        // Apply chaos factor
        score += (Math.random() * 10 - 5);

        // --- Thresholds ---
        let result;
        if (score <= -40) result = CLASSIFICATIONS.BLUNDER;
        else if (score <= -20) result = CLASSIFICATIONS.MISTAKE;
        else if (score <= -15) result = CLASSIFICATIONS.MISS;
        else if (score < -5) result = CLASSIFICATIONS.INACCURACY;
        else if (score >= 35) result = CLASSIFICATIONS.BRILLIANT;
        else if (score >= 25) result = CLASSIFICATIONS.EXCELLENT;
        else if (score >= 15) result = CLASSIFICATIONS.BEST;
        else result = CLASSIFICATIONS.GOOD;

        // Luck Promotion
        if (score > 0 && Math.random() < 0.05) {
            return CLASSIFICATIONS.BRILLIANT;
        }

        const isShort = text.length < 20;
        const isTrendy = CLASSIFICATIONS.GREAT.keywords.some(k => lowerText.includes(k));
        if (isShort && isTrendy && Math.random() < 0.10) {
            return CLASSIFICATIONS.GREAT;
        }

        return result;
    }

    function applyFallbackBadge(badge, img, cls) {
        img.style.display = 'none';
        badge.textContent = cls.label;
        Object.assign(badge.style, {
            width: '18px',
            height: '18px',
            backgroundColor: cls.color,
            color: 'white',
            borderRadius: '50%',
            fontSize: '10px',
            fontWeight: 'bold',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'inline-flex',
            fontFamily: 'sans-serif',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
        });
    }

    function createBadge(cls) {
        const badge = document.createElement('span');
        badge.className = 'chess-badge-container';
        badge.title = cls.title;
        Object.assign(badge.style, {
            display: 'inline-flex',
            verticalAlign: 'middle',
            marginLeft: '6px',
            userSelect: 'none',
            flexShrink: '0',
            alignItems: 'center',
            justifyContent: 'center'
        });
        
        const img = document.createElement('img');
        Object.assign(img.style, {
            width: '20px',
            height: '20px',
            display: 'block'
        });

        // Use cached Base64 if available
        if (imageCache[cls.id]) {
            img.src = imageCache[cls.id];
            badge.appendChild(img);
        } else if (typeof GM_xmlhttpRequest !== 'undefined') {
            // Fetch via GM_xmlhttpRequest to bypass CSP
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${ASSET_BASE_URL}${cls.id}.png`,
                responseType: 'blob',
                onload: function(response) {
                    if (response.status === 200) {
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            const base64data = reader.result;
                            imageCache[cls.id] = base64data; // Cache it
                            img.src = base64data;
                            if (!badge.contains(img)) badge.appendChild(img);
                        }
                        reader.readAsDataURL(response.response);
                    } else {
                        applyFallbackBadge(badge, img, cls);
                    }
                },
                onerror: function() {
                    applyFallbackBadge(badge, img, cls);
                }
            });
        } else {
            applyFallbackBadge(badge, img, cls);
        }

        img.onerror = () => applyFallbackBadge(badge, img, cls);
        return badge;
    }

    function processElement(el) {
        if (el.dataset.chessEvaluated) return;
        
        // Exclude input fields and contenteditable elements
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
            return;
        }

        // Exclude elements with role="button" or buttons
        if (el.closest('[role="button"]') || el.closest('button')) {
            return;
        }

        // Exclude names and profile links (usually short strings inside <a>)
        const linkParent = el.closest('a') || el.closest('[role="link"]');
        if (linkParent) {
            const linkText = (linkParent.innerText || '').trim();
            if (linkText.length < 50) {
                return;
            }
        }

        // Exclude elements that are inside a contenteditable container
        if (el.closest('[contenteditable="true"]')) {
            return;
        }
        
        // Ensure we are targeting the actual text container to prevent nested evaluation
        // Check if there's a text node that actually contains text
        const hasDirectText = Array.from(el.childNodes).some(node => 
            node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
        );
        
        if (!hasDirectText && el.children.length > 0) {
            return; // Skip parent containers that don't directly hold text
        }

        const text = (el.innerText || el.textContent || '').trim();
        if (text.length < 2 || text.length >= 500) return;

        // Link Exclusion
        // Refined to avoid matching trailing dots (like hello...)
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,})/i;
        if (urlRegex.test(text)) {
            return;
        }

        const cls = getClassification(text);
        if (cls) {
            el.dataset.chessEvaluated = 'true';
            const badge = createBadge(cls);
            
            // Try to append right after the last text node to prevent line breaks
            let lastTextNode = null;
            const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
            let currentNode;
            while (currentNode = treeWalker.nextNode()) {
                if (currentNode.textContent.trim().length > 0) {
                    lastTextNode = currentNode;
                }
            }

            if (lastTextNode && lastTextNode.parentNode) {
                 // Insert after the last text node
                if (lastTextNode.nextSibling) {
                    lastTextNode.parentNode.insertBefore(badge, lastTextNode.nextSibling);
                } else {
                    lastTextNode.parentNode.appendChild(badge);
                }
            } else {
                el.appendChild(badge);
            }
        }
    }

    function scan() {
        const selectors = [
            'div[dir="auto"]:not([role="textbox"])',
            'span[dir="auto"]',
            'div[role="article"] div[dir="ltr"]',
            'span.x1lliihq',
            '.x1iorvi4'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(processElement);
    }

    let timer = null;
    const observer = new MutationObserver((mutations) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(scan, 100); 
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial delay to let FB dynamic UI settle
    setTimeout(scan, 2000);
    console.log('%c[Chess Move Classifier V1.0.12] Pro Edition Loaded!', 'color: #81b64c; font-weight: bold;');
})();

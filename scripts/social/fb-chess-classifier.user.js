// ==UserScript==
// @name         Facebook Chess Move Classifier
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.0.12
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
        GREAT: { id: 'great', label: '!', color: '#5c8bb0', title: 'Great Move', priority: 2, keywords: ['tuyệt vời', 'hay quá', 'giỏi', 'ấn tượng'] },
        EXCELLENT: { id: 'excellent', label: '!!', color: '#96bc4b', title: 'Excellent', priority: 2.5, keywords: ['hay', 'tốt', 'hợp lý', 'chính xác'] },
        BEST: { id: 'best', label: '★', color: '#81b64c', title: 'Best Move', priority: 3, keywords: ['chuẩn', 'đúng rồi', 'nhất trí'] },
        GOOD: { id: 'good', label: '✓', color: '#95bb4a', title: 'Good Move', priority: 4, keywords: ['được', 'ổn', 'ok', 'tạm'] },
        BOOK: { id: 'book', label: '📚', color: '#a88865', title: 'Book Move', priority: 5, keywords: ['chào', 'hello', 'hi', 'bye', 'tạm biệt', 'hẹn gặp'] },
        INACCURACY: { id: 'inaccuracy', label: '?!', color: '#f3a632', title: 'Inaccuracy', priority: 6, keywords: ['ủa', 'hả', 'saooo', 'jztr', 'lạ vậy', 'ảo'] },
        MISTAKE: { id: 'mistake', label: '?', color: '#e58f2a', title: 'Mistake', priority: 7, keywords: ['sai', 'nhầm', 'lỗi', 'bug', 'hỏng', 'quên'] },
        MISS: { id: 'miss', label: 'X', color: '#ff7769', title: 'Missed Win', priority: 8, keywords: ['tiếc', 'bó tay', 'bỏ lỡ', 'đành chịu'] },
        BLUNDER: { id: 'blunder', label: '??', color: '#fa412d', title: 'Blunder', priority: 9, keywords: ['ngu', 'đần', 'chó', 'vcl', 'dkm', 'đkm', 'địt', 'đụ', 'cặc', 'lồn', 'câm', 'sủa'] }
    };

    const ASSET_BASE_URL = 'https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/chess-icons/';
    
    // Global cache for base64 icons to prevent redundant network requests
    const imageCache = {};

    function getClassification(text) {
        const lowerText = text.toLowerCase();
        
        const order = [
            CLASSIFICATIONS.BLUNDER,
            CLASSIFICATIONS.BRILLIANT,
            CLASSIFICATIONS.MISS,
            CLASSIFICATIONS.MISTAKE,
            CLASSIFICATIONS.INACCURACY,
            CLASSIFICATIONS.GREAT,
            CLASSIFICATIONS.EXCELLENT,
            CLASSIFICATIONS.BEST,
            CLASSIFICATIONS.BOOK,
            CLASSIFICATIONS.GOOD
        ];

        for (const cls of order) {
            if (cls.keywords.some(k => lowerText.includes(k))) {
                return cls;
            }
        }
        return null;
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

    function hasSignificantChild(el) {
        return el.children.length > 0 && Array.from(el.children).some(c => c.tagName === 'DIV' || c.tagName === 'SPAN');
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
        
        // Deepest child check: We only want elements that actually contain the text
        if (hasSignificantChild(el)) {
            return;
        }

        const text = (el.innerText || '').trim();
        if (text.length < 2 || text.length >= 500) return;

        const cls = getClassification(text);
        if (cls) {
            el.dataset.chessEvaluated = 'true';
            const badge = createBadge(cls);
            
            // Adjust parent to prevent layout breaking
            if (getComputedStyle(el).display === 'block') {
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.flexWrap = 'wrap';
            }
            
            el.appendChild(badge);
        }
    }

    function scan() {
        const selectors = [
            'div[dir="auto"]',
            'span[dir="auto"]',
            'div[role="article"] div[dir="ltr"]',
            'span.x1lliihq'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(processElement);
    }

    let timer = null;
    const observer = new MutationObserver((mutations) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(scan, 500); 
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial delay to let FB dynamic UI settle
    setTimeout(scan, 2000);
    console.log('%c[Chess Move Classifier V1.0.11] Pro Edition Loaded!', 'color: #81b64c; font-weight: bold;');
})();

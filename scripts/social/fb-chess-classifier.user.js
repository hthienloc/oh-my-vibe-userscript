// ==UserScript==
// @name         Facebook Chess Move Classifier
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.0.5
// @description  Classifies Facebook messages and comments using Chess.com move evaluation icons based on vocabulary.
// @author       hthienloc
// @match        https://www.facebook.com/*
// @match        https://www.messenger.com/*
// @grant        none
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

    function createBadge(cls) {
        const badge = document.createElement('span');
        badge.className = 'chess-badge-container';
        badge.title = cls.title;
        Object.assign(badge.style, {
            display: 'inline-flex',
            verticalAlign: 'middle',
            marginLeft: '6px',
            userSelect: 'none',
            flexShrink: '0'
        });
        
        const img = document.createElement('img');
        img.src = `${ASSET_BASE_URL}${cls.id}.png`;
        Object.assign(img.style, {
            width: '20px',
            height: '20px',
            display: 'block'
        });

        // Fallback
        img.onerror = () => {
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
                fontFamily: 'sans-serif',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            });
        };

        badge.appendChild(img);
        return badge;
    }

    function processElement(el) {
        if (el.dataset.chessEvaluated) return;
        
        // Deepest child check: We only want elements that actually contain the text
        // Messenger structure from dom.txt: span[dir="auto"] > div[dir="auto"]
        if (el.children.length > 0 && Array.from(el.children).some(c => c.tagName === 'DIV' || c.tagName === 'SPAN')) {
            return;
        }

        const text = (el.innerText || '').trim();
        if (text.length < 2) return;

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
        // Broad but filtered by processElement's leaf-node logic
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
        timer = setTimeout(scan, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial delay to let FB dynamic UI settle
    setTimeout(scan, 2000);
    console.log('%c[Chess Move Classifier V1.0.4] Running with Official Assets!', 'color: #81b64c; font-weight: bold;');
})();

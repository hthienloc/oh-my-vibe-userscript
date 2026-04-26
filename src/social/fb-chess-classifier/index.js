// ==UserScript==
// @name         Facebook Chess Move Classifier
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.0.0
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
        BRILLIANT: { label: '!!', color: '#1baca6', title: 'Brilliant', priority: 1, keywords: ['tối ưu', 'kiến trúc', 'đỉnh cao', 'hoàn hảo', 'thiên tài', 'xuất sắc', 'đột phá', 'refactor'] },
        GREAT: { label: '!', color: '#5c8bb0', title: 'Great Move', priority: 2, keywords: ['tuyệt vời', 'hay quá', 'giỏi', 'hợp lý', 'chính xác', 'đồng ý'] },
        BEST: { label: '★', color: '#81b64c', title: 'Best Move', priority: 3, keywords: ['chuẩn', 'đúng rồi', 'nhất trí'] },
        GOOD: { label: '✓', color: '#95bb4a', title: 'Good Move', priority: 4, keywords: ['được', 'ổn', 'ok', 'tạm'] },
        BOOK: { label: '📚', color: '#a88865', title: 'Book Move', priority: 5, keywords: ['chào', 'hello', 'hi', 'bye', 'tạm biệt', 'hẹn gặp'] },
        INACCURACY: { label: '?!', color: '#f3a632', title: 'Inaccuracy', priority: 6, keywords: ['ủa', 'hả', 'saooo', 'jztr', 'lạ vậy', 'ảo'] },
        MISTAKE: { label: '?', color: '#e58f2a', title: 'Mistake', priority: 7, keywords: ['sai', 'nhầm', 'lỗi', 'bug', 'hỏng', 'quên'] },
        MISS: { label: 'X', color: '#ff7769', title: 'Missed Win', priority: 8, keywords: ['tiếc', 'bó tay', 'bỏ lỡ', 'đành chịu'] },
        BLUNDER: { label: '??', color: '#fa412d', title: 'Blunder', priority: 9, keywords: ['ngu', 'đần', 'chó', 'vcl', 'dkm', 'đkm', 'địt', 'đụ', 'cặc', 'lồn', 'câm', 'sủa'] }
    };

    function getClassification(text) {
        const lowerText = text.toLowerCase();
        
        // Priority for matching
        const order = [
            CLASSIFICATIONS.BLUNDER,
            CLASSIFICATIONS.BRILLIANT,
            CLASSIFICATIONS.MISS,
            CLASSIFICATIONS.MISTAKE,
            CLASSIFICATIONS.INACCURACY,
            CLASSIFICATIONS.GREAT,
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
        badge.textContent = cls.label;
        badge.title = cls.title;
        Object.assign(badge.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            backgroundColor: cls.color,
            color: 'white',
            borderRadius: '50%',
            fontSize: '10px',
            fontWeight: 'bold',
            marginLeft: '8px',
            cursor: 'help',
            flexShrink: '0',
            verticalAlign: 'middle',
            fontFamily: 'sans-serif',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            userSelect: 'none'
        });
        return badge;
    }

    function processElement(el) {
        if (el.dataset.chessEvaluated) return;
        
        // Only process leaf-like elements to avoid double badges
        if (el.children.length > 0 && el.querySelector('div, span')) return;

        const text = (el.innerText || '').trim();
        if (text.length < 2) return;

        const cls = getClassification(text);
        if (cls) {
            el.dataset.chessEvaluated = 'true';
            const badge = createBadge(cls);
            el.appendChild(badge);
        }
    }

    function scan() {
        // Facebook/Messenger text containers
        const selectors = [
            'div[dir="auto"]',
            'span[dir="auto"]',
            '.x193iq5w', // Messenger text
            'div[role="article"] div[dir="ltr"]' // Newsfeed comments
        ];
        document.querySelectorAll(selectors.join(',')).forEach(processElement);
    }

    let timer = null;
    const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(scan, 200);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    console.log('%c[Chess Move Classifier] Activated!', 'color: #81b64c; font-weight: bold;');
})();

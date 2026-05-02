// ==UserScript==
// @name         Weblate Quick Translator
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  Tự động dịch và điền vào ô dịch bằng Google Translate
// @author       hthienloc
// @match        https://translate.codeberg.org/*
// @match        https://translate.fedoraproject.org/*
// @match        https://translate.flossmanuals.net/*
// @match        https://hosted.weblate.org/*
// @match        https://weblate.org/*
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/weblate-translator.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/weblate-translator.user.js
// @icon         https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/weblate-translator.svg
// ==/UserScript==

(function () {
    'use strict';

    const TOOLBAR_SELECTOR = '.editor-toolbar, .zen-toolbar, .main-content.js-editor .btn-group-settings';
    const CONTAINER_ID = 'weblate-translator-toolbar';

    let autoTranslateEnabled = sessionStorage.getItem('weblate-auto-translate') === 'true';
    let lastChecksum = null;

    const ICONS = {
        google: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M22 25h20M22 32h20M22 39h14"/><path d="M43 35l5 5M43 45l5-5"/></svg>`,
        auto: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M28 22l-8 8M36 26l-8 8M44 30l-8 8M28 42l-8-8"/></svg>`
    };

    function addStyles() {
        if (document.getElementById('weblate-translator-styles')) return;
        const style = document.createElement('style');
        style.id = 'weblate-translator-styles';
        style.textContent = `
            #${CONTAINER_ID} {
                display: inline-flex;
                gap: 4px;
                margin-left: 8px;
            }
            .weblate-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border: 1px solid transparent;
                border-radius: 4px;
                background: transparent;
                color: #6c757d;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .weblate-btn:hover {
                background: rgba(0,0,0,0.05);
                color: #333;
            }
            .weblate-btn.active {
                background: rgba(66, 133, 244, 0.1);
                color: #4285F4;
            }
        `;
        document.head.appendChild(style);
    }

    function getSourceText() {
        // Only get the CURRENT clean English source text (no diffs)
        // Must be inside .source-language-group, NOT in .source-change
        const sourceGroup = document.querySelector('.source-language-group');
        if (!sourceGroup) return null;

        const sourceArea = sourceGroup.querySelector('.list-group-item-text[lang="en"]');
        if (!sourceArea) return null;

        // Get the span that is NOT inside a button
        const span = Array.from(sourceArea.querySelectorAll('span')).find(s => {
            return !s.closest('button') && s.textContent.trim().length > 0;
        });

        if (span) {
            // Get innerHTML to preserve BBCode tags like [b]...[/b]
            let html = span.innerHTML;

            // Remove HTML tags but KEEP BBCode tags
            // First, temporarily replace BBCode tags with placeholders
            const bbcodePattern = /\[(\/?[bisu])\]/gi;
            const bbcodeMatches = [];
            let match;
            while ((match = bbcodePattern.exec(html)) !== null) {
                bbcodeMatches.push(match[0]);
            }

            // Replace BBCode with placeholders
            let tempHtml = html.replace(bbcodePattern, '{{BBCode}}');

            // Now strip HTML tags
            tempHtml = tempHtml.replace(/<[^>]+>/g, '');

            // Restore BBCode tags
            bbcodeMatches.forEach(bb => {
                tempHtml = tempHtml.replace('{{BBCode}}', bb);
            });

            return tempHtml.trim();
        }

        return null;
    }

    function getTargetLang() {
        const match = window.location.pathname.match(/\/-?\/([a-z]{2,3})\//);
        return match ? match[1] : 'vi';
    }

    function googleTranslate(text, targetLang) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
                onload: function (response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        const translated = data[0].map(x => x[0]).join('');
                        resolve(translated);
                    } catch (e) {
                        reject(new Error('Lỗi dịch: ' + e.message));
                    }
                },
                onerror: function (err) {
                    reject(new Error('Lỗi kết nối: ' + err));
                }
            });
        });
    }

    function fillTranslation(text) {
        const textarea = document.querySelector('textarea.translation-editor');
        if (!textarea) {
            alert('Không tìm thấy ô dịch!');
            return false;
        }
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    async function translateAndFill() {
        const text = getSourceText();
        if (!text) {
            alert('Không tìm thấy văn bản nguồn!');
            return;
        }

        // Clean placeholders: remove digits before {number} like 1{number} -> {number}
        let cleanedText = text.replace(/(\d+)(\{[^}]+\})/g, '$2');

        // Extract and preserve placeholders like {number}, %s, %d, etc.
        const placeholderPattern = /\{[^}]+\}|%[sd]/g;
        const placeholders = [];
        let match;
        let textForTranslation = cleanedText;

        // Find all placeholders
        while ((match = placeholderPattern.exec(cleanedText)) !== null) {
            placeholders.push({ placeholder: match[0], index: match.index });
        }

        // Replace placeholders with numbered markers
        placeholders.forEach((p, i) => {
            textForTranslation = textForTranslation.replace(p.placeholder, `{{PH${i}}}`);
        });

        try {
            const translated = await googleTranslate(textForTranslation, getTargetLang());

            if (translated) {
                // Restore placeholders in correct order
                let finalTranslation = translated;
                placeholders.forEach((p, i) => {
                    finalTranslation = finalTranslation.replace(`{{PH${i}}}`, p.placeholder);
                });
                fillTranslation(finalTranslation);
            }
        } catch (err) {
            alert('Lỗi dịch: ' + err.message);
        }
    }

    function autoTranslate() {
        if (!autoTranslateEnabled) return;
        const text = getSourceText();
        if (text && text !== lastChecksum) {
            lastChecksum = text;
            setTimeout(() => translateAndFill(), 500);

            // Pre-translate next 3 offsets
            preTranslateNext(3);
        }
    }

    function getCurrentOffset() {
        const match = window.location.search.match(/offset=(\d+)/);
        return match ? parseInt(match[1]) : 1;
    }

    function getMaxOffset() {
        const el = document.querySelector('.position-input-editable .input-group-text');
        if (el) {
            const match = el.textContent.match(/\/ (\d+)/);
            if (match) return parseInt(match[1]);
        }
        return 27; // fallback
    }

    async function preTranslateNext(count) {
        const currentOffset = getCurrentOffset();
        const maxOffset = getMaxOffset();
        const baseUrl = window.location.origin + window.location.pathname;

        for (let i = 1; i <= count; i++) {
            const nextOffset = currentOffset + i;
            if (nextOffset > maxOffset) break;

            const cacheKey = 'weblate-pretrans-' + nextOffset;
            if (sessionStorage.getItem(cacheKey)) continue; // Already pre-translated

            try {
                const url = baseUrl + '?q=state%3A%3Ctranslated&offset=' + nextOffset;
                const sourceText = await fetchSourceText(url);
                if (sourceText) {
                    const targetLang = getTargetLang();
                    const translated = await googleTranslate(sourceText, targetLang);
                    if (translated) {
                        sessionStorage.setItem(cacheKey, JSON.stringify({
                            text: translated,
                            source: sourceText,
                            time: Date.now(),
                            offset: nextOffset
                        }));
                    }
                }
            } catch (e) {
                // Ignore pre-translate errors
            }
        }
    }

    async function fetchSourceText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        // Use same logic as getSourceText() to get English source
                        const sourceGroup = doc.querySelector('.source-language-group');
                        if (!sourceGroup) {
                            resolve(null);
                            return;
                        }
                        const sourceArea = sourceGroup.querySelector('.list-group-item-text[lang="en"]');
                        if (!sourceArea) {
                            resolve(null);
                            return;
                        }
                        const span = Array.from(sourceArea.querySelectorAll('span')).find(s => {
                            return !s.closest('button') && s.textContent.trim().length > 0;
                        });
                        if (span) {
                            resolve(span.innerHTML.trim());
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(err) {
                    reject(err);
                }
            });
        });
    }

    function checkPreTranslated() {
        if (!autoTranslateEnabled) return;
        const currentOffset = getCurrentOffset();
        const cacheKey = 'weblate-pretrans-' + currentOffset;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                // Verify this cached translation matches current offset
                if (data.offset === currentOffset) {
                    const textarea = document.querySelector('textarea.translation-editor');
                    if (textarea && !textarea.value) {
                        textarea.value = data.text;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    function addButtons() {
        if (document.getElementById(CONTAINER_ID)) return;

        const toolbar = document.querySelector(TOOLBAR_SELECTOR);
        if (!toolbar) return;

        const container = document.createElement('div');
        container.id = CONTAINER_ID;

        const googleBtn = document.createElement('button');
        googleBtn.className = 'weblate-btn';
        googleBtn.innerHTML = `${ICONS.google} <span>Google</span>`;
        googleBtn.title = 'Dịch và điền vào ô dịch';
        googleBtn.onclick = () => translateAndFill();

        const autoBtn = document.createElement('button');
        autoBtn.className = 'weblate-btn';
        autoBtn.innerHTML = `${ICONS.auto} <span>Auto</span>`;
        autoBtn.title = 'Tự động dịch khi chuyển chuỗi (Click để bật/tắt)';

        if (autoTranslateEnabled) {
            autoBtn.classList.add('active');
            autoBtn.title = 'Tự động dịch: BẬT - Click để tắt';
        }

        autoBtn.onclick = () => {
            autoTranslateEnabled = !autoTranslateEnabled;
            sessionStorage.setItem('weblate-auto-translate', autoTranslateEnabled);
            autoBtn.classList.toggle('active', autoTranslateEnabled);
            if (autoTranslateEnabled) {
                autoBtn.title = 'Tự động dịch: BẬT - Click để tắt';
                autoTranslate();
            } else {
                autoBtn.title = 'Tự động dịch: TẮT - Click để bật';
            }
        };

        // Translate All button for Zen mode
        const translateAllBtn = document.createElement('button');
        translateAllBtn.className = 'weblate-btn';
        translateAllBtn.innerHTML = '🔄 Translate All';
        translateAllBtn.title = 'Dịch tất cả các dòng trong Zen mode';
        translateAllBtn.onclick = async () => {
            const rows = document.querySelectorAll('tr[id^="row-edit-"]');
            for (const row of rows) {
                const textarea = row.querySelector('textarea.translation-editor');
                const sourceArea = row.querySelector('.list-group-item-text[lang="en"]');
                if (!textarea || !sourceArea) continue;

                const span = Array.from(sourceArea.querySelectorAll('span')).find(s => {
                    return !s.closest('button') && s.textContent.trim().length > 0;
                });

                if (!span) continue;
                let sourceText = span.innerHTML.trim();

                // Clean placeholders
                sourceText = sourceText.replace(/(\d+)(\{[^}]+\})/g, '$2');

                // Extract and preserve placeholders
                const placeholderPattern = /\{[^}]+\}|%[sd]/g;
                const placeholders = [];
                let match;
                const textForTranslation = sourceText.replace(placeholderPattern, (match, i) => {
                    placeholders.push(match);
                    return `{{PH${placeholders.length-1}}}`;
                });

                try {
                    const translated = await googleTranslate(textForTranslation, getTargetLang());
                    if (translated) {
                        let finalTranslation = translated;
                        placeholders.forEach((p, i) => {
                            finalTranslation = finalTranslation.replace(`{{PH${i}}}`, p);
                        });
                        textarea.value = finalTranslation;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch (e) {
                    // Ignore errors for individual rows
                }

                // Small delay between translations
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            alert('Dịch tất cả hoàn tất!');
        };

        container.appendChild(googleBtn);
        container.appendChild(autoBtn);
        container.appendChild(translateAllBtn);
        toolbar.appendChild(container);
    }

    function init() {
        addStyles();
        addButtons();

        if (autoTranslateEnabled) {
            setTimeout(() => {
                checkPreTranslated();
                autoTranslate();
            }, 1500);
        }

        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(() => {
                    addButtons();
                    if (autoTranslateEnabled) {
                        checkPreTranslated();
                        autoTranslate();
                    }
                }, 1000);
            }
        }).observe(document, { subtree: true, childList: true });

        function startSourceObserver() {
            const sourceEl = document.querySelector('.list-group-item-text');
            if (sourceEl) {
                const observer = new MutationObserver(() => {
                    if (autoTranslateEnabled) autoTranslate();
                });
                observer.observe(sourceEl, { childList: true, characterData: true, subtree: true });
            } else {
                setTimeout(startSourceObserver, 500);
            }
        }
        startSourceObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

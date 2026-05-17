// ==UserScript==
// @name         POEditor Quick Translator
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  Tự động dịch và điền vào ô dịch bằng Google Translate trên POEditor
// @author       hthienloc
// @match        https://poeditor.com/projects/po_edit*
// @match        https://poeditor.com/projects/view*
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/poeditor-translator.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/poeditor-translator.user.js
// @icon         https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/poeditor-translator.svg
// ==/UserScript==

(function () {
    'use strict';

    const ICONS = {
        google: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M22 25h20M22 32h20M22 39h14"/><path d="M43 35l5 5M43 45l5-5"/></svg>`,
        auto: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M28 22l-8 8M36 26l-8 8M44 30l-8 8M28 42l-8-8"/></svg>`
    };

    let autoTranslateEnabled = sessionStorage.getItem('poeditor-auto-translate') === 'true';
    let currentTextarea = null;
    let floatingToolbar = null;

    function addStyles() {
        if (document.getElementById('poeditor-translator-styles')) return;
        const style = document.createElement('style');
        style.id = 'poeditor-translator-styles';
        style.textContent = `
            #poeditor-translator-toolbar {
                position: absolute;
                display: none;
                z-index: 10000;
                background: #fff;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .poeditor-btn {
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
            .poeditor-btn:hover {
                background: rgba(0,0,0,0.05);
                color: #333;
            }
            .poeditor-btn.active {
                background: rgba(66, 133, 244, 0.1);
                color: #4285F4;
            }
            
            @media (prefers-color-scheme: dark) {
                #poeditor-translator-toolbar {
                    background: #2b2b2b;
                    border-color: #444;
                }
                .poeditor-btn {
                    color: #aaa;
                }
                .poeditor-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function cleanHtml(html) {
        html = html.replace(/<kbd[^>]*>.*?<\/kbd>/g, '');
        const bbcodePattern = /\[(\/?[bisu])\]/gi;
        const bbcodeMatches = [];
        let match;
        while ((match = bbcodePattern.exec(html)) !== null) {
            bbcodeMatches.push(match[0]);
        }
        let tempHtml = html.replace(bbcodePattern, '{{BBCode}}');
        tempHtml = tempHtml.replace(/<[^>]+>/g, '');
        bbcodeMatches.forEach(bb => {
            tempHtml = tempHtml.replace('{{BBCode}}', bb);
        });
        tempHtml = tempHtml.replace(/(\d+)(\{[^}]+\})/g, '$2');
        return tempHtml.trim();
    }

    function processTranslation(text, targetLang) {
        const placeholderPattern = /\{[^}]+\}|%[sd]/g;
        const placeholders = [];
        let textForTranslation = text;
        let match;
        
        while ((match = placeholderPattern.exec(text)) !== null) {
            placeholders.push(match[0]);
        }
        
        placeholders.forEach((p, i) => {
            textForTranslation = textForTranslation.replace(p, `{{PH\${i}}}`);
        });
        
        return googleTranslate(textForTranslation, targetLang).then(translated => {
            if (!translated) return null;
            let finalTranslation = translated;
            placeholders.forEach((p, i) => {
                // Support potential space injection by Google Translate
                finalTranslation = finalTranslation.replace(new RegExp(`{{\\\\s*PH\${i}\\\\s*}}`, 'g'), p);
            });
            return finalTranslation;
        });
    }

    function getTargetLang() {
        const codeElem = document.querySelector('.language-code');
        return codeElem ? codeElem.textContent.trim() : 'vi';
    }

    function googleTranslate(text, targetLang) {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(() => {
                reject(new Error('Request timeout after 10s'));
            }, 10000);

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=\${targetLang}&dt=t&q=\${encodeURIComponent(text)}`,
                onload: function (response) {
                    clearTimeout(timeoutId);
                    try {
                        const data = JSON.parse(response.responseText);
                        const translated = data[0].map(x => x[0]).join('');
                        resolve(translated);
                    } catch (e) {
                        reject(new Error('Lỗi dịch: ' + e.message));
                    }
                },
                onerror: function (err) {
                    clearTimeout(timeoutId);
                    reject(new Error('Lỗi kết nối: ' + err));
                }
            });
        });
    }

    async function translateAndFill(textarea) {
        let rowId = '';
        let originalElem = null;

        // Try extracting from textarea ID (e.g. definition-805178-177-563673794-s-one)
        const idMatch = textarea.id && textarea.id.match(/definition-([\d-]+)/);
        if (idMatch) {
            rowId = idMatch[1];
            originalElem = document.getElementById(`original-\${rowId}-s`) || 
                           document.getElementById(`original-\${rowId}-p`);
        }

        // Fallback to closest row
        if (!originalElem) {
            const row = textarea.closest('[id^="row-term-"]');
            if (row) {
                rowId = row.id.replace('row-term-', '');
                originalElem = document.getElementById(`original-\${rowId}-s`) || 
                               document.getElementById(`original-\${rowId}-p`) ||
                               row.querySelector('.original-string');
            }
        }
                             
        if (!originalElem) {
            console.warn('Original text element not found for textarea:', textarea);
            return;
        }

        const sourceText = cleanHtml(originalElem.innerHTML || originalElem.textContent);
        if (!sourceText) return;

        const translateBtn = document.getElementById('poeditor-translate-btn');
        if (translateBtn) translateBtn.innerHTML = `⏳ <span>Translating...</span>`;

        try {
            const translated = await processTranslation(sourceText, getTargetLang());
            if (translated) {
                textarea.value = translated;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } catch (err) {
            console.error('Translation error:', err);
        } finally {
            if (translateBtn) translateBtn.innerHTML = `\${ICONS.google} <span>Translate</span>`;
        }
    }

    function createFloatingToolbar() {
        if (floatingToolbar) return;
        
        floatingToolbar = document.createElement('div');
        floatingToolbar.id = 'poeditor-translator-toolbar';
        
        const translateBtn = document.createElement('button');
        translateBtn.id = 'poeditor-translate-btn';
        translateBtn.className = 'poeditor-btn';
        translateBtn.innerHTML = `\${ICONS.google} <span>Translate</span>`;
        
        translateBtn.onmousedown = (e) => e.preventDefault(); // Prevent losing focus
        translateBtn.onclick = async (e) => {
            e.preventDefault();
            if (currentTextarea) {
                await translateAndFill(currentTextarea);
            }
        };

        floatingToolbar.appendChild(translateBtn);
        document.body.appendChild(floatingToolbar);
    }

    function showToolbarFor(textarea) {
        currentTextarea = textarea;
        const rect = textarea.getBoundingClientRect();
        
        // Position below the textarea, aligned to the right
        floatingToolbar.style.top = (window.scrollY + rect.bottom + 5) + 'px';
        floatingToolbar.style.display = 'block';
        
        // We set display block first so offsetWidth is calculated
        const leftPos = window.scrollX + rect.right - floatingToolbar.offsetWidth;
        floatingToolbar.style.left = leftPos + 'px';
        
        if (autoTranslateEnabled && !textarea.value.trim()) {
            translateAndFill(textarea);
        }
    }

    function hideToolbar() {
        setTimeout(() => {
            if (document.activeElement !== currentTextarea && !floatingToolbar.contains(document.activeElement)) {
                floatingToolbar.style.display = 'none';
            }
        }, 200);
    }

    function addGlobalToolbar() {
        if (document.getElementById('poeditor-global-auto-btn')) return;
        
        const targetContainer = document.querySelector('.translation-navlinks') || 
                                document.querySelector('.filter-strip .d-flex') || 
                                document.querySelector('.content-header .js-filter-order');
                            
        if (!targetContainer) return;
        
        const autoBtn = document.createElement('button');
        autoBtn.id = 'poeditor-global-auto-btn';
        autoBtn.className = 'poeditor-btn ms-2';
        autoBtn.style.padding = '6px 10px';
        autoBtn.style.border = '1px solid #ccc';
        autoBtn.innerHTML = `${ICONS.auto} <span>Auto Translate</span>`;
        autoBtn.title = 'Tự động dịch khi nhấp vào ô nhập liệu (Click để bật/tắt)';
        
        if (autoTranslateEnabled) {
            autoBtn.classList.add('active');
        }
        
        autoBtn.onclick = (e) => {
            e.preventDefault();
            autoTranslateEnabled = !autoTranslateEnabled;
            sessionStorage.setItem('poeditor-auto-translate', autoTranslateEnabled);
            autoBtn.classList.toggle('active', autoTranslateEnabled);
        };
        
        targetContainer.appendChild(autoBtn);
    }

    function init() {
        addStyles();
        createFloatingToolbar();
        
        // Add global toolbar
        setTimeout(addGlobalToolbar, 1000);

        document.addEventListener('focusin', (e) => {
            // POEditor inline textareas
            if (e.target && e.target.tagName === 'TEXTAREA') {
                const isTranslationField = 
                    e.target.name === 'definition' || 
                    e.target.name === 'text' || 
                    (e.target.id && e.target.id.startsWith('definition-')) ||
                    e.target.closest('[id^="row-term-"]');
                
                if (isTranslationField) {
                    showToolbarFor(e.target);
                }
            }
        });

        document.addEventListener('focusout', (e) => {
            if (e.target && e.target.tagName === 'TEXTAREA') {
                hideToolbar();
            }
        });
        
        // Observe for global toolbar
        new MutationObserver(() => {
            if (!document.getElementById('poeditor-global-auto-btn')) {
                addGlobalToolbar();
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

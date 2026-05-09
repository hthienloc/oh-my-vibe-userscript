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
// @match        https://*.fyralabs.com/*
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

    // Extract source text from a row (works for both single and Zen mode)
    function getSourceTextFromRow(row) {
        if (!row) return null;
        
        // Try Zen mode structure first (td.translatetext)
        let sourceTd = row.querySelector('td.translatetext') 
                        || row.querySelector('td[class*="translatetext"]');
        
        if (sourceTd) {
            // Zen mode
            const span = Array.from(sourceTd.querySelectorAll('span')).find(s => 
                !s.closest('button') && s.textContent.trim().length > 0
            );
            if (!span) return null;
            return cleanHtml(span.innerHTML);
        }
        
        // Non-Zen mode: look for .list-group-item-text[lang="en"] inside .source-language-group
        const sourceGroup = row.querySelector('.source-language-group') || row;
        const sourceArea = sourceGroup.querySelector('.list-group-item-text[lang="en"]');
        
        if (sourceArea) {
            const span = Array.from(sourceArea.querySelectorAll('span')).find(s => 
                !s.closest('button') && s.textContent.trim().length > 0
            );
            if (!span) return null;
            return cleanHtml(span.innerHTML);
        }
        
        return null;
    }
    
    // Clean HTML: remove kbd, tags, preserve BBCode, clean placeholders
    function cleanHtml(html) {
        // Remove <kbd> elements (shortcut numbers like 1, 2, 3)
        html = html.replace(/<kbd[^>]*>.*?<\/kbd>/g, '');
        
        // Remove HTML tags but preserve BBCode tags
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
        
        // Clean placeholder prefixes like 1{...} -> {...}
        tempHtml = tempHtml.replace(/(\d+)(\{[^}]+\})/g, '$2');
        
        return tempHtml.trim();
    }
    
    // Handle placeholders: extract, replace with markers, restore after translation
    function processTranslation(text, targetLang) {
        // Extract placeholders like {number}, %s, %d
        const placeholderPattern = /\{[^}]+\}|%[sd]/g;
        const placeholders = [];
        let textForTranslation = text;
        let match;
        
        while ((match = placeholderPattern.exec(text)) !== null) {
            placeholders.push(match[0]);
        }
        
        placeholders.forEach((p, i) => {
            textForTranslation = textForTranslation.replace(p, `{{PH${i}}}`);
        });
        
        return googleTranslate(textForTranslation, targetLang).then(translated => {
            if (!translated) return null;
            let finalTranslation = translated;
            placeholders.forEach((p, i) => {
                finalTranslation = finalTranslation.replace(`{{PH${i}}}`, p);
            });
            return finalTranslation;
        });
    }

    function getTargetLang() {
        const match = window.location.pathname.match(/\/-?\/([a-z]{2,3})\//);
        return match ? match[1] : 'vi';
    }

    function googleTranslate(text, targetLang) {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(() => {
                reject(new Error('Request timeout after 10s'));
            }, 10000); // 10 second timeout

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
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
    
    function fillTranslation(text) {
        const textarea = document.querySelector('textarea.translation-editor');
        if (!textarea) return false;
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    async function translateAndFill() {
        // Try Zen mode first (row-source-*)
        let sourceRow = document.querySelector('tr[id^="row-source-"]');
        
        // If not Zen, try single string mode (.source-language-group)
        if (!sourceRow) {
            sourceRow = document.querySelector('.source-language-group');
        }
        
        const sourceText = getSourceTextFromRow(sourceRow);
        
        if (!sourceText) {
            alert('Không tìm thấy văn bản nguồn!');
            return;
        }

        try {
            const translated = await processTranslation(sourceText, getTargetLang());
            if (translated) {
                fillTranslation(translated);
            }
        } catch (err) {
            alert('Lỗi dịch: ' + err.message);
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
        }

        autoBtn.onclick = () => {
            autoTranslateEnabled = !autoTranslateEnabled;
            sessionStorage.setItem('weblate-auto-translate', autoTranslateEnabled);
            autoBtn.classList.toggle('active', autoTranslateEnabled);
        };

        // Translate All button for Zen mode
        const translateAllBtn = document.createElement('button');
        translateAllBtn.className = 'weblate-btn';
        translateAllBtn.innerHTML = '🔄 Translate All';
        translateAllBtn.title = 'Dịch tất cả các dòng trong Zen mode (auto-load more)';
        translateAllBtn.onclick = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const targetLang = urlParams.get('lang') || 'vi';
            const skipTranslated = true;
            
            let totalSuccess = 0;
            let totalRows = 0;
            
            // Change button text
            translateAllBtn.innerHTML = '⏳ Translating...';
            translateAllBtn.disabled = true;
            
            try {
                let hasMore = true;
                while (hasMore) {
                    const editRows = document.querySelectorAll('tr[id^="row-edit-"]');
                    totalRows += editRows.length;
                    
                    for (const editRow of editRows) {
                        if (document.activeElement?.tagName === 'TEXTAREA') {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                        
                        const stringId = editRow.id.replace('row-edit-', '');
                        const sourceRow = document.getElementById(`row-source-${stringId}`);
                        if (!sourceRow) continue;
                        
                        const sourceText = getSourceTextFromRow(sourceRow);
                        if (!sourceText) continue;
                        
                        const targetTextarea = editRow.querySelector('textarea.translation-editor');
                        if (!targetTextarea) continue;
                        
                        if (skipTranslated && targetTextarea.value.trim()) continue;
                        
                        try {
                            const translated = await processTranslation(sourceText, targetLang);
                            if (translated) {
                                targetTextarea.value = translated;
                                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                                totalSuccess++;
                            }
                        } catch (e) {
                            console.error('Translation error:', e);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    // Check for last-section with debounce
                    if (document.querySelector('#last-section')) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
                        if (document.querySelector('#last-section')) {
                            break; // Confirmed end
                        }
                    }
                    
                    if (document.activeElement?.tagName === 'TEXTAREA') {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    
                    window.scrollTo(0, document.body.scrollHeight);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (e) {
                console.error('Translate All error:', e);
            } finally {
                // Always restore button
                translateAllBtn.innerHTML = '✅ Done!';
                setTimeout(() => {
                    translateAllBtn.innerHTML = '🔄 Translate All';
                    translateAllBtn.disabled = false;
                }, 2000);
            }
        };

        container.appendChild(googleBtn);
        container.appendChild(autoBtn);
        container.appendChild(translateAllBtn);
        toolbar.appendChild(container);
    }

    function init() {
        addStyles();
        addButtons();

        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(() => {
                    addButtons();
                }, 1000);
            }
        }).observe(document, { subtree: true, childList: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

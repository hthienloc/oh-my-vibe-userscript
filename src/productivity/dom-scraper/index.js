// ==UserScript==
// @name         DOM Scraper Helper
// @namespace    http://tampermonkey.net/
// @version      1.1.1
// @description  Công cụ scrape toàn bộ DOM trang web để đưa cho AI viết userscript
// @author       hthienloc
// @match        *://*/*
// @grant        none
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/dom-scraper.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/dom-scraper.user.js
// @icon         https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/dom-scraper.svg
// ==/UserScript==

(function() {
    'use strict';

    const BUTTON_ID = 'dom-scraper-btn';

    // Add styles
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #${BUTTON_ID} {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 2147483647;
                background: rgba(0, 0, 0, 0.3);
                color: rgba(255, 255, 255, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                width: 36px;
                height: 36px;
                padding: 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: monospace;
                font-size: 11px;
                backdrop-filter: blur(2px);
                transition: all 0.3s;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                opacity: 0.6;
            }
            #${BUTTON_ID}:hover {
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                border-color: rgba(255, 255, 255, 0.5);
                opacity: 1;
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #${BUTTON_ID} .icon {
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    // Scrape toàn bộ DOM
    function scrapeDOM() {
        const result = {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            timestamp: new Date().toISOString(),
            structure: {
                forms: [],
                inputs: [],
                buttons: [],
                tables: [],
                lists: [],
                links: [],
                images: [],
                scripts: [],
                importantSelectors: []
            },
            rawHTML: document.documentElement.outerHTML.substring(0, 50000)
        };

        // Forms
        document.querySelectorAll('form').forEach((form, idx) => {
            result.structure.forms.push({
                index: idx,
                selector: getCssSelector(form),
                action: form.action || null,
                method: form.method || 'get',
                inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(inp => ({
                    type: inp.type || inp.tagName.toLowerCase(),
                    name: inp.name || null,
                    id: inp.id || null,
                    placeholder: inp.placeholder || null,
                    selector: getCssSelector(inp)
                }))
            });
        });

        // Inputs
        document.querySelectorAll('input, textarea, select').forEach((inp, idx) => {
            if (!inp.closest('form')) {
                result.structure.inputs.push({
                    index: idx,
                    type: inp.type || inp.tagName.toLowerCase(),
                    name: inp.name || null,
                    id: inp.id || null,
                    placeholder: inp.placeholder || null,
                    selector: getCssSelector(inp)
                });
            }
        });

        // Buttons
        document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn, [role="button"]').forEach((btn, idx) => {
            result.structure.buttons.push({
                index: idx,
                tag: btn.tagName.toLowerCase(),
                text: btn.textContent.trim().substring(0, 100),
                id: btn.id || null,
                classes: btn.className ? btn.className.split(' ').filter(c => c) : [],
                selector: getCssSelector(btn)
            });
        });

        // Tables
        document.querySelectorAll('table').forEach((table, idx) => {
            result.structure.tables.push({
                index: idx,
                selector: getCssSelector(table),
                rows: table.rows.length,
                cols: table.rows[0] ? table.rows[0].cells.length : 0
            });
        });

        // Lists
        document.querySelectorAll('ul, ol').forEach((list, idx) => {
            result.structure.lists.push({
                index: idx,
                tag: list.tagName.toLowerCase(),
                selector: getCssSelector(list),
                items: list.children.length
            });
        });

        // Links
        const links = document.querySelectorAll('a[href]');
        result.structure.links = {
            count: links.length,
            samples: Array.from(links).slice(0, 20).map(a => ({
                text: a.textContent.trim().substring(0, 50),
                href: a.href,
                selector: getCssSelector(a)
            }))
        };

        // Images
        const images = document.querySelectorAll('img[src]');
        result.structure.images = {
            count: images.length,
            samples: Array.from(images).slice(0, 10).map(img => ({
                src: img.src,
                alt: img.alt || null,
                selector: getCssSelector(img)
            }))
        };

        // Scripts
        result.structure.scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);

        // Important selectors (IDs, classes phổ biến)
        const idSet = new Set();
        const classSet = new Set();
        document.querySelectorAll('[id]').forEach(el => idSet.add(`#${el.id}`));
        document.querySelectorAll('[class]').forEach(el => {
            if (el.className && typeof el.className === 'string') {
                el.className.split(' ').filter(c => c).forEach(c => classSet.add(`.${c}`));
            }
        });
        result.structure.importantSelectors = {
            ids: Array.from(idSet).slice(0, 30),
            classes: Array.from(classSet).slice(0, 50)
        };

        return result;
    }

    // Get CSS selector
    function getCssSelector(el) {
        if (!el || el === document.body) return 'body';
        let path = [];
        while (el && el !== document.body) {
            let selector = el.tagName.toLowerCase();
            if (el.id) {
                selector += `#${el.id}`;
                path.unshift(selector);
                break;
            }
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(c => c);
                if (classes.length) selector += `.${classes.join('.')}`;
            }
            const parent = el.parentElement;
            if (parent) {
                const siblings = parent.children;
                if (siblings.length > 1) {
                    let index = 1;
                    for (let i = 0; i < siblings.length; i++) {
                        if (siblings[i] === el) break;
                        if (siblings[i].tagName === el.tagName) index++;
                    }
                    if (index > 1) selector += `:nth-of-type(${index})`;
                }
            }
            path.unshift(selector);
            el = parent;
        }
        return path.join(' > ');
    }

    // Format for AI
    function formatForAI(data) {
        return `// ========================================
// DOM SCRAPER OUTPUT FOR AI USERSCRIPT GENERATION
// ========================================
// URL: ${data.url}
// Title: ${data.title}
// Domain: ${data.domain}
// Timestamp: ${data.timestamp}
// ========================================

// PAGE STRUCTURE SUMMARY
// Forms: ${data.structure.forms.length}
// Buttons: ${data.structure.buttons.length}
// Inputs (outside forms): ${data.structure.inputs.length}
// Tables: ${data.structure.tables.length}
// Links: ${data.structure.links.count}
// Images: ${data.structure.images.count}

// FORMS
${data.structure.forms.map(f => `// Form ${f.index}: selector="${f.selector}", action="${f.action}", method="${f.method}"
//   Inputs: ${f.inputs.map(i => `${i.type}(${i.name || i.id || 'no-name'})`).join(', ')}`).join('\n')}

// BUTTONS (sample)
${data.structure.buttons.slice(0, 15).map(b => `// "${b.text}" | selector: ${b.selector}`).join('\n')}

// IMPORTANT SELECTORS
// IDs: ${data.structure.importantSelectors.ids.join(', ')}
// Common classes: ${data.structure.importantSelectors.classes.slice(0, 20).join(', ')}

// RAW HTML (truncated to 50k chars)
/*
${data.rawHTML}
*/

// ========================================
// END OF DOM SCRAPER OUTPUT
// ========================================
// Use this info to write a userscript for: ${data.domain}
`;
    }

    // Download file
    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Main action
    function handleClick() {
        try {
            const data = scrapeDOM();
            const formatted = formatForAI(data);
            const filename = `dom-scrape-${window.location.hostname}-${Date.now()}.txt`;
            downloadFile(formatted, filename);
            alert(`Đã scrape xong! File: ${filename}`);
        } catch (err) {
            alert('Lỗi khi scrape: ' + err.message);
        }
    }

    // Initialize
    function init() {
        addStyles();

        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.innerHTML = `<span class="icon" style="display:flex"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="24"/><path d="M20 25h24M20 32h24M20 39h16"/><path d="M42 35l6 6M42 47l6-6"/></svg></span>`;
        button.title = 'Scrape toàn bộ DOM trang này để đưa cho AI viết userscript';
        button.onclick = handleClick;
        document.body.appendChild(button);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

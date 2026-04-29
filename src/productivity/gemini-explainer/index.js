// ==UserScript==
// @name         Gemini Explainer (Everywhere)
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Highlight text to quickly ask Google Gemini to explain it.
// @author       hthienloc
// @match        *://*/*
// @grant        none
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/gemini-explainer.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/gemini-explainer.user.js
// ==/UserScript==

(function() {
    'use strict';

    const ICON_ID = 'vibecode-gemini-explainer-icon';
    
    // SVG for Gemini icon (Sparkle)
    const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><path d="M10.268 21.432c-1.129 2.115-4.148 2.115-5.277 0L2.247 16.29A4.1 4.1 0 0 1 .5 13.5v0c0-2.213 1.724-4.045 3.931-4.17l5.441-.307c2.148-.121 3.864 1.547 3.932 3.69l.307 5.44a4.1 4.1 0 0 1-3.843 4.279v0zm0 0c.264-1.393 1.341-2.47 2.734-2.734a4.1 4.1 0 0 1 4.542 2.378l1.397 3.32a2.05 2.05 0 0 1-3.793 1.597l-1.397-3.32c-.771-1.83-2.924-2.274-4.307-1.126zM22.058 8.163c-.87 1.631-3.197 1.631-4.067 0L15.35 3.197a3.16 3.16 0 0 1-1.347-2.15v0c0-1.706 1.33-3.118 3.031-3.214l4.195-.237c1.656-.093 2.979 1.193 3.032 2.845l.237 4.195a3.16 3.16 0 0 1-2.964 3.3v0z"/></svg>`;

    function createIcon() {
        let icon = document.getElementById(ICON_ID);
        if (!icon) {
            icon = document.createElement('div');
            icon.id = ICON_ID;
            icon.innerHTML = SVG_ICON;
            document.body.appendChild(icon);
            
            // Basic styling for minimalist vibe, supporting light/dark themes
            icon.style.position = 'absolute';
            icon.style.display = 'none';
            icon.style.zIndex = '2147483647'; // Max z-index
            icon.style.cursor = 'pointer';
            
            // Colors: adapting to page brightness conceptually, but simple light/dark works
            icon.style.background = '#f5f5f7';
            icon.style.border = '1px solid #e1e1e1';
            icon.style.borderRadius = '50%';
            icon.style.padding = '6px';
            icon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            icon.style.color = '#1a1a1a';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
            icon.style.transition = 'transform 0.1s ease, background 0.1s ease';

            // Add hover effect
            icon.addEventListener('mouseenter', () => {
                icon.style.transform = 'scale(1.1)';
                icon.style.background = '#e8e8ed';
            });
            icon.addEventListener('mouseleave', () => {
                icon.style.transform = 'scale(1)';
                icon.style.background = '#f5f5f7';
            });

            // Media query approach in js for dark mode support
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                icon.style.background = '#1c1c1e';
                icon.style.border = '1px solid #333333';
                icon.style.color = '#f5f5f7';
                icon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
                
                icon.addEventListener('mouseenter', () => {
                    icon.style.background = '#2c2c2e';
                });
                icon.addEventListener('mouseleave', () => {
                    icon.style.background = '#1c1c1e';
                });
            }
            
            icon.addEventListener('click', handleIconClick);
        }
        return icon;
    }

    let currentSelectedText = '';

    function handleIconClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (currentSelectedText) {
            const prompt = `Explain this concept to me as if I am 5 years old: ${currentSelectedText}`;
            window.open('https://gemini.google.com/app?q=' + encodeURIComponent(prompt), '_blank');
            hideIcon();
            window.getSelection().removeAllRanges();
        }
    }

    function hideIcon() {
        const icon = document.getElementById(ICON_ID);
        if (icon) {
            icon.style.display = 'none';
        }
        currentSelectedText = '';
    }

    function handleSelection(e) {
        // Don't trigger if clicking on the icon itself
        if (e.target && e.target.closest && e.target.closest('#' + ICON_ID)) {
            return;
        }

        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            
            if (text.length > 0) {
                currentSelectedText = text;
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                showIcon(rect);
            } else {
                hideIcon();
            }
        }, 10);
    }

    function showIcon(rect) {
        const icon = createIcon();
        
        // Calculate position relative to document
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // Position slightly above and to the right of the selection
        icon.style.left = `${rect.right + scrollX + 5}px`;
        icon.style.top = `${rect.top + scrollY - 10}px`;
        icon.style.display = 'flex';
    }

    // Monitor global mouseup
    document.addEventListener('mouseup', handleSelection);
})();

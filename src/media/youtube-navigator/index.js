// ==UserScript==
// @name         YouTube Keyboard Navigator
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.0.2
// @description  Navigate through YouTube videos using arrow keys. Enter to play, Ctrl+Enter to open in new tab.
// @author       hthienloc
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/media/youtube-navigator.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/media/youtube-navigator.user.js
// ==/UserScript==

(function() {
    'use strict';

    const SELECTORS = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer';
    const FOCUS_CLASS = 'yt-keyboard-focused';
    let currentIndex = -1;

    // Inject CSS for visual feedback
    const style = document.createElement('style');
    style.textContent = `
        .${FOCUS_CLASS} {
            outline: 4px solid #ff69b4 !important; /* Hot Pink */
            outline-offset: 4px !important; /* Move border outside */
            border-radius: 8px !important;
            box-shadow: 0 0 15px rgba(255,105,180,0.6) !important;
            transition: outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out !important;
            z-index: 9999 !important;
            position: relative !important;
        }
    `;
    document.head.appendChild(style);

    function initAutoSelect() {
        const items = getItems();
        if (items.length > 0 && currentIndex === -1) {
            updateFocus(items, 0);
        }
    }

    // Run on initial load
    setTimeout(initAutoSelect, 2000); // Wait for YT to load content
    
    // Check periodically if content changes
    setInterval(() => {
        if (currentIndex === -1) initAutoSelect();
    }, 3000);

    function getItems() {
        const items = Array.from(document.querySelectorAll(SELECTORS));
        // Filter out hidden items
        return items.filter(item => {
            const rect = item.getBoundingClientRect();
            // ytd-rich-item-renderer might have a [is-dismissed] attribute or hidden property
            if (item.hasAttribute('is-dismissed') || item.hidden) return false;
            return rect.width > 0 && rect.height > 0 && getComputedStyle(item).display !== 'none' && getComputedStyle(item).visibility !== 'hidden';
        });
    }

    function getGrid(items) {
        if (items.length === 0) return { rows: [], itemToPos: new Map() };
        
        let rows = [];
        let currentRow = [];
        let currentY = -1;

        for (const item of items) {
            const rect = item.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            
            if (currentRow.length === 0) {
                currentRow.push(item);
                currentY = centerY;
            } else {
                // Tolerance for items in the same row
                if (Math.abs(centerY - currentY) < 60) {
                    currentRow.push(item);
                } else {
                    rows.push(currentRow);
                    currentRow = [item];
                    currentY = centerY;
                }
            }
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        const itemToPos = new Map();
        rows.forEach((row, rIdx) => {
            // Sort items in a row by their X coordinate to ensure correct L/R navigation
            row.sort((a, b) => {
                const rectA = a.getBoundingClientRect();
                const rectB = b.getBoundingClientRect();
                return rectA.left - rectB.left;
            });
            row.forEach((item, cIdx) => {
                itemToPos.set(item, { r: rIdx, c: cIdx });
            });
        });

        return { rows, itemToPos };
    }

    function findNextIndex(items, currentIdx, direction) {
        if (currentIdx < 0) return 0;

        const { rows, itemToPos } = getGrid(items);
        const currentItem = items[currentIdx];
        const pos = itemToPos.get(currentItem);
        
        if (!pos) return 0;

        let { r, c } = pos;

        if (direction === 'ArrowLeft') {
            c -= 1;
            if (c < 0) {
                r -= 1;
                if (r >= 0) {
                    c = rows[r].length - 1;
                } else {
                    r = 0;
                    c = 0;
                }
            }
        } else if (direction === 'ArrowRight') {
            c += 1;
            if (c >= rows[r].length) {
                r += 1;
                if (r < rows.length) {
                    c = 0;
                } else {
                    r = rows.length - 1;
                    c = rows[r].length - 1;
                }
            }
        } else if (direction === 'ArrowUp') {
            r -= 1;
            if (r < 0) r = 0;
            if (c >= rows[r].length) {
                c = rows[r].length - 1;
            }
        } else if (direction === 'ArrowDown') {
            r += 1;
            if (r >= rows.length) r = rows.length - 1;
            if (c >= rows[r].length) {
                c = rows[r].length - 1;
            }
        }

        const nextItem = rows[r][c];
        return items.indexOf(nextItem);
    }

    function updateFocus(items, newIndex) {
        if (currentIndex >= 0 && currentIndex < items.length) {
            items[currentIndex].classList.remove(FOCUS_CLASS);
        }
        currentIndex = newIndex;
        if (currentIndex >= 0 && currentIndex < items.length) {
            const el = items[currentIndex];
            el.classList.add(FOCUS_CLASS);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function getLink(item) {
        return item.querySelector('a#thumbnail') || item.querySelector('a.ytd-thumbnail') || item.querySelector('a.yt-simple-endpoint');
    }

    document.addEventListener('keydown', (e) => {
        // Do not interfere if user is typing in an input
        const activeElement = document.activeElement;
        if (activeElement) {
            const tag = activeElement.tagName.toLowerCase();
            const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
            if (isInput || activeElement.isContentEditable) {
                return;
            }
        }

        const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (navKeys.includes(e.key)) {
            e.preventDefault();
            const items = getItems();
            if (items.length === 0) return;

            const newIdx = findNextIndex(items, currentIndex, e.key);
            updateFocus(items, newIdx);
        } else if (e.key === 'Enter') {
            if (currentIndex >= 0) {
                const items = getItems();
                if (currentIndex < items.length) {
                    const link = getLink(items[currentIndex]);
                    if (link) {
                        e.preventDefault();
                        if (e.ctrlKey || e.metaKey) {
                            // Open in new background tab
                            const event = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                ctrlKey: true,
                                metaKey: e.metaKey
                            });
                            link.dispatchEvent(event);
                            
                            // Fallback if event dispatching is blocked
                            if (!event.defaultPrevented && !e.ctrlKey) {
                                window.open(link.href, '_blank');
                            }
                        } else {
                            link.click();
                        }
                    }
                }
            }
        }
    });

    // Handle YouTube SPA Navigation
    document.addEventListener('yt-navigate-start', () => {
        currentIndex = -1;
        const focusedElements = document.querySelectorAll(`.${FOCUS_CLASS}`);
        focusedElements.forEach(el => el.classList.remove(FOCUS_CLASS));
    });

})();

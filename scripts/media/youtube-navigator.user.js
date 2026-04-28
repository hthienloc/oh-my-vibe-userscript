// ==UserScript==
// @name         YouTube Keyboard Navigator
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.1.0
// @description  Navigate through YouTube videos using arrow keys. Enter to play, Space to open in new tab.
// @author       hthienloc
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/media/youtube-navigator.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/media/youtube-navigator.user.js
// ==/UserScript==

(function() {
    'use strict';

    const VIDEO_SELECTORS = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer';
    const SIDEBAR_SELECTORS = 'ytd-guide-entry-renderer, #endpoint.yt-guide-entry-renderer';
    const SELECTORS = `${VIDEO_SELECTORS}, ${SIDEBAR_SELECTORS}`;
    const FOCUS_CLASS = 'yt-keyboard-focused';
    let currentIndex = -1;
    let isSearchFocused = false;

    // Inject CSS for visual feedback
    const style = document.createElement('style');
    style.textContent = `
        .${FOCUS_CLASS} {
            outline: 4px solid rgba(255, 105, 180, 0.7) !important; /* Hot Pink */
            outline-offset: 8px !important; /* Move border outside */
            border-radius: 8px !important;
            box-shadow: 0 0 15px rgba(255,105,180,0.6) !important;
            transition: outline 0.1s ease-in-out, box-shadow 0.1s ease-in-out !important;
            z-index: 100 !important;
            position: relative !important;
        }
    `;
    document.head.appendChild(style);

    function initAutoSelect() {
        if (isSearchFocused) return;
        const items = getItems();
        if (items.length > 0 && currentIndex === -1) {
            const firstVideoIndex = items.findIndex(item => !isSidebarItem(item));
            updateFocus(items, firstVideoIndex >= 0 ? firstVideoIndex : 0);
        }
    }

    function isSidebarItem(item) {
        return item.matches(SIDEBAR_SELECTORS);
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
        const videoItems = [];
        for (let i = 0; i < items.length; i++) {
            if (!isSidebarItem(items[i])) {
                videoItems.push(items[i]);
            }
        }
        if (videoItems.length === 0) return { rows: [], itemToPos: new Map() };
        
        let rows = [];
        
        // Group by YouTube's native rich grid rows
        const richGridRows = Array.from(document.querySelectorAll('ytd-rich-grid-row'));
        if (richGridRows.length > 0) {
            for (let i = 0; i < richGridRows.length; i++) {
                const rowEl = richGridRows[i];
                // Find videoItems that are descendants of this row
                const itemsInRow = [];
                for (let j = 0; j < videoItems.length; j++) {
                    if (rowEl.contains(videoItems[j])) {
                        itemsInRow.push(videoItems[j]);
                    }
                }
                
                if (itemsInRow.length > 0) {
                    // Sort items in this row by their visual left position
                    itemsInRow.sort((a, b) => {
                        const rectA = a.getBoundingClientRect();
                        const rectB = b.getBoundingClientRect();
                        return rectA.left - rectB.left;
                    });
                    rows.push(itemsInRow);
                }
            }
        } else {
            // Very basic fallback if not on home page (e.g., search results usually just vertical list)
            for (let i = 0; i < videoItems.length; i++) {
                rows.push([videoItems[i]]);
            }
        }

        const itemToPos = new Map();
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const row = rows[rIdx];
            for (let cIdx = 0; cIdx < row.length; cIdx++) {
                itemToPos.set(row[cIdx], { r: rIdx, c: cIdx });
            }
        }

        return { rows, itemToPos };
    }

    function findNextIndex(items, currentIdx, direction) {
        if (currentIdx < 0) return 0;
        
        const currentItem = items[currentIdx];
        
        if (isSidebarItem(currentItem)) {
            return findNextSidebarIndex(items, currentIdx, direction);
        }

        return findNextVideoIndex(items, currentIdx, direction);
    }
    
    function findNextSidebarIndex(items, currentIdx, direction) {
        if (direction === 'ArrowUp') {
            for (let i = currentIdx - 1; i >= 0; i--) {
                if (isSidebarItem(items[i])) return i;
            }
            return currentIdx;
        } else if (direction === 'ArrowDown') {
            for (let i = currentIdx + 1; i < items.length; i++) {
                if (isSidebarItem(items[i])) return i;
            }
            return currentIdx;
        } else if (direction === 'ArrowRight') {
            const currentItem = items[currentIdx];
            const currentRect = currentItem.getBoundingClientRect();
            const currentY = currentRect.top + currentRect.height / 2;
            
            let closestVideoIdx = -1;
            let minDistance = Infinity;
            
            for (let i = 0; i < items.length; i++) {
                if (!isSidebarItem(items[i])) {
                    const vidRect = items[i].getBoundingClientRect();
                    const vidY = vidRect.top + vidRect.height / 2;
                    const dist = Math.abs(vidY - currentY);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestVideoIdx = i;
                    }
                }
            }
            
            if (closestVideoIdx !== -1) {
                return closestVideoIdx;
            }
            return currentIdx;
        } else if (direction === 'ArrowLeft') {
            return currentIdx; // Already in sidebar
        }
        return currentIdx;
    }

    function findNextVideoIndex(items, currentIdx, direction) {
        if (currentIdx < 0) return 0;

        const { rows, itemToPos } = getGrid(items);
        const currentItem = items[currentIdx];
        const pos = itemToPos.get(currentItem);
        
        if (!pos) return 0;

        let { r, c } = pos;

        if (direction === 'ArrowLeft') {
            if (c === 0) {
                // Try to go to sidebar
                const currentRect = currentItem.getBoundingClientRect();
                const currentY = currentRect.top + currentRect.height / 2;
                
                let closestSidebarIdx = -1;
                let minDistance = Infinity;
                
                for (let i = 0; i < items.length; i++) {
                    if (isSidebarItem(items[i])) {
                        const sbRect = items[i].getBoundingClientRect();
                        const sbY = sbRect.top + sbRect.height / 2;
                        const dist = Math.abs(sbY - currentY);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestSidebarIdx = i;
                        }
                    }
                }
                
                if (closestSidebarIdx !== -1) {
                    return closestSidebarIdx;
                }
            }
            
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

    function clearAllHighlights() {
        const focusedElements = document.querySelectorAll(`.${FOCUS_CLASS}`);
        for (let i = 0; i < focusedElements.length; i++) {
            focusedElements[i].classList.remove(FOCUS_CLASS);
        }
    }

    function updateFocus(items, newIndex) {
        clearAllHighlights();
        currentIndex = newIndex;
        
        if (currentIndex >= 0 && currentIndex < items.length) {
            const el = items[currentIndex];
            el.classList.add(FOCUS_CLASS);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function getLink(item) {
        if (isSidebarItem(item)) {
            if (item.tagName.toLowerCase() === 'a') return item;
            return item.querySelector('a.yt-simple-endpoint') || item.querySelector('a#endpoint');
        }

        const links = item.querySelectorAll('a[href*="watch?v="]');
        if (links.length > 0) {
            return links[0];
        }
        return item.querySelector('a#thumbnail') || item.querySelector('a.ytd-thumbnail') || item.querySelector('a.yt-simple-endpoint');
    }
    
    // Track search input focus
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target.tagName && target.tagName.toLowerCase() === 'input' && target.id === 'search') {
            isSearchFocused = true;
            clearAllHighlights();
        }
    });

    document.addEventListener('focusout', (e) => {
        const target = e.target;
        if (target && target.tagName && target.tagName.toLowerCase() === 'input' && target.id === 'search') {
            isSearchFocused = false;
        }
    });

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

        // Bail out early if Alt is pressed to preserve system shortcuts
        if (e.altKey) {
            return;
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
                        // Open in current tab
                        window.location.href = link.href;
                    }
                }
            }
        } else if (e.key === ' ' || e.key === 'Spacebar') {
            const isWatchPage = window.location.pathname.startsWith('/watch');
            if (currentIndex >= 0 && !isWatchPage) {
                const items = getItems();
                if (currentIndex < items.length) {
                    const link = getLink(items[currentIndex]);
                    if (link) {
                        e.preventDefault();
                        // Open in new tab
                        window.open(link.href, '_blank');
                    }
                }
            }
        }
    });

    // Handle YouTube SPA Navigation
    document.addEventListener('yt-navigate-start', () => {
        currentIndex = -1;
        clearAllHighlights();
    });

})();

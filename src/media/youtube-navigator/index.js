// ==UserScript==
// @name         YouTube Keyboard Navigator
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.0.8
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
    let hoverTimeout = null;

    // Inject CSS for visual feedback
    const style = document.createElement('style');
    style.textContent = `
        .${FOCUS_CLASS} {
            outline: 4px solid #ff69b4 !important; /* Hot Pink */
            outline-offset: 4px !important; /* Move border outside */
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
        
        // Sort items vertically to ensure correct row grouping regardless of DOM order
        videoItems.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            return (rectA.top + rectA.height / 2) - (rectB.top + rectB.height / 2);
        });

        let rows = [];
        let currentRow = [];
        let currentY = -1;
        let currentHeight = 0;

        for (let i = 0; i < videoItems.length; i++) {
            const item = videoItems[i];
            const rect = item.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            
            if (currentRow.length === 0) {
                currentRow.push(item);
                currentY = centerY;
                currentHeight = rect.height;
            } else {
                // Tolerance for items in the same row
                if (Math.abs(centerY - currentY) < Math.max(60, currentHeight / 3)) {
                    currentRow.push(item);
                } else {
                    rows.push(currentRow);
                    currentRow = [item];
                    currentY = centerY;
                    currentHeight = rect.height;
                }
            }
        }
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        const itemToPos = new Map();
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const row = rows[rIdx];
            // Sort items in a row by their X coordinate to ensure correct L/R navigation
            row.sort((a, b) => {
                const rectA = a.getBoundingClientRect();
                const rectB = b.getBoundingClientRect();
                return rectA.left - rectB.left;
            });
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

    function getPreviewTarget(item) {
        return item.querySelector('ytd-thumbnail') || item.querySelector('a#thumbnail');
    }

    function cancelHover() {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
    }

    function triggerHoverLeave(item) {
        const target = getPreviewTarget(item);
        if (target) {
            target.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
            target.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
            target.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
        }
    }

    function triggerHoverEnter(item) {
        const target = getPreviewTarget(item);
        if (target) {
            target.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
            target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        }
    }

    function updateFocus(items, newIndex) {
        if (currentIndex >= 0 && currentIndex < items.length) {
            const oldItem = items[currentIndex];
            oldItem.classList.remove(FOCUS_CLASS);
            cancelHover();
            triggerHoverLeave(oldItem);
        }
        
        currentIndex = newIndex;
        
        if (currentIndex >= 0 && currentIndex < items.length) {
            const el = items[currentIndex];
            el.classList.add(FOCUS_CLASS);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            cancelHover();
            hoverTimeout = setTimeout(() => {
                triggerHoverEnter(el);
            }, 400);
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
            cancelHover();
            if (currentIndex >= 0) {
                const items = getItems();
                if (currentIndex < items.length) {
                    triggerHoverLeave(items[currentIndex]);
                }
            }
            const focusedElements = document.querySelectorAll(`.${FOCUS_CLASS}`);
            focusedElements.forEach(el => el.classList.remove(FOCUS_CLASS));
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
        cancelHover();
        if (currentIndex >= 0) {
            const items = getItems();
            if (currentIndex < items.length) {
                triggerHoverLeave(items[currentIndex]);
            }
        }
        currentIndex = -1;
        const focusedElements = document.querySelectorAll(`.${FOCUS_CLASS}`);
        focusedElements.forEach(el => el.classList.remove(FOCUS_CLASS));
    });

})();

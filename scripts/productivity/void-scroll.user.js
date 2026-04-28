// ==UserScript==
// @name         Void Scroll
// @namespace    http://tampermonkey.net/
// @version      1.0.7
// @description  Anti-doom-scrolling script that forces a 30-second blackout after 10 videos on YouTube/Facebook.
// @author       Vibecode
// @match        https://*.youtube.com/*
// @match        https://*.facebook.com/*
// @grant        none
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/void-scroll.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/void-scroll.user.js
// ==/UserScript==

(function() {
    'use strict';

    const VIDEO_LIMIT = 10;
    const BLACKOUT_DURATION_MS = 30 * 1000;
    const STORAGE_KEY_COUNT = 'void_scroll_count';
    const STORAGE_KEY_LOCK = 'void_scroll_lock_until';
    const STORAGE_KEY_STATS_DATE = 'void_scroll_stats_date';
    const STORAGE_KEY_STATS_COUNT = 'void_scroll_stats_count';
    const MAX_PUNISHMENT_MS = 60 * 1000;
    const PUNISHMENT_INCREMENT_MS = 5 * 1000;
    
    const SARCASTIC_MESSAGES = [
        "Really?",
        "Still scrolling?",
        "The void is unimpressed.",
        "Is it that urgent?",
        "Patience is a virtue.",
        "Just look at the wall for a bit."
    ];

    // State
    let currentVideoId = null;
    let observer = null;
    let trackingSet = new Set(); // To prevent double counting Reels/Feed videos

    // Minimalist Styles for the Void
    const addStyles = () => {
        if (document.getElementById('void-scroll-styles')) return;
        const style = document.createElement('style');
        style.id = 'void-scroll-styles';
        style.textContent = `
            #void-scroll-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: #000000;
                color: #ffffff;
                z-index: 2147483647; /* Max z-index */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                pointer-events: all; /* Block interactions */
            }
            #void-scroll-message {
                font-size: 24px;
                font-weight: 300;
                margin-bottom: 20px;
                letter-spacing: 0.5px;
                text-align: center;
                padding: 0 20px;
                z-index: 2;
            }
            #void-scroll-timer {
                font-size: 48px;
                font-weight: 100;
                font-variant-numeric: tabular-nums;
                z-index: 2;
            }
            #void-scroll-breath {
                position: absolute;
                width: 200px;
                height: 200px;
                border-radius: 50%;
                background-color: rgba(255, 255, 255, 0.05);
                animation: breathe 8s infinite ease-in-out;
                z-index: 1;
                pointer-events: none;
            }
            #void-scroll-stats {
                position: absolute;
                bottom: 20px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
                z-index: 2;
            }
            @keyframes breathe {
                0%, 100% { transform: scale(1); opacity: 0.2; }
                50% { transform: scale(1.5); opacity: 0.6; }
            }
            body.void-scroll-locked {
                overflow: hidden !important;
            }
        `;
        document.head.appendChild(style);
    };

    // --- Core Logic ---

    const getCount = () => parseInt(localStorage.getItem(STORAGE_KEY_COUNT) || '0', 10);
    const setCount = (c) => localStorage.setItem(STORAGE_KEY_COUNT, c);
    
    const getLockTime = () => parseInt(localStorage.getItem(STORAGE_KEY_LOCK) || '0', 10);
    const setLockTime = (t) => localStorage.setItem(STORAGE_KEY_LOCK, t);

    const getTodayString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    };

    const getStatsCount = () => {
        const date = localStorage.getItem(STORAGE_KEY_STATS_DATE);
        const today = getTodayString();
        if (date !== today) {
            localStorage.setItem(STORAGE_KEY_STATS_DATE, today);
            localStorage.setItem(STORAGE_KEY_STATS_COUNT, '0');
            return 0;
        }
        return parseInt(localStorage.getItem(STORAGE_KEY_STATS_COUNT) || '0', 10);
    };

    const incrementStatsCount = () => {
        const count = getStatsCount() + 1;
        localStorage.setItem(STORAGE_KEY_STATS_COUNT, count.toString());
        return count;
    };

    const incrementCounter = () => {
        const currentCount = getCount();
        const newCount = currentCount + 1;
        setCount(newCount);
        console.log(`[Void Scroll] Video watched: ${newCount} / ${VIDEO_LIMIT}`);
        
        if (newCount >= VIDEO_LIMIT) {
            triggerBlackout();
        }
    };

    const triggerBlackout = (existingLockTime = null) => {
        let lockUntil = existingLockTime;
        if (!lockUntil) {
            lockUntil = Date.now() + BLACKOUT_DURATION_MS;
            setLockTime(lockUntil);
            incrementStatsCount();
        }

        const remainingMs = lockUntil - Date.now();
        if (remainingMs <= 0) {
            resetVoid();
            return;
        }

        // Audio-Kill via Redirection
        document.querySelectorAll('video').forEach(v => {
            try { v.pause(); } catch (e) {}
        });

        if (window.location.pathname !== '/') {
            window.location.href = '/';
            // Show overlay during the redirection delay to maintain immersion
        }

        showOverlay(lockUntil);
    };

    const showOverlay = (initialLockUntil) => {
        addStyles();
        document.body.classList.add('void-scroll-locked');

        let lockUntil = initialLockUntil;
        const statsCount = getStatsCount();

        let overlay = document.getElementById('void-scroll-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'void-scroll-overlay';
            overlay.innerHTML = `
                <div id="void-scroll-breath"></div>
                <div id="void-scroll-message">Time to reflect. Look at the void for a moment.</div>
                <div id="void-scroll-timer"></div>
                <div id="void-scroll-stats">You have faced the void ${statsCount} times today.</div>
            `;
            document.documentElement.appendChild(overlay); // Append to HTML to ensure it covers everything
        }

        const timerEl = document.getElementById('void-scroll-timer');
        const messageEl = document.getElementById('void-scroll-message');

        let lastActivityTime = 0;
        let lastFrameTime = Date.now();
        let lastMessageTime = 0;
        let lastPunishmentTime = 0;
        let lastSyncTime = Date.now();

        const updateTimer = () => {
            const now = Date.now();
            const elapsed = now - lastFrameTime;
            lastFrameTime = now;

            if (now - lastActivityTime < 1000) {
                lockUntil += elapsed;
            }

            if (now - lastSyncTime > 500) {
                setLockTime(Math.ceil(lockUntil));
                lastSyncTime = now;
            }

            const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));
            timerEl.textContent = remaining;

            if (remaining <= 0) {
                resetVoid();
            } else {
                requestAnimationFrame(updateTimer);
            }
        };

        requestAnimationFrame(updateTimer);
        
        // Prevent escape via scrolling or keypresses
        const blockEvent = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const now = Date.now();
            lastActivityTime = now;
            
            if (e.type === 'wheel' || e.type === 'touchmove') {
                if (now - lastPunishmentTime > 2000) {
                    lastPunishmentTime = now;
                    const currentRemaining = lockUntil - now;
                    if (currentRemaining < MAX_PUNISHMENT_MS) {
                        lockUntil = Math.min(now + MAX_PUNISHMENT_MS, lockUntil + PUNISHMENT_INCREMENT_MS);
                        setLockTime(Math.ceil(lockUntil));
                        lastSyncTime = now;
                    }
                }
            }

            if (now - lastMessageTime > 2000) {
                lastMessageTime = now;
                const randomMessage = SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)];
                if (messageEl) {
                    messageEl.textContent = randomMessage;
                }
            }
        };
        window.addEventListener('keydown', blockEvent, { capture: true });
        window.addEventListener('wheel', blockEvent, { passive: false, capture: true });
        window.addEventListener('touchmove', blockEvent, { passive: false, capture: true });
        
        // Store cleanup function
        window._voidScrollCleanup = () => {
            window.removeEventListener('keydown', blockEvent, { capture: true });
            window.removeEventListener('wheel', blockEvent, { passive: false, capture: true });
            window.removeEventListener('touchmove', blockEvent, { passive: false, capture: true });
        };
    };

    const resetVoid = () => {
        setCount(0);
        setLockTime(0);
        document.body.classList.remove('void-scroll-locked');
        const overlay = document.getElementById('void-scroll-overlay');
        if (overlay) overlay.remove();
        if (window._voidScrollCleanup) window._voidScrollCleanup();
    };

    // --- Check Lock on Load ---
    const checkInitialLock = () => {
        const lockUntil = getLockTime();
        if (lockUntil > Date.now()) {
            triggerBlackout(lockUntil);
        } else if (lockUntil > 0 && lockUntil <= Date.now()) {
            // Edge case: Time passed while tab was closed
            resetVoid();
        }
    };

    // --- Platform Specific Trackers ---

    // YouTube: Track URL changes (SPA navigation)
    const initYouTubeTracker = () => {
        const checkYoutubeNav = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const videoId = urlParams.get('v');
            const isShorts = window.location.pathname.startsWith('/shorts/');
            const currentId = isShorts ? window.location.pathname : videoId;

            if (currentId && currentId !== currentVideoId) {
                currentVideoId = currentId;
                incrementCounter();
            } else if (!currentId && currentVideoId) {
                currentVideoId = null;
            }
        };

        window.addEventListener('yt-navigate-finish', checkYoutubeNav);
        checkYoutubeNav();
    };

    // Facebook: Track Intersection of video elements & src changes
    const initFacebookTracker = () => {
        const viewTimers = new Map();

        const handleVideoInteraction = (target, vId) => {
            // Cancel any previous timer for this video element if it had a different src
            if (target._voidScrollCurrentSrc && target._voidScrollCurrentSrc !== vId) {
                cancelVideoInteraction(target._voidScrollCurrentSrc);
            }
            target._voidScrollCurrentSrc = vId;

            if (!trackingSet.has(vId) && !viewTimers.has(vId)) {
                const timerId = setTimeout(() => {
                    trackingSet.add(vId);
                    incrementCounter();
                    viewTimers.delete(vId);
                }, 3000); // 3 seconds view time
                viewTimers.set(vId, timerId);
            }
        };

        const cancelVideoInteraction = (vId) => {
            if (viewTimers.has(vId)) {
                clearTimeout(viewTimers.get(vId));
                viewTimers.delete(vId);
            }
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const target = entry.target;
                
                // If the element has no src, it's not a real video to track yet.
                if (!target.src && !target.currentSrc) return;
                
                // Use the video source as the unique identifier to handle Facebook's element reuse
                const vId = target.src || target.currentSrc;
                if (!vId) return;

                if (entry.isIntersecting) {
                    handleVideoInteraction(target, vId);
                } else {
                    cancelVideoInteraction(vId);
                }
            });
        }, { threshold: 0.5 });

        // Watch for 'src' changes on video elements (Facebook element reuse)
        const srcMutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    const target = mutation.target;
                    const newSrc = target.src || target.currentSrc;
                    
                    if (target._voidScrollCurrentSrc && target._voidScrollCurrentSrc !== newSrc) {
                        cancelVideoInteraction(target._voidScrollCurrentSrc);
                    }

                    if (newSrc) {
                        // When source changes, check if it's currently visible
                        const rect = target.getBoundingClientRect();
                        const isVisible = rect.top < (window.innerHeight || document.documentElement.clientHeight) && rect.bottom > 0;
                        
                        if (isVisible) {
                            handleVideoInteraction(target, newSrc);
                        }
                    }
                }
            });
        });

        const setupVideo = (v) => {
            if (!v._voidScrollObserved) {
                v._voidScrollObserved = true;
                observer.observe(v);
                srcMutationObserver.observe(v, { attributes: true, attributeFilter: ['src'] });
                
                // Also listen for play events as a fallback
                v.addEventListener('play', () => {
                    const srcId = v.src || v.currentSrc;
                    if (srcId) {
                        handleVideoInteraction(v, srcId);
                    }
                });
                
                v.addEventListener('pause', () => {
                    const srcId = v.src || v.currentSrc;
                    if (srcId) {
                        cancelVideoInteraction(srcId);
                    }
                });
            }
        };

        const domMutationObserver = new MutationObserver(() => {
            document.querySelectorAll('video').forEach(setupVideo);
        });

        domMutationObserver.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('video').forEach(setupVideo);
    };


    // --- Initialization ---
    const init = () => {
        checkInitialLock();

        const host = window.location.hostname;
        if (host.includes('youtube.com')) {
            initYouTubeTracker();
        } else if (host.includes('facebook.com')) {
            initFacebookTracker();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

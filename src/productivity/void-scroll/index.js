(function() {
    'use strict';

    const VIDEO_LIMIT = 10;
    const BLACKOUT_DURATION_MS = 30 * 1000;
    const STORAGE_KEY_COUNT = 'void_scroll_count';
    const STORAGE_KEY_LOCK = 'void_scroll_lock_until';

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
            }
            #void-scroll-timer {
                font-size: 48px;
                font-weight: 100;
                font-variant-numeric: tabular-nums;
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
        }

        const remainingMs = lockUntil - Date.now();
        if (remainingMs <= 0) {
            resetVoid();
            return;
        }

        showOverlay(lockUntil);
    };

    const showOverlay = (lockUntil) => {
        addStyles();
        document.body.classList.add('void-scroll-locked');

        let overlay = document.getElementById('void-scroll-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'void-scroll-overlay';
            overlay.innerHTML = `
                <div id="void-scroll-message">Time to reflect. Look at the void for a moment.</div>
                <div id="void-scroll-timer"></div>
            `;
            document.documentElement.appendChild(overlay); // Append to HTML to ensure it covers everything
        }

        const timerEl = document.getElementById('void-scroll-timer');

        const updateTimer = () => {
            const now = Date.now();
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

    // Facebook: Track Intersection of video elements
    const initFacebookTracker = () => {
        const viewTimers = new Map();

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const target = entry.target;
                if (!target._voidScrollId) {
                    target._voidScrollId = Math.random().toString(36).substr(2, 9);
                }
                const vId = target._voidScrollId;

                if (entry.isIntersecting) {
                    if (!trackingSet.has(vId) && !viewTimers.has(vId)) {
                        const timerId = setTimeout(() => {
                            trackingSet.add(vId);
                            incrementCounter();
                            viewTimers.delete(vId);
                        }, 3000); // 3 seconds view time
                        viewTimers.set(vId, timerId);
                    }
                } else {
                    if (viewTimers.has(vId)) {
                        clearTimeout(viewTimers.get(vId));
                        viewTimers.delete(vId);
                    }
                }
            });
        }, { threshold: 0.5 });

        const mutationObserver = new MutationObserver(() => {
            document.querySelectorAll('video').forEach(v => {
                if (!v._voidScrollObserved) {
                    v._voidScrollObserved = true;
                    observer.observe(v);
                }
            });
        });

        mutationObserver.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('video').forEach(v => {
            v._voidScrollObserved = true;
            observer.observe(v);
        });
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

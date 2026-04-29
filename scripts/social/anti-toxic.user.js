/**
 * Facebook Anti-Toxic & Spoiler Filter
 * Monitors the newsfeed and hides posts containing blacklisted keywords.
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'vibecode-fb-blacklist';
    let blacklist = JSON.parse(localStorage.getItem(STORAGE_KEY) || '["spoiler", "đề thi", "biến căng"]');

    /**
     * Injects the required CSS styles for the anti-toxic settings UI.
     */
    function injectStyles() {
        if (document.getElementById('vibecode-anti-toxic-styles')) return;
        const style = document.createElement('style');
        style.id = 'vibecode-anti-toxic-styles';
        style.textContent = `
            .vibecode-hidden-post {
                display: none !important;
            }
            #vibecode-anti-toxic-settings {
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 9999;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                width: 200px;
                display: none;
            }
            #vibecode-anti-toxic-settings.active {
                display: block;
            }
            .vibecode-toxic-badge {
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 9998;
                width: 35px;
                height: 35px;
                background: #ff4757;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 18px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            @media (prefers-color-scheme: dark) {
                #vibecode-anti-toxic-settings {
                    background: #242526;
                    border-color: #3e4042;
                    color: white;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Scans and filters Facebook posts based on the blacklist.
     */
    function filterPosts() {
        // Facebook post selectors (can change, so we use multiple common ones)
        const posts = document.querySelectorAll('div[role="feed"] > div, div[data-testid="fbfeed_story"]');
        
        posts.forEach(post => {
            const text = post.innerText.toLowerCase();
            const shouldHide = blacklist.some(word => text.includes(word.toLowerCase()));
            
            if (shouldHide) {
                post.classList.add('vibecode-hidden-post');
            }
        });
    }

    /**
     * Initializes the settings UI and badge.
     */
    function initUI() {
        injectStyles();
        
        const badge = document.createElement('div');
        badge.className = 'vibecode-toxic-badge';
        badge.innerHTML = '🛡️';
        badge.title = 'Anti-Toxic Settings';
        
        const settings = document.createElement('div');
        settings.id = 'vibecode-anti-toxic-settings';
        settings.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">Blacklist Keywords</div>
            <textarea id="vibecode-blacklist-input" style="width: 100%; height: 60px; font-size: 12px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #ccc; padding: 4px;">${blacklist.join(', ')}</textarea>
            <button id="vibecode-save-blacklist" style="width: 100%; background: #1877f2; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">Save</button>
        `;

        badge.onclick = () => settings.classList.toggle('active');
        
        document.body.appendChild(badge);
        document.body.appendChild(settings);

        document.getElementById('vibecode-save-blacklist').onclick = () => {
            const input = document.getElementById('vibecode-blacklist-input').value;
            blacklist = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(blacklist));
            settings.classList.remove('active');
            filterPosts();
        };
    }

    /**
     * Entry point for the userscript. Initializes UI and observers.
     */
    function init() {
        if (!window.location.href.includes('facebook.com')) return;

        initUI();

        // Observer for dynamic loading
        const observer = new MutationObserver(() => {
            filterPosts();
        });

        observer.observe(document.body, { childList: true, subtree: true });
        filterPosts();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

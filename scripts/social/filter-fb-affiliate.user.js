// ==UserScript==
// @name         Facebook Affiliate Comment Filter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically hide comments containing affiliate links or promotional keywords on Facebook.
// @author       hthienloc
// @match        https://www.facebook.com/*
// @updateURL    https://github.com/hthienloc/filter-facebook-comment/raw/main/filter-fb-affiliate.user.js
// @downloadURL  https://github.com/hthienloc/filter-facebook-comment/raw/main/filter-fb-affiliate.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==


(function() {
    'use strict';

    // List of affiliate domains and promotional keywords
    const AFFILIATE_PATTERNS = [
        /shope\.ee/i,
        /shopee\.vn/i,
        /shorten\.asia/i,
        /atv\.sh/i,
        /s\.lazada\.vn/i,
        /lazada\.vn/i,
        /tiki\.vn/i,
        /mycollection\.shop/i,
        /bit\.ly/i,
        /tinyurl\.com/i
    ];

    const SPAM_KEYWORDS = [
        "voucher",
        "mã giảm giá",
        "link mua",
        "chốt đơn",
        "săn sale",
        "ghé shop",
        "quà tặng",
        "mua tại"
    ];

    /**
     * Checks if a comment element contains any affiliate links or spam keywords.
     * @param {HTMLElement} commentNode
     * @returns {boolean}
     */
    function isSpam(commentNode) {
        // 1. Check for affiliate links in <a> tags
        const links = commentNode.querySelectorAll('a');
        for (const link of links) {
            const href = link.href || '';
            const text = link.innerText || '';
            if (AFFILIATE_PATTERNS.some(pattern => pattern.test(href) || pattern.test(text))) {
                return true;
            }
        }

        // 2. Check for spam keywords in text content
        const commentText = (commentNode.innerText || '').toLowerCase();
        if (SPAM_KEYWORDS.some(keyword => commentText.includes(keyword.toLowerCase()))) {
            return true;
        }

        return false;
    }

    /**
     * Hides a comment if it is identified as spam.
     * @param {HTMLElement} commentNode
     */
    function processComment(commentNode) {
        if (commentNode.dataset.affiliateFiltered) return; // Already processed

        if (isSpam(commentNode)) {
            commentNode.style.display = 'none';
            console.log('[FB Filter] Hidden an affiliate/spam comment.');
        }

        commentNode.dataset.affiliateFiltered = 'true';
    }

    /**
     * Scans the document for comments and processes them.
     */
    function scanComments() {
        // Facebook comments usually have role="article"
        const comments = document.querySelectorAll('div[role="article"]');
        comments.forEach(processComment);
    }

    // Use MutationObserver to handle dynamically loaded comments
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            scanComments();
        }
    });

    // Start observing the body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    scanComments();

    console.log('[FB Filter] Userscript loaded and watching for spam comments...');
})();

// ==UserScript==
// @name         Gẹmixi Edition
// @namespace    https://github.com/hthienloc/domixi-gemini
// @version      1.1.0
// @description  Biến Gemini thành Gẹmixi - Ask Cao Bang, Đè Tem, meme Cao Bằng
// @author       hthienloc
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/hthienloc/domixi-gemini
// @supportURL   https://github.com/hthienloc/domixi-gemini/issues
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gemini.google.com
// ==/UserScript==

(function () {
  'use strict';

  // Tên người dùng thật, lấy từ DOM (cập nhật mỗi lần greeting render)
  let userName = 'em';

  // ─────────────────────────────────────────────
  //  Helper: lấy tên từ "Hi/Chào [Tên]"
  // ─────────────────────────────────────────────
  function extractUserName() {
    const greetingDiv = document.querySelector('div[data-test-id="greeting-title"]');
    if (!greetingDiv) return;
    const walker = document.createTreeWalker(greetingDiv, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      const match = t.match(/^(?:Hi|Chào)\s+(.+)$/i);
      if (match) {
        userName = match[1].trim(); // "Tên người dùng"
        return;
      }
    }
  }

  // ─────────────────────────────────────────────
  //  1. PLACEHOLDER
  // ─────────────────────────────────────────────
  function patchPlaceholder() {
    const editor = document.querySelector('.ql-editor[data-placeholder]');
    if (editor && editor.getAttribute('data-placeholder') !== 'Ask Cao Bang') {
      editor.setAttribute('data-placeholder', 'Ask Cao Bang');
    }
  }

  // ─────────────────────────────────────────────
  //  2. LOGO → Gẹmixi (trắng đen đơn giản)
  // ─────────────────────────────────────────────
  function patchLogo() {
    const span = document.querySelector('span[data-test-id="bard-text"]');
    if (!span || span.textContent.trim() === 'Gẹmixi') return;
    span.textContent = ' Gẹmixi';
    span.style.cssText = `
      color: inherit !important;
      font-weight: 800 !important;
      font-style: italic !important;
      letter-spacing: -0.5px !important;
      display: inline !important;
      background: none !important;
      -webkit-text-fill-color: unset !important;
    `;
  }

  // ─────────────────────────────────────────────
  //  3. NEW CHAT → Đè Tem
  // ─────────────────────────────────────────────
  function patchNewChat() {
    const btn = document.querySelector('[data-test-id="new-chat-button"]');
    if (!btn) return;
    [btn, ...btn.querySelectorAll('*')].forEach(el => {
      const label = el.getAttribute('aria-label');
      if (label?.includes('New chat'))
        el.setAttribute('aria-label', label.replace('New chat', 'Đè Tem'));
      const title = el.getAttribute('title');
      if (title?.includes('New chat'))
        el.setAttribute('title', title.replace('New chat', 'Đè Tem'));
    });
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.includes('New chat'))
        node.textContent = node.textContent.replace('New chat', 'Đè Tem');
    }
  }

  // ─────────────────────────────────────────────
  //  4. GREETING: "Hi [Tên]" → dùng tên thật vào meme
  // ─────────────────────────────────────────────
  function patchGreeting() {
    const greetingDiv = document.querySelector('div[data-test-id="greeting-title"]');
    if (!greetingDiv) return;

    const walker = document.createTreeWalker(greetingDiv, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      const match = t.match(/^(?:Hi|Chào)\s+(.+)$/i);
      if (match) {
        userName = match[1].trim();
        node.textContent = ` Alo em có phải ${userName} không? `;
        return;
      }
    }
  }

  // ─────────────────────────────────────────────
  //  5. SUBTITLE: "Where should we start?" → meme với tên thật
  // ─────────────────────────────────────────────
  function patchSubtitle() {
    const spans = document.querySelectorAll('h1[data-test-id="message"] span.message-text');
    spans.forEach(span => {
      if (span.dataset.mixiDone) return;
      if (span.textContent.includes('Where should we start')) {
        span.textContent = `Ui ${userName} ơi em đừng có chối, thông tin tên địa chỉ nhà, học trường gì, bố mẹ tên là gì anh có cả ở đây rồi. ${userName} có cần anh đọc không? Em còn trẻ quá 😤`;
        span.dataset.mixiDone = 'true';
      }
    });
  }

  // ─────────────────────────────────────────────
  //  6. TITLE TAB
  // ─────────────────────────────────────────────
  function patchTitle() {
    if (document.title.includes('Gemini'))
      document.title = document.title.replace(/Gemini/g, 'Gẹmixi');
  }

  // ─────────────────────────────────────────────
  //  7. PRO TAG → TÀY
  // ─────────────────────────────────────────────
  function patchProTag() {
    const btn = document.querySelector('button.gds-pillbox-button');
    if (!btn || btn.dataset.mixiPro) return;

    const label = btn.querySelector('.mdc-button__label span');
    if (label && label.textContent.trim() === 'PRO') {
      label.textContent = 'TÀY';
      btn.style.setProperty('background-color', '#ff4d4d', 'important');
      btn.style.setProperty('color', 'white', 'important');
      btn.style.setProperty('font-weight', 'bold', 'important');
      btn.dataset.mixiPro = 'true';
    }
  }

  // ─────────────────────────────────────────────
  //  RUN ALL — thứ tự quan trọng:
  //  extractUserName trước, greeting sau, subtitle cuối
  // ─────────────────────────────────────────────
  function runAll() {
    extractUserName();   // 1. Lấy tên trước
    patchPlaceholder();
    patchLogo();
    patchNewChat();
    patchGreeting();     // 2. Greeting dùng tên + cập nhật userName
    patchSubtitle();     // 3. Subtitle dùng userName vừa lấy
    patchTitle();
    patchProTag();       // 4. Tag Pro dành cho dân chơi
  }

  runAll();

  let debounceTimer;
  new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runAll, 150);
  }).observe(document.body, { childList: true, subtree: true });

  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(patchTitle).observe(titleEl, {
      childList: true, characterData: true, subtree: true,
    });
  }

  console.log('%c🎮 Gẹmixi v1.1.0 loaded! Alo em có phải... không?', 'color:#333;font-size:14px;font-weight:bold;font-style:italic;');
})();
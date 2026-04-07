// ==UserScript==
// @name         DUT Auto Portal Login
// @namespace    https://github.com/hthienloc/dut-autologin-portal
// @version      1.0
// @description  Automatically clicks the Microsoft login button on the DUT Wi-Fi portal.
// @author       hthienloc
// @match        https://wifi.dut.udn.vn/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/hthienloc/dut-autologin-portal/raw/master/dut-auto-login.user.js
// @downloadURL  https://github.com/hthienloc/dut-autologin-portal/raw/master/dut-auto-login.user.js
// ==/UserScript==

(function () {
  const btn = document.querySelector('a.hero__left__button[href="/login"]');
  if (btn) {
    console.log('[DUT Portal] Auto-clicking MS login...');
    btn.click();
  }
})();

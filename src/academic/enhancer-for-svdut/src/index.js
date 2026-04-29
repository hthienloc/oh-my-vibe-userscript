import { handleSVPages } from './sv.js';
import { handleLMSPages } from './lms.js';
import { handleWifiPages } from './wifi.js';
import { handleGeminiPages } from './gemini.js';
import { handleFeedbackPages } from './feedback.js';

// 0. Global styles
const style = document.createElement('style');
style.textContent = `
    .defaultSlideShow { display: none !important; }
    
    /* Sticky Quiz Navigation on LMS */
    section[data-region="blocks-column"] {
        position: sticky;
        top: 80px;
        z-index: 100;
        align-self: flex-start;
        height: fit-content;
    }
    #mod_quiz_navblock {
        margin-bottom: 0;
    }
`;
document.head.appendChild(style);

function init() {
    const url = window.location.href;
    
    // --- Logo Click Behavior ---
    const logo = document.querySelector('.logoBox');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.title = 'Đi tới trang chủ DUT (dut.udn.vn)';
        logo.addEventListener('click', () => window.open('https://dut.udn.vn/', '_blank'));
    }

    // --- 0. Global Navbar Logic (SV) ---
    const savedData = JSON.parse(localStorage.getItem('savedLogin') || 'null');
    const loginLink = document.getElementById('linkDangNhap');
    if (loginLink && savedData) {
        if (!loginLink.href.includes('autologin=true')) {
            loginLink.href = 'PageDangNhap.aspx?autologin=true';
        }
    }

    // Route to site-specific handles
    if (url.includes('sv.dut.udn.vn')) {
        handleSVPages(url, savedData);
    } else if (url.includes('lms.dut.udn.vn')) {
        const lmsSavedData = JSON.parse(localStorage.getItem('savedLoginLMS') || 'null');
        handleLMSPages(url, lmsSavedData);
    } else if (url.includes('wifi.dut.udn.vn')) {
        handleWifiPages(url);
    } else if (url.includes('fb.dut.udn.vn')) {
        handleFeedbackPages(url);
    } else if (url.includes('gemini.google.com')) {
        handleGeminiPages();
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

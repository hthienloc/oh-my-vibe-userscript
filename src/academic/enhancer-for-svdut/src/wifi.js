/**
 * Main handler for WiFi captive portal pages.
 * @param {string} url The current page URL.
 */
export function handleWifiPages(url) {
    if (url.includes('wifi.dut.udn.vn') || url.includes('dut.navia.io.vn')) {
        const loginBtn = document.querySelector('a.hero__left__button[href="/login"]');
        if (loginBtn) {
            console.log('[DUT Portal] Auto-clicking MS login...');
            loginBtn.click();
        }
    }
}

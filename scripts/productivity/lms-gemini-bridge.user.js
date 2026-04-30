// ==UserScript==
// @name         LMS-Gemini Auto Bridge
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.1.0
// @description  Tự động hóa việc gửi câu hỏi từ LMS sang Gemini và nhận câu trả lời
// @author       hthienloc
// @match        http://lms.dut.udn.vn/*
// @match        https://lms.dut.udn.vn/*
// @match        https://gemini.google.com/app*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      localhost
// @icon         https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/enhancer-for-svdut.svg
// ==/UserScript==

(function() {
    'use strict';

    const RELAY_URL = 'http://localhost:8081';
    const SERVER_CHECK_URL = `${RELAY_URL}/status`;

    // ==================== LMS SIDE ====================
    if (window.location.href.includes('lms.dut.udn.vn')) {

        console.log('%c[LMS-Gemini Bridge] Active on LMS', 'color: #4285f4; font-weight: bold;');

        let isProcessing = false;
        let serverAvailable = null; // null = chưa check, true/false = đã check

        // Kiểm tra server có đang chạy không
        async function checkServer() {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `${SERVER_CHECK_URL}?t=${Date.now()}`,
                    timeout: 2000,
                    onload: function(res) {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (data && data.timestamp) {
                                serverAvailable = true;
                                resolve(true);
                            } else {
                                serverAvailable = false;
                                resolve(false);
                            }
                        } catch (e) {
                            serverAvailable = false;
                            resolve(false);
                        }
                    },
                    onerror: function() {
                        serverAvailable = false;
                        resolve(false);
                    },
                    ontimeout: function() {
                        serverAvailable = false;
                        resolve(false);
                    }
                });
            });
        }

        // Hiển thị thông báo nhắc chạy server
        function showServerReminder() {
            const existing = document.getElementById('server-reminder');
            if (existing) existing.remove();

            const reminder = document.createElement('div');
            reminder.id = 'server-reminder';
            Object.assign(reminder.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '20px',
                background: '#fff3cd',
                color: '#856404',
                border: '2px solid #ffc107',
                borderRadius: '8px',
                zIndex: '2147483647',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                maxWidth: '450px',
                lineHeight: '1.6'
            });
            reminder.innerHTML = `
                <div style="margin-bottom: 10px;">⚠️ <b>Chưa khởi chạy Bridge Server!</b></div>
                <div style="font-size: 13px; font-weight: normal; margin-bottom: 12px;">
                    Để sử dụng tính năng tự động, hãy chạy lệnh sau trong terminal:
                </div>
                <div style="background: #212529; color: #00ff00; padding: 10px; borderRadius: 4px; font-family: monospace; fontSize: 12px; margin-bottom: 10px;">
                    cd src/productivity/lms-gemini-bridge/server<br>
                    python3 bridge_server.py
                </div>
                <div style="text-align: right;">
                    <button id="reminder-close" style="padding: 5px 15px; background: #856404; color: white; border: none; borderRadius: 4px; cursor: pointer;">Đã hiểu</button>
                </div>
            `;
            document.body.appendChild(reminder);

            document.getElementById('reminder-close').onclick = () => reminder.remove();

            // Auto hide after 10 seconds
            setTimeout(() => {
                if (reminder.parentNode) reminder.remove();
            }, 10000);
        }

        // Kiểm tra server định kỳ (mỗi 30 giây)
        setInterval(() => {
            if (!isProcessing) {
                checkServer().then(available => {
                    if (!available && serverAvailable !== false) {
                        // Server vừa tắt
                        console.warn('[LMS-Gemini Bridge] Server connection lost!');
                    } else if (available && serverAvailable === false) {
                        // Server vừa bật lại
                        console.log('[LMS-Gemini Bridge] Server reconnected!');
                    }
                });
            }
        }, 30000);

        // Override or extend the existing autoAnswer function
        window.addEventListener('load', () => {
            // Wait for the page to fully load
            setTimeout(() => {
                const originalBtn = document.querySelector('button[onclick*="autoAnswer"]') ||
                                   document.querySelector('input[value*="Ask Gemini"]');

                if (originalBtn) {
                    console.log('[LMS-Gemini Bridge] Found Gemini button, enhancing...');
                    enhanceGeminiButton(originalBtn);
                }
            }, 2000);
        });

        function enhanceGeminiButton(btn) {
            // Store original click handler
            const originalOnClick = btn.onclick;

            btn.addEventListener('click', async (e) => {
                if (isProcessing) return;
                isProcessing = true;

                e.preventDefault();
                e.stopPropagation();

                // Kiểm tra server trước khi gửi
                if (serverAvailable === null) {
                    btn.innerText = '🔄 Đang kiểm tra server...';
                    await checkServer();
                }

                if (serverAvailable === false) {
                    showServerReminder();
                    btn.innerText = '❌ Server chưa chạy!';
                    isProcessing = false;
                    setTimeout(() => resetButton(btn), 3000);
                    return;
                }

                btn.innerText = '🔄 Đang gửi đến Gemini...';

                try {
                    // Extract question same as original
                    const queEl = document.querySelector(".que");
                    if (!queEl) {
                        alert("Không tìm thấy câu hỏi!");
                        resetButton(btn);
                        return;
                    }

                    // Import functions from parent script context
                    const questionText = await extractQuestionForBridge(queEl);

                    if (!questionText) {
                        alert("Không thể trích xuất câu hỏi!");
                        resetButton(btn);
                        return;
                    }

                    // Send to bridge server
                    GM_xmlhttpRequest({
                        method: "POST",
                        url: RELAY_URL,
                        data: JSON.stringify({
                            action: 'lms_question',
                            question: questionText
                        }),
                        headers: { "Content-Type": "application/json" },
                        onload: function(res) {
                            if (res.status === 200) {
                                btn.innerText = '✅ Đã gửi! Đang mở Gemini...';

                                // Open Gemini tab if not already open
                                if (!sessionStorage.getItem('gemini_opened')) {
                                    window.open('https://gemini.google.com/app', '_blank');
                                    sessionStorage.setItem('gemini_opened', '1');
                                }

                                // Start polling for answer
                                pollForAnswer(btn);
                            } else {
                                alert('Lỗi kết nối server!');
                                resetButton(btn);
                            }
                        },
                        onerror: function() {
                            alert('Không thể kết nối đến Bridge Server!\nHãy chạy: python bridge_server.py');
                            resetButton(btn);
                        }
                    });

                } catch (err) {
                    console.error('Error:', err);
                    resetButton(btn);
                }
            }, true);
        }

        function pollForAnswer(btn) {
            let attempts = 0;
            const maxAttempts = 60; // Poll for 60 seconds

            const pollInterval = setInterval(() => {
                attempts++;

                GM_xmlhttpRequest({
                    method: "GET",
                    url: `${RELAY_URL}/lms/poll?t=${Date.now()}`,
                    onload: function(res) {
                        try {
                            const data = JSON.parse(res.responseText);

                            if (data && data.answer && data.status === 'pending') {
                                clearInterval(pollInterval);
                                processGeminiAnswer(data.answer, btn);
                            } else if (attempts >= maxAttempts) {
                                clearInterval(pollInterval);
                                btn.innerText = '⏱️ Hết thời gian chờ';
                                setTimeout(() => resetButton(btn), 2000);
                            } else {
                                btn.innerText = `⏳ Chờ Gemini... (${attempts}/${maxAttempts})`;
                            }
                        } catch (e) {
                            if (attempts >= maxAttempts) {
                                clearInterval(pollInterval);
                                resetButton(btn);
                            }
                        }
                    },
                    onerror: function() {
                        if (attempts >= maxAttempts) {
                            clearInterval(pollInterval);
                            resetButton(btn);
                        }
                    }
                });
            }, 1000);
        }

        function processGeminiAnswer(answerText, btn) {
            btn.innerText = '📝 Đang xử lý câu trả lời...';

            try {
                // Parse JSON from Gemini's answer
                const rawMatch = answerText.match(/\{[\s\S]*\}/);
                if (!rawMatch) {
                    throw new Error("No JSON found in answer");
                }

                const data = JSON.parse(rawMatch[0]);
                const queEl = document.querySelector(".que");

                if (!queEl) {
                    alert("Không tìm thấy câu hỏi trên trang!");
                    resetButton(btn);
                    return;
                }

                // Auto-fill based on question type (same logic as original)
                fillAnswers(queEl, data);

                btn.innerText = '✅ Đã điền xong!';
                setTimeout(() => resetButton(btn), 3000);

                // Clear the outbox
                GM_xmlhttpRequest({
                    method: "POST",
                    url: RELAY_URL,
                    data: JSON.stringify({ action: 'clear_all' })
                });

            } catch (err) {
                console.error('Parse Error:', err);
                alert('Lỗi: Không thể phân tích câu trả lời từ Gemini.\n' + err.message);
                resetButton(btn);
            }
        }

        function fillAnswers(queEl, data) {
            // Multi-choice or True/False
            if (queEl.classList.contains("multichoice") || queEl.classList.contains("truefalse")) {
                const inputs = Array.from(queEl.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
                const options = inputs.map((input, i) => {
                    const ariaId = input.getAttribute("aria-labelledby");
                    const labelEl = (ariaId ? document.getElementById(ariaId) : null) ||
                                   queEl.querySelector(`label[for="${input.id}"]`);
                    const text = labelEl ? (labelEl.innerText || labelEl.textContent || "").trim() : "";
                    return { index: i, el: input, type: input.type };
                }).filter(o => o.text);

                const arr = Array.isArray(data.answers) ? data.answers :
                           data.answers !== undefined ? [data.answers] : [];

                const isMulti = options.some(o => o.type === "checkbox");

                if (isMulti) {
                    options.forEach(o => { if (o.el.checked) o.el.click(); });
                    arr.forEach(idx => {
                        if (options[idx]) options[idx].el.click();
                    });
                } else {
                    arr.forEach(idx => {
                        if (options[idx]) options[idx].el.click();
                    });
                }
            }
            // Match type
            else if (queEl.classList.contains("match")) {
                const rows = queEl.querySelectorAll("table.answer tr");
                rows.forEach((row, i) => {
                    const selectEl = row.querySelector("select");
                    if (selectEl && data.answers && data.answers[String(i)] !== undefined) {
                        const optIdx = data.answers[String(i)];
                        const optionElements = Array.from(selectEl.querySelectorAll("option"))
                            .filter(o => o.value && o.value !== "0");
                        if (optionElements[optIdx]) {
                            selectEl.value = optionElements[optIdx].value;
                            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                    }
                });
            }
            // Text input
            else if (queEl.classList.contains("shortanswer") || queEl.classList.contains("numerical")) {
                const input = queEl.querySelector('input[type="text"]');
                if (input && data.answers && data.answers["0"] !== undefined) {
                    input.value = data.answers["0"];
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }
            // Cloze (multi-answer)
            else if (queEl.classList.contains("multianswer")) {
                const inputs = queEl.querySelectorAll('input[type="text"], select');
                inputs.forEach((el, i) => {
                    if (data.answers && data.answers[String(i)] !== undefined) {
                        const val = data.answers[String(i)];
                        if (el.tagName === "SELECT") {
                            const optionElements = Array.from(el.querySelectorAll("option"))
                                .filter(o => o.value && o.text.trim().toLowerCase() !== "choose...");
                            if (optionElements[val]) {
                                el.value = optionElements[val].value;
                                el.dispatchEvent(new Event("change", { bubbles: true }));
                            }
                        } else {
                            el.value = val;
                            el.dispatchEvent(new Event("change", { bubbles: true }));
                        }
                    }
                });
            }
        }

        function resetButton(btn) {
            isProcessing = false;
            btn.innerText = "🤖 Ask Gemini (Auto)";
        }

        // Helper: Extract question text (simplified version)
        async function extractQuestionForBridge(queEl) {
            // This is a simplified version - you may want to import the full logic
            // from the main script's sanitizeNode and cleanText functions
            const qtextEl = queEl.querySelector(".qtext") || queEl.querySelector(".formulation") || queEl;
            const questionText = qtextEl.innerText || qtextEl.textContent || "";

            // Build prompt similar to original
            let prompt = `You are a quiz assistant. strictly follow instructions. Return ONLY valid JSON, no markdown blocks, no explanations, just the literal string starting with { and ending with }.\n\n`;
            prompt += `Question: ${questionText.trim()}\n\n`;

            // Add options if multiple choice
            if (queEl.classList.contains("multichoice") || queEl.classList.contains("truefalse")) {
                const inputs = Array.from(queEl.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
                const options = inputs.map((input, i) => {
                    const ariaId = input.getAttribute("aria-labelledby");
                    const labelEl = (ariaId ? document.getElementById(ariaId) : null) ||
                                   queEl.querySelector(`label[for="${input.id}"]`);
                    const text = labelEl ? (labelEl.innerText || labelEl.textContent || "").trim() : "";
                    return { index: i, text, type: input.type };
                }).filter(o => o.text && o.el.value !== "-1");

                const isMulti = options.some(o => o.type === "checkbox");
                prompt += `Type: ${isMulti ? "Multiple choices (checkboxes)" : "Single choice (radio)"}\n`;
                prompt += `Options:\n${options.map(o => `[${o.index}] ${o.text}`).join('\n')}\n`;
                prompt += `Format required: {"answers": ${isMulti ? "[index1, index2]" : "[index]"}}\n`;
            }

            return prompt;
        }

    }

    // ==================== GEMINI SIDE ====================
    else if (window.location.href.includes('gemini.google.com/app')) {

        console.log('%c[LMS-Gemini Bridge] Active on Gemini', 'color: #34a853; font-weight: bold;');

        let lastQuestion = '';
        let hasSubmitted = false;
        let serverAvailableGemini = null;

        // Kiểm tra server
        function checkServerGemini() {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `${SERVER_CHECK_URL}?t=${Date.now()}`,
                    timeout: 2000,
                    onload: function(res) {
                        try {
                            const data = JSON.parse(res.responseText);
                            serverAvailableGemini = data && data.timestamp;
                            resolve(serverAvailableGemini);
                        } catch (e) {
                            serverAvailableGemini = false;
                            resolve(false);
                        }
                    },
                    onerror: function() {
                        serverAvailableGemini = false;
                        resolve(false);
                    }
                });
            });
        }

        // Hiển thị thông báo nhắc trên Gemini
        function showServerReminderGemini() {
            const existing = document.getElementById('server-reminder-gemini');
            if (existing) existing.remove();

            const reminder = document.createElement('div');
            reminder.id = 'server-reminder-gemini';
            Object.assign(reminder.style, {
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '20px 25px',
                background: '#fff3cd',
                color: '#856404',
                border: '3px solid #ffc107',
                borderRadius: '12px',
                zIndex: '2147483647',
                fontSize: '15px',
                fontWeight: 'bold',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                maxWidth: '550px',
                textAlign: 'center',
                lineHeight: '1.6'
            });
            reminder.innerHTML = `
                <div style="font-size: 18px; margin-bottom: 12px;">⚠️ Chưa khởi chạy Bridge Server!</div>
                <div style="font-size: 13px; font-weight: normal; margin-bottom: 15px; text-align: left;">
                    Để nhận câu hỏi tự động từ LMS, hãy chạy server trong terminal:
                </div>
                <div style="background: #212529; color: #00ff00; padding: 12px 15px; borderRadius: 6px; font-family: monospace; fontSize: 13px; margin-bottom: 12px; text-align: left;">
                    cd ~/Documents/GitHub/oh-my-vibe-userscript/src/productivity/lms-gemini-bridge/server<br>
                    python3 bridge_server.py
                </div>
                <div style="font-size: 12px; font-weight: normal; color: #856404; margin-bottom: 10px;">
                    Server sẽ chạy tại <b>http://localhost:8081</b>
                </div>
                <button id="reminder-close-gemini" style="padding: 8px 20px; background: #856404; color: white; border: none; borderRadius: 6px; cursor: pointer; fontSize: 13px;">Đã hiểu</button>
            `;
            document.body.appendChild(reminder);

            document.getElementById('reminder-close-gemini').onclick = () => reminder.remove();

            setTimeout(() => {
                if (reminder.parentNode) reminder.remove();
            }, 15000);
        }

        // Kiểm tra server và hiện reminder nếu cần
        checkServerGemini().then(available => {
            if (!available) {
                showServerReminderGemini();
            }
        });

        // Kiểm tra định kỳ
        setInterval(() => {
            checkServerGemini().then(available => {
                if (!available && serverAvailableGemini !== false) {
                    showServerReminderGemini();
                }
            });
        }, 30000);

        // Poll for questions from LMS
        setInterval(() => {
            if (hasSubmitted) return;

            // Chỉ poll nếu server đang chạy
            if (serverAvailableGemini === false) return;

            GM_xmlhttpRequest({
                method: "GET",
                url: `${RELAY_URL}/gemini/poll?t=${Date.now()}`,
                timeout: 3000,
                onload: function(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data && data.question && data.status === 'pending') {
                            if (data.question !== lastQuestion) {
                                lastQuestion = data.question;
                                hasSubmitted = true;
                                injectQuestionToGemini(data.question);
                            }
                        }
                    } catch (e) {}
                },
                onerror: function() {
                    serverAvailableGemini = false;
                }
            });
        }, 2000);

        function injectQuestionToGemini(question) {
            console.log('[LMS-Gemini Bridge] Injecting question to Gemini...');

            // Wait for Gemini's input to be ready
            const checkInterval = setInterval(() => {
                const input = document.querySelector('textarea') ||
                             document.querySelector('[contenteditable="true"]');

                if (input) {
                    clearInterval(checkInterval);

                    // Set the question text
                    input.value = question;
                    input.textContent = question;
                    input.dispatchElement = new Event('input', { bubbles: true });
                    input.dispatchEvent(input.dispatchElement);

                    // Create a floating notification
                    showNotification('📥 Đã nhận câu hỏi từ LMS. Nhấn gửi để gửi cho Gemini!', 'info');

                    // Watch for Gemini's response
                    watchForResponse();
                }
            }, 500);
        }

        function watchForResponse() {
            let lastResponse = '';

            const watchInterval = setInterval(() => {
                // Try to find Gemini's response
                const responses = document.querySelectorAll('[data-message-author-role="model"]') ||
                                 document.querySelectorAll('.model-response');

                if (responses.length > 0) {
                    const latestResponse = responses[responses.length - 1];
                    const responseText = latestResponse.innerText || latestResponse.textContent || '';

                    // Check if response is complete (not streaming)
                    if (responseText.length > lastResponse.length && !isStreaming()) {
                        lastResponse = responseText;

                        // Check for JSON in response
                        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            clearInterval(watchInterval);
                            sendAnswerToBridge(jsonMatch[0]);
                        }
                    }
                }
            }, 1000);

            // Timeout after 30 seconds
            setTimeout(() => clearInterval(watchInterval), 30000);
        }

        function isStreaming() {
            // Check if Gemini is still generating (you may need to adjust this)
            return document.querySelector('.loading-dots') ||
                   document.querySelector('[data-loading="true"]') !== null;
        }

        function sendAnswerToBridge(answer) {
            showNotification('📤 Đang gửi câu trả lời về LMS...', 'info');

            GM_xmlhttpRequest({
                method: "POST",
                url: RELAY_URL,
                data: JSON.stringify({
                    action: 'gemini_answer',
                    answer: answer
                }),
                headers: { "Content-Type": "application/json" },
                onload: function(res) {
                    if (res.status === 200) {
                        showNotification('✅ Đã gửi câu trả lời về LMS!', 'success');
                        hasSubmitted = false;
                    }
                },
                onerror: function() {
                    showNotification('❌ Lỗi gửi câu trả lời!', 'error');
                    hasSubmitted = false;
                }
            });
        }

        function showNotification(message, type) {
            const existing = document.getElementById('bridge-notification');
            if (existing) existing.remove();

            const notif = document.createElement('div');
            notif.id = 'bridge-notification';
            Object.assign(notif.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '15px 20px',
                background: type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3',
                color: 'white',
                borderRadius: '8px',
                zIndex: '2147483647',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                maxWidth: '400px'
            });
            notif.textContent = message;
            document.body.appendChild(notif);

            setTimeout(() => notif.remove(), 5000);
        }
    }

})();

import { sanitizeNode, cleanText, convertImgToBase64, showNotification } from './utils.js';

// ---------------------------------------------------------------------------
// Gemini Auto-Answer (Web Mode)
// ---------------------------------------------------------------------------

/**
 * Extract the current question's text + choices, copy to clipboard,
 * and prompt user for the answer index from Gemini.
 * @param {HTMLButtonElement} btn The button triggering the action.
 */
async function autoAnswerCurrentQuestion(btn) {
    const queEl = document.querySelector('.que');
    if (!queEl) {
        alert('Không tìm thấy câu hỏi trên trang này.');
        btn.innerText = '🤖 Ask Gemini';
        return;
    }

    // Pre-fetch images for this specific question
    const imgMap = new Map();
    const qImgs = Array.from(queEl.querySelectorAll('img'));
    await Promise.all(qImgs.map(async img => {
        const src = img.src;
        if (src && !imgMap.has(src) && !src.startsWith('data:')) {
            const b64 = await convertImgToBase64(img);
            imgMap.set(src, b64);
        }
    }));

    const qtextEl = queEl.querySelector('.qtext') || queEl.querySelector('.formulation') || queEl;
    let questionText = cleanText(sanitizeNode(qtextEl, imgMap));

    const targets = [];
    const promptParts = [];

    if (queEl.classList.contains('multichoice') || queEl.classList.contains('truefalse')) {
        const inputs = Array.from(queEl.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
        const options = inputs.map((input, i) => {
            const ariaId = input.getAttribute('aria-labelledby');
            const labelEl = (ariaId ? document.getElementById(ariaId) : null) || queEl.querySelector(`label[for="${input.id}"]`);
            const text = labelEl ? (labelEl.innerText || labelEl.textContent || '').trim() : '';
            return { index: i, text, el: input, type: input.type };
        }).filter(o => o.text && o.el.value !== '-1');

        if (options.length === 0) return alert('Không tìm thấy đáp án.');
        
        const isMulti = options.some(o => o.type === 'checkbox');
        targets.push({ type: 'choice', isMulti, options });

        const optsText = options.map(o => `[${o.index}] ${o.text}`).join('\n');
        promptParts.push(`Type: ${isMulti ? 'Multiple choices (checkboxes)' : 'Single choice (radio)'}`);
        promptParts.push(`Options:\n${optsText}`);
        promptParts.push(`Format required: {"answers": ${isMulti ? '[index1, index2]' : '[index]'}}`);
    } 
    else if (queEl.classList.contains('match')) {
        const rows = queEl.querySelectorAll('table.answer tr');
        const mapping = [];
        const exampleAnswers = {};

        rows.forEach((row, i) => {
            const textEl = row.querySelector('.text');
            const selectEl = row.querySelector('select');
            if (textEl && selectEl) {
                const rowText = (textEl.innerText || textEl.textContent).trim();
                const optionElements = Array.from(selectEl.querySelectorAll('option')).filter(o => o.value && o.value !== '0');
                const optionsList = optionElements.map((opt, optIdx) => `[${optIdx}] ${opt.innerText.trim()}`).join('  |  ');
                mapping.push({ text: rowText, selectEl, optionElements });
                promptParts.push(`Input ${i}: ${rowText}`);
                promptParts.push(`  Options for Input ${i}: ${optionsList}`);
                exampleAnswers[i] = 0;
            }
        });
        if (mapping.length === 0) return alert('Không tìm thấy dropdown.');
        targets.push({ type: 'match', mapping });
        promptParts.push(`Format required: {"answers": ${JSON.stringify(exampleAnswers)}}`);
    }
    else if (queEl.classList.contains('shortanswer') || queEl.classList.contains('numerical')) {
        const input = queEl.querySelector('input[type="text"]');
        if (input) {
            targets.push({ type: 'text', el: input, id: 0 });
            promptParts.push(`Type: Text input`);
            promptParts.push(`Format required: {"answers": {"0": "exact text string to fill"}}`);
        } else {
            return alert('Không tìm thấy ô điền từ.');
        }
    }
    else if (queEl.classList.contains('multianswer')) {
        const inputs = queEl.querySelectorAll('input[type="text"], select');
        const mapping = [];
        const exampleAnswers = {};

        // Create a representation with placeholders for cloze questions
        const formulation = queEl.querySelector('.formulation') || queEl.querySelector('.qtext') || queEl;
        const clone = formulation.cloneNode(true);
        const cloneInputs = clone.querySelectorAll('input[type="text"], select');

        inputs.forEach((el, i) => {
            if (el.tagName === 'SELECT') {
                const optionElements = Array.from(el.querySelectorAll('option')).filter(o => o.value && o.text.trim().toLowerCase() !== 'choose...');
                const optionsList = optionElements.map((opt, optIdx) => `[${optIdx}] ${opt.innerText.trim()}`).join('  |  ');
                mapping.push({ type: 'select', el, optionElements, id: i });
                promptParts.push(`Input ${i} (dropdown): ${optionsList}`);
                exampleAnswers[i] = 0;
            } else {
                mapping.push({ type: 'text', el, id: i });
                promptParts.push(`Input ${i} (text): fill in the blank`);
                exampleAnswers[i] = "text";
            }
            if (cloneInputs[i]) {
                const placeholder = document.createTextNode(` [[Input ${i}]] `);
                cloneInputs[i].replaceWith(placeholder);
            }
        });

        clone.querySelectorAll('.feedback, .feedbackspan, .yui3-overlay, .icon, .grade, .state, .accesshide').forEach(el => el.remove());
        questionText = cleanText(sanitizeNode(clone, imgMap));

        if (mapping.length === 0) return alert('Không tìm thấy ô input.');
        targets.push({ type: 'cloze', mapping });
        promptParts.push(`Format required: {"answers": ${JSON.stringify(exampleAnswers)}}`);
    }
    else if (queEl.classList.contains('ddwtos')) {
        const drags = Array.from(queEl.querySelectorAll('.answercontainer .draghome, .answercontainer .drag'));
        const options = drags.map((drag, i) => {
            const choiceMatch = drag.className.match(/choice(\d+)/);
            const choice = choiceMatch ? choiceMatch[1] : (i + 1);
            const groupMatch = drag.className.match(/group(\d+)/);
            const group = groupMatch ? groupMatch[1] : '1';
            const text = drag.innerText.trim();
            return { index: i, choice, group, text, el: drag };
        });

        const formulation = queEl.querySelector('.formulation') || queEl.querySelector('.qtext') || queEl;
        const clone = formulation.cloneNode(true);
        
        // Robust drop zone detection
        let drops = Array.from(queEl.querySelectorAll('span.drop, span.dragdrop, .qtext span[class*="place"]'));
        
        // Fallback: search by hidden inputs if no spans found
        if (drops.length === 0) {
            const hiddenInputs = Array.from(queEl.querySelectorAll('input[type="hidden"][name*="_p"]'));
            drops = hiddenInputs.map(inp => inp.closest('span') || inp.parentElement).filter(el => !!el);
        }

        const mapping = [];
        const exampleAnswers = {};

        drops.forEach((drop, i) => {
            const groupMatch = drop.className.match(/group(\d+)/);
            const group = groupMatch ? groupMatch[1] : '1';
            const input = drop.querySelector('input[type="hidden"]');
            
            if (input) {
                const groupOptions = options.filter(o => o.group === group);
                mapping.push({ type: 'drag', input, dropEl: drop, id: i, options });
                
                const optsText = groupOptions.map(o => `[${o.index}] ${o.text}`).join('  |  ');
                promptParts.push(`Input ${i} (Group ${group}): ${optsText}`);
                exampleAnswers[i] = groupOptions[0]?.index || 0;
            }
            
            // Handle placeholders in clone more robustly
            // Find the equivalent drop zone in the clone
            const cloneDrops = clone.querySelectorAll('span.drop, span.dragdrop, span[class*="place"]');
            if (cloneDrops[i]) {
                cloneDrops[i].replaceWith(document.createTextNode(` [[Input ${i}]] `));
            }
        });

        clone.querySelectorAll('.feedback, .feedbackspan, .yui3-overlay, .icon, .grade, .state, .accesshide').forEach(el => el.remove());
        questionText = cleanText(sanitizeNode(clone, imgMap));

        if (mapping.length === 0) return alert('Không tìm thấy ô thả (Drop zones).');
        targets.push({ type: 'cloze', mapping });
        promptParts.push(`Format required: {"answers": ${JSON.stringify(exampleAnswers)}}`);
    }
    else {
        alert('Loại câu hỏi này (ví dụ: Drag & drop) chứa sự kiện phức tạp chưa hỗ trợ Auto-fill qua DOM.\nBạn có thể dùng Copy Markdown đề để Gemini giải thích rồi tự chọn tay nhé.');
        btn.innerText = '🤖 Ask Gemini';
        return;
    }

    const prompt_text =
        `You are a quiz assistant. strictly follow instructions. Return ONLY valid JSON, no markdown blocks, no explanations, just the literal string starting with { and ending with }.\n\n` +
        `Question: ${questionText}\n\n` +
        promptParts.join('\n\n');

    // --- Gửi qua Bridge Server hoặc fallback clipboard ---
    const RELAY_URL = 'http://localhost:8081';
    let serverAvailable = false;

    // Kiểm tra server
    try {
        const res = await fetch(`${RELAY_URL}/status?t=${Date.now()}`, {
            mode: 'cors',
            signal: AbortSignal.timeout(2000)
        });
        const data = await res.json();
        serverAvailable = data && data.status === 'running';
    } catch (e) {
        serverAvailable = false;
    }

    if (serverAvailable) {
        // Gửi câu hỏi qua server
        btn.innerText = '🔄 Đang gửi đến Gemini...';
        try {
            const res = await fetch(RELAY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'lms_question',
                    question: prompt_text
                }),
                mode: 'cors'
            });

            if (res.ok) {
                btn.innerText = '✅ Đã gửi! Đang mở Gemini...';

                // Mở tab Gemini nếu chưa có
                if (!sessionStorage.getItem('svdut_gemini_opened')) {
                    window.open('https://gemini.google.com/app', '_blank');
                    sessionStorage.setItem('svdut_gemini_opened', '1');
                }

                // Chờ đáp án từ server
                pollForAnswer(btn, targets);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.error('[Enhancer] Server error:', err);
            alert('Lỗi kết nối server! Hãy chạy: python3 bridge_server.py');
            btn.innerText = '🤖 Ask Gemini';
        }
    } else {
        // Fallback: Copy to clipboard như cũ
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(prompt_text);
        } else {
            await navigator.clipboard.writeText(prompt_text);
        }

        // Hiển thị thông báo nhắc chạy server
        showServerReminder();

        // --- Open Gemini Tab (only once per session) ---
        if (!sessionStorage.getItem('svdut_gemini_opened')) {
            window.open('https://gemini.google.com/app', '_blank');
            sessionStorage.setItem('svdut_gemini_opened', '1');
        }

        // --- Prompt user for JSON result ---
        const userResult = prompt(
            '✅ ĐÃ COPY CÂU HỎI VÀO CLIPBOARD!\n\n' +
            '👉 Hãy qua tab Gemini dán (Ctrl+V).\n' +
            '👉 Nó sẽ xuất ra 1 file JSON kiểu {"answers": ...}.\n' +
            '👉 Copy chuỗi JSON đó dán vào đây để tự điền:'
        );

        if (userResult) {
            try {
                const rawMatch = userResult.match(/\{[\s\S]*\}/);
                if (!rawMatch) throw new Error("No JSON found");
                const data = JSON.parse(rawMatch[0]);

                targets.forEach(target => {
                    if (target.type === 'choice') {
                        const arr = Array.isArray(data.answers) ? data.answers : (data.answers !== undefined ? [data.answers] : []);
                        if (target.isMulti) {
                            target.options.forEach(o => { if (o.el.checked) o.el.click(); });
                            arr.forEach(idx => { if (target.options[idx]) target.options[idx].el.click(); });
                        } else {
                            arr.forEach(idx => { if (target.options[idx]) target.options[idx].el.click(); });
                        }
                    } else if (target.type === 'match') {
                        target.mapping.forEach((m, i) => {
                            const optIdx = data.answers && data.answers[String(i)];
                            if (optIdx !== undefined && m.optionElements[optIdx]) {
                                m.selectEl.value = m.optionElements[optIdx].value;
                                m.selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    } else if (target.type === 'text') {
                        const val = data.answers && data.answers[String(target.id)];
                        if (val !== undefined) {
                            target.el.value = val;
                            target.el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    } else if (target.type === 'cloze') {
                        target.mapping.forEach(m => {
                            const val = data.answers && data.answers[String(m.id)];
                            if (val !== undefined) {
                                if (m.type === 'select') {
                                    if (m.optionElements[val]) {
                                        m.el.value = m.optionElements[val].value;
                                        m.el.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                } else if (m.type === 'drag') {
                                    if (m.options[val]) {
                                        m.input.value = m.options[val].choice;
                                        m.input.dispatchEvent(new Event('change', { bubbles: true }));
                                        // Visual update
                                        m.dropEl.textContent = m.options[val].text;
                                        m.dropEl.appendChild(m.input);
                                        m.dropEl.classList.add('placed');
                                    }
                                } else {
                                    m.el.value = val;
                                    m.el.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        });
                    }
                });
                btn.innerText = `✅ Đã điền xong`;
            } catch (e) {
                console.error("Parse Error:", e, userResult);
                alert("Lỗi: Không thể phân tích JSON từ kết quả của bạn. Vui lòng đảm bảo dán đúng cặp dấu { ... }");
            }
        }

        setTimeout(() => { btn.innerText = '🤖 Ask Gemini'; }, 3000);
    }
}

// Chờ đáp án từ server
async function pollForAnswer(btn, targets) {
    const RELAY_URL = 'http://localhost:8081';
    let attempts = 0;
    const maxAttempts = 60;

    const pollInterval = setInterval(async () => {
        attempts++;

        try {
            const res = await fetch(`${RELAY_URL}/lms/poll?t=${Date.now()}`, {
                mode: 'cors',
                signal: AbortSignal.timeout(3000)
            });
            const data = await res.json();

            if (data && data.answer && data.status === 'pending') {
                clearInterval(pollInterval);
                processGeminiAnswer(data.answer, btn, targets);
            } else if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                btn.innerText = '⏱️ Hết thời gian chờ';
                setTimeout(() => { btn.innerText = '🤖 Ask Gemini'; }, 3000);
            } else {
                btn.innerText = `⏳ Chờ Gemini... (${attempts}/${maxAttempts})`;
            }
        } catch (e) {
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                btn.innerText = '❌ Lỗi kết nối';
                setTimeout(() => { btn.innerText = '🤖 Ask Gemini'; }, 3000);
            }
        }
    }, 1000);
}

// Xử lý đáp án từ Gemini
function processGeminiAnswer(answerText, btn, targets) {
    btn.innerText = '📝 Đang xử lý câu trả lời...';

    try {
        const rawMatch = answerText.match(/\{[\s\S]*\}/);
        if (!rawMatch) throw new Error("No JSON found");
        const data = JSON.parse(rawMatch[0]);

        targets.forEach(target => {
            if (target.type === 'choice') {
                const arr = Array.isArray(data.answers) ? data.answers : (data.answers !== undefined ? [data.answers] : []);
                if (target.isMulti) {
                    target.options.forEach(o => { if (o.el.checked) o.el.click(); });
                    arr.forEach(idx => { if (target.options[idx]) target.options[idx].el.click(); });
                } else {
                    arr.forEach(idx => { if (target.options[idx]) target.options[idx].el.click(); });
                }
            } else if (target.type === 'match') {
                target.mapping.forEach((m, i) => {
                    const optIdx = data.answers && data.answers[String(i)];
                    if (optIdx !== undefined && m.optionElements[optIdx]) {
                        m.selectEl.value = m.optionElements[optIdx].value;
                        m.selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            } else if (target.type === 'text') {
                const val = data.answers && data.answers[String(target.id)];
                if (val !== undefined) {
                    target.el.value = val;
                    target.el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (target.type === 'cloze') {
                target.mapping.forEach(m => {
                    const val = data.answers && data.answers[String(m.id)];
                    if (val !== undefined) {
                        if (m.type === 'select') {
                            if (m.optionElements[val]) {
                                m.el.value = m.optionElements[val].value;
                                m.el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        } else if (m.type === 'drag') {
                            if (m.options[val]) {
                                m.input.value = m.options[val].choice;
                                m.input.dispatchEvent(new Event('change', { bubbles: true }));
                                // Visual update
                                m.dropEl.textContent = m.options[val].text;
                                m.dropEl.appendChild(m.input);
                                m.dropEl.classList.add('placed');
                            }
                        } else {
                            m.el.value = val;
                            m.el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                });
            }
        });

        btn.innerText = '✅ Đã điền xong!';

        // Clear server data
        fetch(RELAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clear_all' }),
            mode: 'cors'
        }).catch(() => {});

        setTimeout(() => { btn.innerText = '🤖 Ask Gemini'; }, 3000);
    } catch (err) {
        console.error('Parse Error:', err);
        alert('Lỗi: Không thể phân tích câu trả lời từ Gemini.\n' + err.message);
        btn.innerText = '🤖 Ask Gemini';
    }
}

// Hiển thị thông báo nhắc chạy server (Inline)
function showServerReminder() {
    const container = document.getElementById('enhancer-buttons-inner') || document.getElementById('markdown-buttons-container');
    if (!container || document.getElementById('server-reminder-lms')) return;

    const reminder = document.createElement('div');
    reminder.id = 'server-reminder-lms';
    Object.assign(reminder.style, {
        marginTop: '10px',
        padding: '12px',
        background: '#fff3cd',
        color: '#856404',
        border: '1px solid #ffeeba',
        borderRadius: '8px',
        fontSize: '12px',
        lineHeight: '1.4'
    });
    reminder.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">⚠️ Bridge Server chưa chạy!</div>
        <div style="margin-bottom: 8px;">Để tự động hóa, copy và chạy lệnh này trong terminal:</div>
        <div style="background: #212529; color: #00ff00; padding: 8px; borderRadius: 4px; font-family: monospace; fontSize: 11px; overflow-x: auto; white-space: nowrap; cursor: pointer;" title="Click to copy">
            curl -fsSL https://raw.githubusercontent.com/hthienloc/oh-my-vibe-userscript/main/src/productivity/lms-gemini-bridge/server/bridge_server.py | python3
        </div>
    `;
    
    const codeEl = reminder.querySelector('div[title="Click to copy"]');
    codeEl.onclick = () => {
        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(codeEl.innerText.trim());
        } else {
            navigator.clipboard.writeText(codeEl.innerText.trim());
        }
        const oldBg = codeEl.style.background;
        codeEl.style.background = '#28a745';
        setTimeout(() => codeEl.style.background = oldBg, 1000);
    };

    container.appendChild(reminder);
}

/**
 * Extracts all questions and answers from the quiz page into a Markdown string.
 * @param {Object} options Extraction options.
 * @param {boolean} [options.includeAnswers=true] Whether to include answers.
 * @param {boolean} [options.diagnose=false] Whether to format as a diagnosis report.
 * @returns {Promise<string>} The generated Markdown string.
 */
export async function extractQuiz(options = { includeAnswers: true, diagnose: false }) {
    const questions = document.querySelectorAll('.que');
    
    // Pre-fetch images and convert to base64 for direct embedding
    const imgMap = new Map();
    const allImgs = Array.from(document.querySelectorAll('.que img'));
    await Promise.all(allImgs.map(async img => {
        const src = img.src;
        if (src && !imgMap.has(src) && !src.startsWith('data:')) {
            const b64 = await convertImgToBase64(img);
            imgMap.set(src, b64);
        }
    }));
    let md = '';
    const isReview = !!document.querySelector('.quizreviewsummary') && options.includeAnswers;

    if (options.diagnose) {
        md += "# Quiz Diagnosis Report\n\nI have some incorrect answers in my quiz. Please analyze each question, explain why my selected answer is wrong, and why the correct answer is right.\n\n---\n\n";
    }

    questions.forEach((q, index) => {
        const isIncorrect = q.classList.contains('incorrect') || q.classList.contains('partiallycorrect');
        // If diagnosing, only include incorrect/partially correct questions
        if (options.diagnose && !isIncorrect) return;

        const qno = q.querySelector('.qno')?.innerText?.trim() || (index + 1);
        const formulationEl = q.querySelector('.formulation');
        let contentMd = '';

        if (formulationEl) {
            const clone = formulationEl.cloneNode(true);

            // Handle matching questions specifically
            if (q.classList.contains('match')) {
                const qtext = clone.querySelector('.qtext');
                const introText = qtext ? cleanText(sanitizeNode(qtext, imgMap)) : '';
                contentMd = introText + '\n\n';

                const rightAnswerEl = q.querySelector('.rightanswer');
                const rightAnswerTextRaw = rightAnswerEl ? rightAnswerEl.innerText : '';
                const answerMap = new Map();

                if (isReview && rightAnswerTextRaw) {
                    const pairs = rightAnswerTextRaw.split(/[,;\n]/);
                    pairs.forEach(pair => {
                        const parts = pair.split(/->|→|:/);
                        if (parts.length >= 2) {
                            const key = parts[0].trim();
                            const val = parts.slice(1).join(':').trim();
                            answerMap.set(key, val);
                        }
                    });
                }

                const allOptions = new Set();
                q.querySelectorAll('.control select option').forEach(opt => {
                    const txt = opt.innerText.trim();
                    if (txt && !txt.match(/Choose|Chọn/i)) allOptions.add(txt);
                });

                let allMatched = isReview && answerMap.size > 0;
                q.querySelectorAll('table.answer tr').forEach(row => {
                    const itemContainer = row.querySelector('.text');
                    const itemText = itemContainer ? cleanText(sanitizeNode(itemContainer, imgMap)) : '';
                    if (!itemText) return;

                    let displayAnswer = '__________';
                    let userChoice = '';

                    // Try to find what user selected
                    const selectEl = row.querySelector('select');
                    if (selectEl) {
                        const selectedOpt = selectEl.querySelector('option[selected]') || selectEl.options[selectEl.selectedIndex];
                        if (selectedOpt && !selectedOpt.innerText.match(/Choose|Chọn/i)) {
                            userChoice = selectedOpt.innerText.trim();
                        }
                    }

                    if (isReview) {
                        const matched = answerMap.get(itemText);
                        if (matched) {
                            displayAnswer = `**${matched}**`;
                        } else {
                            const cleanItem = itemText.replace(/\*\*/g, '').replace(/__/g, '').trim();
                            for (const [key, val] of answerMap.entries()) {
                                if (key.includes(cleanItem) || cleanItem.includes(key)) {
                                    displayAnswer = `**${val}**`;
                                    break;
                                }
                            }
                        }
                        if (displayAnswer === '__________') allMatched = false;
                    }

                    if (userChoice && userChoice !== displayAnswer.replace(/\*\*/g, '')) {
                        if (isReview) {
                            contentMd += `- ${itemText} [ User Choice: ~~${userChoice}~~ | Correct: ${displayAnswer} ]\n`;
                        } else {
                            contentMd += `- ${itemText} [ User Choice: **${userChoice}** ]\n`;
                        }
                    } else {
                        contentMd += `- ${itemText} [ ${displayAnswer} ]\n`;
                    }
                });

                if (allOptions.size > 0 && !isReview) {
                    contentMd += `\nOptions: ${Array.from(allOptions).join(', ')}\n`;
                }

                if (isReview && rightAnswerEl && !allMatched) {
                    const rightAnswerTextMd = cleanText(sanitizeNode(rightAnswerEl, imgMap));
                    if (rightAnswerTextMd && (!rightAnswerTextMd.includes('->') && !rightAnswerTextMd.includes('→'))) {
                        contentMd += `\n> **${rightAnswerTextMd}**\n`;
                    }
                }
            }
            // Handle Choice questions (Multiple Choice or True/False)
            else if (q.classList.contains('multichoice') || q.classList.contains('truefalse')) {
                const qtext = clone.querySelector('.qtext');
                const introText = qtext ? cleanText(sanitizeNode(qtext, imgMap)) : '';
                contentMd = introText + '\n\n';

                const rightAnswerEl = q.querySelector('.rightanswer');
                const rightAnswerText = rightAnswerEl ? cleanText(sanitizeNode(rightAnswerEl, imgMap)) : '';
                const correctAnswers = isReview ? rightAnswerText.split(/[\n;]+/).map(s => s.trim().toLowerCase()).filter(s => !!s) : [];

                const choiceItems = [];
                const answerEl = q.querySelector('.answer');
                if (answerEl) {
                    answerEl.querySelectorAll(':scope > div').forEach(choice => {
                        const el = choice.querySelector('label') || choice.querySelector('[data-region="answer-label"]');
                        const input = choice.querySelector('input');
                        if (el) choiceItems.push({ label: el, input, container: choice });
                    });
                }

                choiceItems.forEach(item => {
                    let choiceText = cleanText(sanitizeNode(item.label, imgMap));
                    if (!choiceText) return;

                    const isSelected = item.input?.checked || item.container.classList.contains('selected');
                    const isCorrect = isReview && correctAnswers.some(ans => {
                        const cleanChoice = choiceText.toLowerCase().replace(/^[a-z]\.\s+/i, '').trim();
                        const cleanAns = ans.toLowerCase().replace(/^[a-z]\.\s+/i, '').trim();
                        return cleanChoice.includes(cleanAns) || cleanAns.includes(cleanChoice);
                    });

                    let prefix = `[ ]`;
                    if (isReview) {
                        prefix = `[${isCorrect ? 'x' : ' '}]`;
                        if (isSelected && !isCorrect) {
                            prefix = `[!]`; // User chose wrong
                            choiceText = `~~${choiceText}~~ (My Choice)`;
                        } else if (isSelected && isCorrect) {
                            prefix = `[x]`;
                            choiceText = `**${choiceText}** (Correct)`;
                        } else if (!isSelected && isCorrect) {
                            choiceText = `**${choiceText}** (Should have chosen)`;
                        }
                    } else {
                        prefix = `[${isSelected ? 'x' : ' '}]`;
                        if (isSelected) {
                            choiceText = `**${choiceText}** (My Choice)`;
                        }
                    }

                    contentMd += `- ${prefix} ${choiceText}\n`;
                });

                if (isReview && rightAnswerText && !contentMd.includes('[x]')) {
                    const lines = rightAnswerText.split('\n').map(l => l.trim()).filter(l => !!l);
                    if (lines.length > 0) {
                        contentMd += '\n> Correct answer: ' + lines.map(l => `**${l}**`).join('\n> ') + '\n';
                    }
                }
            }
            // Handle Drag and Drop into Text
            else if (q.classList.contains('ddwtos')) {
                const qtext = clone.querySelector('.qtext');
                if (qtext) {
                    const dropZones = qtext.querySelectorAll('.drop');
                    dropZones.forEach((dz, i) => {
                        dz.replaceWith(`[[${i + 1}]]`);
                    });
                }
                
                contentMd = cleanText(sanitizeNode(clone, imgMap)) + '\n\n';

                const drags = Array.from(q.querySelectorAll('.answercontainer .draghome'));
                if (drags.length > 0) {
                    contentMd += '**Choices:**\n';
                    drags.forEach((drag, i) => {
                        contentMd += `- [${i + 1}] ${cleanText(sanitizeNode(drag, imgMap))}\n`;
                    });
                }

                const rightAnswerEl = q.querySelector('.rightanswer');
                if (isReview && rightAnswerEl) {
                    contentMd += `\n\n> Correct Answer: **${cleanText(sanitizeNode(rightAnswerEl, imgMap))}**\n`;
                }
            }
            // Default handling
            else {
                let userInputsText = '';
                if (!isReview) {
                    const textInputs = clone.querySelectorAll('input[type="text"]');
                    if (textInputs.length > 0) {
                        userInputsText = '\n\n**My Answers:**\n';
                        textInputs.forEach((inp, i) => {
                            if (inp.value) userInputsText += `- Input ${i + 1}: **${inp.value}**\n`;
                        });
                    }
                }

                clone.querySelectorAll('.feedback, .feedbackspan, .yui3-overlay, .icon, .grade, .state, .accesshide').forEach(el => el.remove());
                contentMd = cleanText(sanitizeNode(clone, imgMap));
                
                if (userInputsText) {
                    contentMd += userInputsText;
                }

                const rightAnswerEl = q.querySelector('.rightanswer');
                if (isReview && rightAnswerEl) {
                    contentMd += `\n\n> Correct Answer: **${cleanText(sanitizeNode(rightAnswerEl, imgMap))}**\n`;
                }
            }
        }

        md += `### Câu hỏi ${qno}\n\n${contentMd}\n\n---\n\n`;
    });

    return md;
}

/**
 * Main handler for LMS (Moodle) specific features.
 * @param {string} url The current page URL.
 * @param {Object|null} savedData User's saved login credentials.
 */
export function handleLMSPages(url, savedData) {
    const loginForm = document.getElementById('login');

    // 4.1. Login Page Logic
    if (loginForm && (url.includes('/login/index.php') || url.includes('/login/'))) {
        const accInput = document.getElementById('username');
        const passInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginbtn');

        if (accInput && passInput && loginBtn && !document.getElementById('remember-me-lms')) {
            const rememberDiv = document.createElement('div');
            rememberDiv.className = 'rememberpass mt-2 mb-2';
            rememberDiv.innerHTML = `
                <label style="cursor: pointer; font-size: 14px; color: #333;">
                    <input type="checkbox" id="remember-me-lms" style="vertical-align: middle; margin-right: 5px;">
                    Ghi nhớ đăng nhập (Enhancer)
                </label>
            `;
            loginBtn.parentNode.insertBefore(rememberDiv, loginBtn);

            const rememberCb = document.getElementById('remember-me-lms');

            if (savedData) {
                accInput.value = savedData.acc;
                passInput.value = savedData.pass;
                rememberCb.checked = true;

                if (url.includes('autologin=true')) {
                    setTimeout(() => loginBtn.click(), 500);
                }
            }

            loginForm.addEventListener('submit', () => {
                if (rememberCb.checked) {
                    localStorage.setItem('savedLoginLMS', JSON.stringify({
                        acc: accInput.value,
                        pass: passInput.value
                    }));
                } else {
                    localStorage.removeItem('savedLoginLMS');
                }
            });
        }
    }

    // 4.2. Global Login Link Logic
    const lmsLoginLink = document.querySelector('.login a[href*="/login/index.php"]');
    if (lmsLoginLink && savedData) {
        if (!lmsLoginLink.href.includes('autologin=true')) {
            lmsLoginLink.href += (lmsLoginLink.href.includes('?') ? '&' : '?') + 'autologin=true';
        }
    }

    // 4.3. Quiz Page Logic
    if (url.includes('/mod/quiz/')) {
        const addMarkdownButtons = () => {
            if (document.getElementById('markdown-buttons-container')) return true;

            const navBlock = document.getElementById('mod_quiz_navblock');
            const prevBtn = document.querySelector('.mod_quiz-prev-nav');
            const nextBtn = document.querySelector('.mod_quiz-next-nav');
            const reviewSummary = document.querySelector('.quizreviewsummary');
            const summaryTable = document.querySelector('.quizsummaryofattempt');
            
            // Priority: Under Nav Block > Before Nav Buttons > Before Review Summary
            const targetBtn = navBlock || prevBtn || nextBtn || reviewSummary || summaryTable;
            
            if (!targetBtn) return false;

            const container = document.createElement('div');
            container.id = 'markdown-buttons-container';
            
            if (navBlock) {
                // Style as a Moodle card if placing under nav block
                container.className = 'block block_fake card mb-3';
                container.innerHTML = `
                    <div class="card-body p-3">
                        <h5 class="card-title d-inline">Enhancer Tools</h5>
                        <div class="card-text content mt-3" id="enhancer-buttons-inner"></div>
                    </div>
                `;
            } else {
                container.style.display = 'inline-block';
                container.style.marginRight = '8px';
            }

            const buttonTarget = container.querySelector('#enhancer-buttons-inner') || container;

            const createCopyButton = (id, text, options) => {
                const btn = document.createElement('button');
                btn.id = id;
                btn.innerText = text;
                btn.className = 'btn btn-secondary';
                btn.style.marginRight = '8px';
                btn.style.marginBottom = '8px';
                if (navBlock) btn.style.width = '100%'; // Full width in sidebar

                btn.onclick = async (e) => {
                    e.preventDefault();
                    const originalText = btn.innerText;
                    btn.innerText = 'Extracting...';
                    try {
                        const md = await extractQuiz(options);
                        if (!md.trim()) {
                            alert('Không tìm thấy nội dung câu hỏi để xuất!');
                            btn.innerText = originalText;
                            return;
                        }

                        const copyToClipboard = async (text) => {
                            if (typeof GM_setClipboard !== 'undefined') {
                                GM_setClipboard(text);
                                return true;
                            } else {
                                return navigator.clipboard.writeText(text);
                            }
                        };

                        try {
                            await copyToClipboard(md);
                            btn.innerText = 'Copied ✓';
                            setTimeout(() => btn.innerText = text, 1500);
                        } catch (err) {
                            console.error('Failed to copy: ', err);
                            alert('Lỗi khi copy vào clipboard: ' + err);
                            btn.innerText = originalText;
                        }
                    } catch (err) {
                        console.error('Quiz export failed: ', err);
                        alert('Lỗi khi xuất Markdown: ' + err);
                        btn.innerText = originalText;
                    }
                };
                return btn;
            };

            const copyBtn = createCopyButton('copy-markdown-btn', '📋 Copy Markdown đề bài', { includeAnswers: false });
            const copyAnswerBtn = createCopyButton('copy-answer-btn', '📋 Copy Markdown đáp án', { includeAnswers: true });
            const diagnoseBtn = createCopyButton('diagnose-btn', '🩺 Giải thích câu sai (AI)', { includeAnswers: true, diagnose: true });
            diagnoseBtn.className = 'btn btn-danger';
            diagnoseBtn.style.marginRight = '8px';
            diagnoseBtn.style.marginBottom = '8px';
            if (navBlock) diagnoseBtn.style.width = '100%';
            diagnoseBtn.title = 'Trích xuất các câu sai và nhờ AI giải thích';

            // Override diagnose button click to also open Gemini
            const originalDiagnoseClick = diagnoseBtn.onclick;
            diagnoseBtn.onclick = async (e) => {
                await originalDiagnoseClick(e);
                if (!sessionStorage.getItem('svdut_gemini_opened')) {
                    window.open('https://gemini.google.com/app', '_blank');
                    sessionStorage.setItem('svdut_gemini_opened', '1');
                }
            };

            const downloadBtn = document.createElement('button');
            downloadBtn.id = 'download-markdown-btn';
            downloadBtn.innerText = '📥 Tải file Markdown (.md)';
            downloadBtn.className = 'btn btn-info';
            downloadBtn.style.marginBottom = '8px';
            if (navBlock) {
                downloadBtn.style.width = '100%';
                downloadBtn.style.marginRight = '8px';
            }

            downloadBtn.onclick = async (e) => {
                e.preventDefault();
                const originalText = downloadBtn.innerText;
                downloadBtn.innerText = '⌛ Đang chuẩn bị...';
                try {
                    const md = await extractQuiz({ includeAnswers: true });
                    if (!md.trim()) {
                        alert('Không tìm thấy nội dung câu hỏi để xuất!');
                        downloadBtn.innerText = originalText;
                        return;
                    }
                    const blob = new Blob([md], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    let filename = `quiz_export_${new Date().getTime()}`;
                    try {
                        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb-item')).map(item => item.textContent.trim());
                        if (breadcrumbs.length > 0) {
                            let quizName = breadcrumbs[breadcrumbs.length - 1];
                            const genericNames = ['Summary', 'Review', 'Xem lại', 'Tổng kết', 'Lần thử', 'Action', 'Preview'];
                            if (genericNames.some(g => quizName.includes(g)) && breadcrumbs.length > 1) {
                                quizName = breadcrumbs[breadcrumbs.length - 2];
                            }
                            filename = quizName;
                        }
                        filename = filename.replace(/[\/\\:*?"<>|\[\]]/g, '').trim();
                    } catch (e) {
                        console.error('Error extracting filename:', e);
                    }
                    a.download = `${filename}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    downloadBtn.innerText = '✅ Đã tải xong';
                    setTimeout(() => downloadBtn.innerText = '📥 Tải file Markdown (.md)', 1500);
                } catch (err) {
                    console.error('Download failed: ', err);
                    alert('Lỗi khi tải file: ' + err);
                    downloadBtn.innerText = originalText;
                }
            };

            const geminiBtn = document.createElement('button');
            geminiBtn.id = 'ask-gemini-btn';
            geminiBtn.innerText = '🤖 Hỏi Gemini (AI)';
            geminiBtn.className = 'btn btn-warning';
            geminiBtn.style.marginBottom = '8px';
            if (navBlock) {
                geminiBtn.style.width = '100%';
            } else {
                geminiBtn.style.marginLeft = '8px';
            }
            geminiBtn.title = 'Nhờ Gemini AI trả lời câu hỏi hiện tại';

            geminiBtn.onclick = async (e) => {
                e.preventDefault();
                geminiBtn.disabled = true;
                try {
                    await autoAnswerCurrentQuestion(geminiBtn);
                } finally {
                    geminiBtn.disabled = false;
                }
            };

            const isAttempt = window.location.href.includes('attempt.php');
            const isReview = window.location.href.includes('review.php');

            // 1. AI Tools
            buttonTarget.appendChild(geminiBtn);
            if (isReview) {
                buttonTarget.appendChild(diagnoseBtn);
            }

            // 2. Extraction & Export Tools
            buttonTarget.appendChild(copyBtn); 
            if (!isAttempt) {
                buttonTarget.appendChild(copyAnswerBtn);
                buttonTarget.appendChild(downloadBtn); 
            }

            if (navBlock) {
                navBlock.parentNode.insertBefore(container, navBlock.nextSibling);
            } else {
                targetBtn.parentNode.insertBefore(container, targetBtn);
            }

            // Periodic server check
            const checkBridge = async () => {
                try {
                    const res = await fetch('http://localhost:8081/status', { mode: 'cors', signal: AbortSignal.timeout(1000) });
                    const data = await res.json();
                    if (data.status === 'running') {
                        const existing = document.getElementById('server-reminder-lms');
                        if (existing) existing.remove();
                    } else {
                        showServerReminder();
                    }
                } catch (e) {
                    showServerReminder();
                }
            };
            checkBridge();
            setInterval(checkBridge, 10000);

            return true;
        };

        const injectTimer = setInterval(() => {
            if (addMarkdownButtons()) clearInterval(injectTimer);
        }, 1000);
        setTimeout(() => clearInterval(injectTimer), 10000);
    }

    // 4.4. Quiz Summary Page Logic
    if (url.includes('/mod/quiz/summary.php')) {
        const addSummaryButtons = () => {
            if (document.getElementById('summary-view-all-btn')) return true;
            // Find the first submitbtns container
            const container = document.querySelector('.submitbtns.mdl-align');
            if (!container) return false;

            const controls = container.querySelector('.controls');
            if (!controls) return false;

            const btn = document.createElement('button');
            btn.id = 'summary-view-all-btn';
            btn.innerText = '🔍 Xem tất cả câu hỏi (Enhancer)';
            const navBlock = document.getElementById('mod_quiz_navblock');
            if (navBlock) {
                btn.className = 'btn btn-primary mb-2 w-100';
            } else {
                btn.className = 'btn btn-primary ml-2';
            }
            btn.onclick = async (e) => {
                e.preventDefault();
                btn.disabled = true;
                const originalText = btn.innerText;
                btn.innerText = '⌛ Đang tải câu hỏi...';
                try {
                    await showAllQuestionsOnSummary();
                    btn.innerText = '✅ Đã tải xong';
                } catch (err) {
                    console.error('Failed to load questions:', err);
                    alert('Lỗi khi tải câu hỏi: ' + err);
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            };
            controls.appendChild(btn);

            const downloadBtn = document.createElement('button');
            downloadBtn.id = 'summary-download-md-btn';
            downloadBtn.innerText = '📥 Tải file Markdown (.md)';
            if (navBlock) {
                downloadBtn.className = 'btn btn-info mb-2 w-100';
            } else {
                downloadBtn.className = 'btn btn-info ml-2';
            }
            downloadBtn.onclick = async (e) => {
                e.preventDefault();
                downloadBtn.disabled = true;
                const originalText = downloadBtn.innerText;
                downloadBtn.innerText = '⌛ Đang chuẩn bị...';
                try {
                    if (!document.getElementById('all-questions-container')) {
                        await showAllQuestionsOnSummary();
                    }
                    const md = await extractQuiz({ includeAnswers: true, diagnose: false });
                    if (!md.trim()) {
                        alert('Không tìm thấy nội dung câu hỏi để xuất!');
                        downloadBtn.innerText = originalText;
                        downloadBtn.disabled = false;
                        return;
                    }
                    const blob = new Blob([md], { type: 'text/markdown' });
                    const urlObj = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = urlObj;
                    let filename = `quiz_export_answers_${new Date().getTime()}`;
                    try {
                        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb-item')).map(item => item.textContent.trim());
                        if (breadcrumbs.length > 0) {
                            let quizName = breadcrumbs[breadcrumbs.length - 1];
                            const genericNames = ['Summary', 'Review', 'Xem lại', 'Tổng kết', 'Lần thử', 'Action', 'Preview'];
                            if (genericNames.some(g => quizName.includes(g)) && breadcrumbs.length > 1) {
                                quizName = breadcrumbs[breadcrumbs.length - 2];
                            }
                            filename = quizName;
                        }
                        filename = filename.replace(/[\/\\:*?"<>|\[\]]/g, '').trim();
                    } catch (err) { }
                    a.download = `${filename}.md`;
                    a.click();
                    URL.revokeObjectURL(urlObj);
                    downloadBtn.innerText = '✅ Đã tải xong';
                    setTimeout(() => { downloadBtn.innerText = originalText; downloadBtn.disabled = false; }, 1500);
                } catch (err) {
                    console.error('Failed to download markdown:', err);
                    alert('Lỗi khi tải markdown: ' + err);
                    downloadBtn.innerText = originalText;
                    downloadBtn.disabled = false;
                }
            };
            controls.appendChild(downloadBtn);

            return true;
        };

        const injectTimer = setInterval(() => {
            if (addSummaryButtons()) clearInterval(injectTimer);
        }, 1000);
        setTimeout(() => clearInterval(injectTimer), 10000);
    }
}

/**
 * Fetch all quiz attempt pages and display questions on the summary page.
 */
async function showAllQuestionsOnSummary() {
    const summaryTable = document.querySelector('.quizsummaryofattempt');
    if (!summaryTable) throw new Error('Không tìm thấy bảng tổng kết.');

    const links = Array.from(summaryTable.querySelectorAll('a[href*="attempt.php"]'));
    if (links.length === 0) throw new Error('Không tìm thấy liên kết đến các câu hỏi.');

    const pages = new Set();
    links.forEach(link => {
        const url = new URL(link.href);
        url.hash = ''; // Remove anchor
        pages.add(url.toString());
    });

    let questionsContainer = document.getElementById('all-questions-container');
    if (!questionsContainer) {
        questionsContainer = document.createElement('div');
        questionsContainer.id = 'all-questions-container';
        questionsContainer.style.marginTop = '30px';
        questionsContainer.style.padding = '20px';
        questionsContainer.style.borderTop = '2px solid #eee';
        questionsContainer.innerHTML = '<h3 class="mb-4">Nội dung câu hỏi</h3>';
        
        // Insert after summary table or after the parent div
        const parent = summaryTable.closest('#region-main') || summaryTable.parentNode;
        parent.appendChild(questionsContainer);
    }

    for (const pageUrl of pages) {
        const resp = await fetch(pageUrl);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const questions = doc.querySelectorAll('.que');
        
        questions.forEach(q => {
            // Remove some noise but keep the core content
            const clone = document.importNode(q, true);
            clone.querySelectorAll('.questionflag, .grade, .state, .accesshide').forEach(el => el.remove());
            
            // Make it readonly if needed, but usually it's fine
            questionsContainer.appendChild(clone);
        });
    }
}

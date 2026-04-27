// ==UserScript==
// @name         Gemini Prompt Pro
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  A Categorized Quick-Prompt Userscript for Google Gemini
// @match        https://gemini.google.com/app*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const prompts = {
        "ELI5": "Explain this concept to me as if I am 5 years old, using very simple language and relatable everyday examples.",
        "Analogy": "Provide a creative and accurate analogy to help me understand this topic better.",
        "Deep Dive": "Provide a comprehensive deep dive into this topic, covering its history, core mechanisms, advanced implications, and current state-of-the-art developments.",
        "Refactor": "Please refactor the following code to improve its readability, maintainability, and performance. Follow clean code principles and best practices for the language.",
        "Document": "Generate comprehensive documentation for the following code, including inline comments explaining complex logic, and a high-level overview of its purpose and inputs/outputs.",
        "Debug": "Analyze the following code or error message to identify the root cause of the bug. Explain the problem and provide a corrected version of the code.",
        "Critique": "Critique my idea, argument, or plan. Point out potential flaws, edge cases I might have missed, and suggest concrete ways to strengthen it.",
        "Summarize": "Summarize the key points of the text or conversation above into a concise, easily digestible format, highlighting only the most crucial information.",
        "Simplify": "Simplify this text or explanation. Remove jargon, shorten convoluted sentences, and make the overall message much clearer and more direct."
    };

    const categories = [
        { name: "Understand", chips: ["ELI5", "Analogy", "Deep Dive"] },
        { name: "Dev", chips: ["Refactor", "Document", "Debug"] },
        { name: "Strategic", chips: ["Critique", "Summarize", "Simplify"] }
    ];

    const CONTAINER_ID = 'vibecode-gemini-prompts-container';

    function injectStyles() {
        if (document.getElementById('vibecode-gemini-styles')) return;

        const style = document.createElement('style');
        style.id = 'vibecode-gemini-styles';
        style.textContent = `
            #vibecode-gemini-prompts-container {
                display: flex;
                overflow-x: auto;
                gap: 12px;
                padding: 10px 16px;
                margin-bottom: 8px;
                scrollbar-width: none; /* Firefox */
                -ms-overflow-style: none; /* IE/Edge */
                width: 100%;
                box-sizing: border-box;
                align-items: center;
                background: transparent;
            }
            #vibecode-gemini-prompts-container::-webkit-scrollbar {
                display: none; /* Chrome/Safari */
            }
            .vibecode-prompt-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .vibecode-prompt-group:not(:last-child)::after {
                content: '';
                display: block;
                width: 1px;
                height: 20px;
                background: #e1e1e1;
                margin: 0 4px;
            }
            @media (prefers-color-scheme: dark) {
                .vibecode-prompt-group:not(:last-child)::after {
                    background: #333333;
                }
            }
            .vibecode-prompt-chip {
                background: #f5f5f7;
                border: 1px solid #e1e1e1;
                border-radius: 16px;
                padding: 6px 14px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                color: #1a1a1a;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s ease;
            }
            .vibecode-prompt-chip:hover {
                background: #e8e8ed;
                border-color: #d1d1d1;
                transform: translateY(-1px);
            }
            @media (prefers-color-scheme: dark) {
                .vibecode-prompt-chip {
                    background: #1c1c1e;
                    border-color: #333333;
                    color: #f5f5f7;
                }
                .vibecode-prompt-chip:hover {
                    background: #2c2c2e;
                    border-color: #444444;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function createChips() {
        const container = document.createElement('div');
        container.id = CONTAINER_ID;

        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'vibecode-prompt-group';

            for (let j = 0; j < category.chips.length; j++) {
                const chipName = category.chips[j];
                const chip = document.createElement('button');
                chip.className = 'vibecode-prompt-chip';
                chip.textContent = chipName;
                
                chip.addEventListener('click', function(e) {
                    e.preventDefault();
                    insertPrompt(prompts[chipName]);
                });
                
                groupDiv.appendChild(chip);
            }
            
            container.appendChild(groupDiv);
        }

        return container;
    }

    function insertPrompt(text) {
        const editor = document.querySelector('.ql-editor') || document.querySelector('rich-textarea') || document.querySelector('.ProseMirror') || document.querySelector('p[data-placeholder]') || document.querySelector('div[contenteditable="true"]');
        
        if (!editor) {
             console.warn('Gemini Prompt Pro: Could not find editor element.');
             return;
        }

        editor.focus();

        const success = document.execCommand('insertText', false, text);
        
        if (!success) {
            if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + text.length;
            } else {
                 editor.textContent += text;
            }
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            editor.dispatchEvent(inputEvent);
        } else {
             const inputEvent = new Event('input', { bubbles: true, cancelable: true });
             editor.dispatchEvent(inputEvent);
        }
    }

    function injectUI() {
        if (document.getElementById(CONTAINER_ID)) return;

        const inputContainer = document.querySelector('.input-area-container') || document.querySelector('chat-window')?.shadowRoot?.querySelector('.input-area-container');
        
        if (!inputContainer) return;

        if (inputContainer.parentElement.querySelector('#' + CONTAINER_ID)) return;

        injectStyles();
        const chipsContainer = createChips();
        
        inputContainer.parentElement.insertBefore(chipsContainer, inputContainer);
    }

    const observer = new MutationObserver(function(mutations) {
        let shouldCheck = false;
        for (let i = 0; i < mutations.length; i++) {
            if (mutations[i].addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }
        if (shouldCheck) {
            if (!document.getElementById(CONTAINER_ID)) {
                injectUI();
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(injectUI, 1000);
})();

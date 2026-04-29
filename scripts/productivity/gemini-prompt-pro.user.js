// ==UserScript==
// @name         Gemini Prompt Pro
// @namespace    http://tampermonkey.net/
// @version      1.0.6
// @description  A Categorized Quick-Prompt Userscript for Google Gemini
// @author       hthienloc
// @match        https://gemini.google.com/app*
// @grant        none
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/gemini-prompt-pro.user.js
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/gemini-prompt-pro.user.js
// @icon         https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/gemini-prompt-pro.svg
// ==/UserScript==

(function() {
    'use strict';

    const prompts = {
        "ELI5": "Explain this concept to me as if I am 5 years old, using very simple language and relatable everyday examples.",
        "Analogy": "Provide a creative and accurate analogy to help me understand this topic better.",
        "Concept Map": "Create a concept map or outline breaking down this topic into its core components and their relationships.",
        "Visualizer": "Describe how I can visualize this concept or data, or generate a descriptive prompt for an image generator.",
        "Refactor": "Please refactor the following code to improve its readability, maintainability, and performance. Follow clean code principles and best practices for the language.",
        "Debug": "Analyze the following code or error message to identify the root cause of the bug. Explain the problem and provide a corrected version of the code.",
        "Document": "Generate comprehensive documentation for the following code, including inline comments explaining complex logic, and a high-level overview of its purpose and inputs/outputs.",
        "Test Cases": "Write comprehensive test cases for the following code, covering typical use cases, edge cases, and potential error conditions.",
        "Explain Code": "Explain the following code step by step, describing what each section does and how it contributes to the overall functionality.",
        "Summarize": "Summarize the key points of the text or conversation above into a concise, easily digestible format, highlighting only the most crucial information.",
        "Professional Tone": "Rewrite the following text to sound more professional, polite, and suitable for a formal business environment.",
        "Proofread": "Proofread the following text for grammar, spelling, and punctuation errors. Suggest improvements for flow and clarity.",
        "Simplify": "Simplify this text or explanation. Remove jargon, shorten convoluted sentences, and make the overall message much clearer and more direct.",
        "Critique": "Critique my idea, argument, or plan. Point out potential flaws, edge cases I might have missed, and suggest concrete ways to strengthen it.",
        "First Principles": "Break down this complex problem into its fundamental truths (first principles), and reason up from there.",
        "Pros & Cons": "List the pros and cons of this idea or decision, providing a balanced and objective analysis.",
        "Step-by-Step": "Provide a detailed, step-by-step guide or logical sequence to accomplish this task or solve this problem."
    };

    const categories = [
        { name: "Knowledge", chips: ["ELI5", "Analogy", "Concept Map", "Visualizer"] },
        { name: "Coding", chips: ["Refactor", "Debug", "Document", "Test Cases", "Explain Code"] },
        { name: "Writing", chips: ["Summarize", "Professional Tone", "Proofread", "Simplify"] },
        { name: "Logic", chips: ["Critique", "First Principles", "Pros & Cons", "Step-by-Step"] }
    ];

    const CONTAINER_ID = 'vibecode-gemini-prompts-container';

    function injectStyles() {
        if (document.getElementById('vibecode-gemini-styles')) return;

        const style = document.createElement('style');
        style.id = 'vibecode-gemini-styles';
        style.textContent = `
            #vibecode-gemini-prompts-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 12px;
                padding: 10px 16px;
                margin-bottom: 8px;
                width: 100%;
                box-sizing: border-box;
                align-items: center;
                background: transparent;
            }
            .vibecode-clear-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: transparent;
                border: 1px solid #e1e1e1;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                z-index: 10;
                font-size: 16px;
                color: #5f6368;
            }
            .vibecode-clear-btn:hover {
                background: #f0f0f2;
                border-color: #d1d1d1;
            }
            .vibecode-category-wrapper {
                position: relative;
                display: inline-flex;
            }
            .vibecode-category-chip {
                background: #f5f5f7;
                border: 1px solid #e1e1e1;
                border-radius: 16px;
                padding: 6px 14px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 13px;
                font-weight: 500;
                color: #1a1a1a;
                cursor: default;
                white-space: nowrap;
                transition: all 0.2s ease;
                z-index: 2;
            }
            .vibecode-category-wrapper:hover .vibecode-category-chip {
                background: #e8e8ed;
                border-color: #d1d1d1;
                transform: translateY(-1px);
            }
            .vibecode-popover {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%) translateY(10px);
                opacity: 0;
                visibility: hidden;
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px;
                background: #ffffff;
                border: 1px solid #e1e1e1;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
                margin-bottom: 10px;
                min-width: 120px;
            }
            /* Small arrow for popover */
            .vibecode-popover::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                margin-left: -6px;
                border-width: 6px;
                border-style: solid;
                border-color: #ffffff transparent transparent transparent;
            }
            .vibecode-category-wrapper:hover .vibecode-popover {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }
            .vibecode-prompt-item {
                background: transparent;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 13px;
                color: #1a1a1a;
                cursor: pointer;
                white-space: nowrap;
                text-align: left;
                transition: background 0.2s ease;
            }
            .vibecode-prompt-item:hover {
                background: #f0f0f2;
            }
            @media (prefers-color-scheme: dark) {
                .vibecode-clear-btn {
                    border-color: #333333;
                    color: #e8eaed;
                }
                .vibecode-clear-btn:hover {
                    background: #2c2c2e;
                    border-color: #444444;
                }
                .vibecode-category-chip {
                    background: #1c1c1e;
                    border-color: #333333;
                    color: #f5f5f7;
                }
                .vibecode-category-wrapper:hover .vibecode-category-chip {
                    background: #2c2c2e;
                    border-color: #444444;
                }
                .vibecode-popover {
                    background: #1c1c1e;
                    border-color: #333333;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                }
                .vibecode-popover::after {
                    border-color: #333333 transparent transparent transparent;
                }
                .vibecode-prompt-item {
                    color: #f5f5f7;
                }
                .vibecode-prompt-item:hover {
                    background: #2c2c2e;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function createChips() {
        const container = document.createElement('div');
        container.id = CONTAINER_ID;

        categories.forEach(category => {
            const wrapper = document.createElement('div');
            wrapper.className = 'vibecode-category-wrapper';

            const catChip = document.createElement('div');
            catChip.className = 'vibecode-category-chip';
            catChip.textContent = category.name;

            const popover = document.createElement('div');
            popover.className = 'vibecode-popover';

            category.chips.forEach(chipName => {
                const item = document.createElement('button');
                item.className = 'vibecode-prompt-item';
                item.textContent = chipName;
                item.title = prompts[chipName];
                
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    insertPrompt(prompts[chipName]);
                });
                
                popover.appendChild(item);
            });

            wrapper.appendChild(catChip);
            wrapper.appendChild(popover);
            container.appendChild(wrapper);
        });

        return container;
    }

    function clearEditor() {
        const editor = document.querySelector('.ql-editor') || document.querySelector('rich-textarea') || document.querySelector('.ProseMirror') || document.querySelector('p[data-placeholder]') || document.querySelector('div[contenteditable="true"]');
        
        if (!editor) {
             console.warn('Gemini Prompt Pro: Could not find editor element to clear.');
             return;
        }

        editor.focus();

        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            editor.value = '';
        } else {
             editor.textContent = '';
        }
        
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        editor.dispatchEvent(inputEvent);
    }

    function createClearButton() {
        const btn = document.createElement('button');
        btn.className = 'vibecode-clear-btn';
        btn.innerHTML = '🗑️';
        btn.title = 'Clear Editor';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            clearEditor();
        });
        return btn;
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

        // Inject clear button
        if (!inputContainer.querySelector('.vibecode-clear-btn')) {
            const clearBtn = createClearButton();
            inputContainer.style.position = 'relative';
            inputContainer.appendChild(clearBtn);
        }
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

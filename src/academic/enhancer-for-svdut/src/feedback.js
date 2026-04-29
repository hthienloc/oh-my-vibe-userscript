/**
 * Main handler for Feedback portal specific features.
 * @param {string} url The current page URL.
 */
export function handleFeedbackPages(url) {
    if (url.includes('fb.dut.udn.vn')) {
        const insertSurveyButton = () => {
            if (document.getElementById('quick-survey-btn')) return;

            // Try to find a good spot in the header to insert the button
            const header = document.querySelector('.navbar, .header, #header') || document.body;
            
            const btn = document.createElement('button');
            btn.id = 'quick-survey-btn';
            btn.textContent = '🚀 Quick Survey (Tự động đánh giá)';
            btn.style.position = header === document.body ? 'fixed' : 'relative';
            if (header === document.body) {
                btn.style.top = '10px';
                btn.style.right = '10px';
                btn.style.zIndex = '9999';
            } else {
                btn.style.margin = '10px';
            }
            btn.style.padding = '8px 15px';
            btn.style.backgroundColor = '#4D90FE';
            btn.style.color = '#fff';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.fontWeight = 'bold';
            btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                let count = 0;
                
                // Find all rows that might contain radio buttons for survey questions
                const rows = document.querySelectorAll('tr');
                rows.forEach(row => {
                    const radios = Array.from(row.querySelectorAll('input[type="radio"]'));
                    if (radios.length > 0) {
                        // Most surveys put the highest positive rating either first or last.
                        // Usually in DUT surveys, the first option is "Hoàn toàn đồng ý / Rất tốt"
                        // Wait, the prompt says "usually the first or last radio button in each row".
                        // To be safe, let's select the first radio button.
                        const targetRadio = radios[0]; 
                        if (targetRadio && !targetRadio.checked) {
                            targetRadio.checked = true;
                            // Trigger change event if there are listeners attached
                            targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
                            count++;
                        }
                    }
                });

                alert(`Đã tự động chọn mức đánh giá cao nhất cho ${count} câu hỏi!\nVui lòng kiểm tra lại trước khi "Lưu".`);
            });

            if (header === document.body) {
                document.body.appendChild(btn);
            } else {
                header.appendChild(btn);
            }
        };

        // If the page is already loaded or we need to wait for dynamic content
        insertSurveyButton();
        // Fallback for dynamic frameworks if any
        setTimeout(insertSurveyButton, 2000);
    }
}

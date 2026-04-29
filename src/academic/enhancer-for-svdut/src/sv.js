const PERIOD_TIMES = {
    1:  { start: '07:00', end: '07:50' },
    2:  { start: '08:00', end: '08:50' },
    3:  { start: '09:00', end: '09:50' },
    4:  { start: '10:00', end: '10:50' },
    5:  { start: '11:00', end: '11:50' },
    6:  { start: '12:30', end: '13:20' },
    7:  { start: '13:30', end: '14:20' },
    8:  { start: '14:30', end: '15:20' },
    9:  { start: '15:30', end: '16:20' },
    10: { start: '16:30', end: '17:20' },
    11: { start: '17:30', end: '18:15' },
    12: { start: '18:15', end: '19:00' },
    13: { start: '19:10', end: '19:55' },
    14: { start: '19:55', end: '20:40' }
};

const DAY_OFFSET = {
    'Thứ 2': 0, 'Thứ 3': 1, 'Thứ 4': 2, 'Thứ 5': 3, 'Thứ 6': 4, 'Thứ 7': 5, 'Chủ nhật': 6
};

function combineDateAndTime(date, timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(h, m, 0, 0);
    return newDate;
}

function formatToICSDate(date) {
    return date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0') + 'T' +
        date.getHours().toString().padStart(2, '0') +
        date.getMinutes().toString().padStart(2, '0') + '00';
}

function downloadICS(data, reminderMinutes) {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//DUT Enhancer//Schedule//VI',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    data.forEach(event => {
        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`SUMMARY:${event.Subject}`);
        icsContent.push(`DTSTART:${formatToICSDate(event.Start)}`);
        icsContent.push(`DTEND:${formatToICSDate(event.End)}`);
        icsContent.push(`LOCATION:${event.Location}`);
        icsContent.push(`DESCRIPTION:${event.Description}`);
        
        if (reminderMinutes !== 'none') {
            icsContent.push('BEGIN:VALARM');
            icsContent.push(`TRIGGER:-PT${reminderMinutes}M`);
            icsContent.push('ACTION:DISPLAY');
            icsContent.push('DESCRIPTION:Reminder');
            icsContent.push('END:VALARM');
        }

        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lich_hoc_dut.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Hướng dẫn nhập lịch
    setTimeout(() => {
        alert(
            '🎉 Tải về thành công!\n\n' +
            'Hướng dẫn nhập lịch vào Google Calendar:\n' +
            '1. Vào Google Calendar, bấm vào icon Bánh răng -> Cài đặt.\n' +
            '2. Chọn "Thêm lịch" -> "Tạo lịch mới".\n' +
            '3. Nhập tên (ví dụ: Lịch học) và bấm "Tạo lịch".\n' +
            '4. Sau khi tạo xong, vào mục "Nhập & xuất" -> "Nhập".\n' +
            '5. Chọn file vừa tải về từ máy tính.\n' +
            '6. Tại mục "Thêm vào lịch", hãy chọn tên lịch bạn vừa tạo.\n' +
            '7. Bấm "Nhập" để hoàn tất.'
        );
    }, 500);
}

function exportScheduleToGoogleCalendar() {
    const docAll = document;
    const isHocChecked = docAll.getElementById('export-hoc-cb')?.checked;
    const isThiChecked = docAll.getElementById('export-thi-cb')?.checked;
    const reminderVal = docAll.getElementById('export-reminder-select')?.value;
    const reminderMinutes = reminderVal === 'none' ? 'none' : (parseInt(reminderVal) || 30);

    if (!isHocChecked && !isThiChecked) {
        alert('Vui lòng chọn ít nhất một nội dung để xuất!');
        return;
    }
    const week1StartStr = '2025-08-04'; // Sửa ngày bắt đầu tuần 1 tại đây
    const week1Start = new Date(week1StartStr);
    if (isNaN(week1Start.getTime())) {
        alert('Ngày cấu hình không hợp lệ!');
        return;
    }

    const events = [];

    // 1. Parse Class Schedule
    if (isHocChecked) {
        const classRows = document.querySelectorAll('#TTKB_GridInfo tr');
        classRows.forEach(row => {
            const cells = row.cells;
            if (cells.length < 10 || row.classList.contains('kctHeader')) return;

            const subject = cells[2].innerText.trim();
            const lecturer = cells[6].innerText.trim();
            const scheduleRaw = cells[7].innerText.trim();
            const weeksRaw = cells[8].innerText.trim();

            if (!scheduleRaw || !weeksRaw) return;

            const scheduleParts = scheduleRaw.split('\n').map(s => s.trim()).filter(s => s);
            scheduleParts.forEach(part => {
                const pieces = part.split(',');
                if (pieces.length < 3) return;

                const dayStr = pieces[0].trim();
                const periodsStr = pieces[1].trim();
                const room = pieces[2].trim();

                const dayOff = DAY_OFFSET[dayStr];
                if (dayOff === undefined) return;
                
                const periods = periodsStr.split('-').map(Number);
                const startTimeStr = PERIOD_TIMES[periods[0]]?.start;
                const endTimeStr = PERIOD_TIMES[periods[periods.length - 1]]?.end;

                if (!startTimeStr || !endTimeStr) return;

                const weeks = [];
                weeksRaw.split(';').forEach(wRange => {
                    const parts = wRange.split('-').map(Number);
                    if (parts.length === 2) {
                        for (let i = parts[0]; i <= parts[1]; i++) weeks.push(i);
                    } else if (parts[0]) {
                        weeks.push(parts[0]);
                    }
                });

                weeks.forEach(weekNum => {
                    const eventDate = new Date(week1Start);
                    eventDate.setDate(week1Start.getDate() + (weekNum - 1) * 7 + dayOff);

                    events.push({
                        'Subject': `[Học] ${subject}`,
                        'Start': combineDateAndTime(eventDate, startTimeStr),
                        'End': combineDateAndTime(eventDate, endTimeStr),
                        'Description': `GV: ${lecturer}\\nTuần: ${weekNum}`,
                        'Location': room
                    });
                });
            });
        });
    }

    // 2. Parse Exam Schedule
    if (isThiChecked) {
        const examRows = document.querySelectorAll('#TTKB_GridLT tr');
        examRows.forEach(row => {
            const cells = row.cells;
            if (cells.length < 6 || row.classList.contains('kctHeader')) return;

            const subject = cells[2].innerText.trim();
            const examInfo = cells[5].innerText.trim();

            if (!examInfo) return;

            const dateMatch = examInfo.match(/Ngày:\s*(\d{2})\/(\d{2})\/(\d{4})/);
            const roomMatch = examInfo.match(/Phòng:\s*([^,]+)/);
            const timeMatch = examInfo.match(/Giờ:\s*(\d{2})h(\d{2})/);

            if (dateMatch && timeMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]) - 1;
                const year = parseInt(dateMatch[3]);
                const eventDate = new Date(year, month, day);

                const startTime = `${timeMatch[1]}:${timeMatch[2]}`;
                
                const startHour = parseInt(timeMatch[1]);
                const startMin = parseInt(timeMatch[2]);
                const endTotalMin = startHour * 60 + startMin + 90;
                const endHour = Math.floor(endTotalMin / 60);
                const endMin = endTotalMin % 60;
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

                // Clean Exam Info: Remove redundant "Ngày" and "Giờ"
                const cleanedInfo = examInfo.split(',')
                    .map(s => s.trim())
                    .filter(s => !s.startsWith('Ngày:') && !s.startsWith('Giờ:'))
                    .join(', ');

                events.push({
                    'Subject': `[Thi] ${subject}`,
                    'Start': combineDateAndTime(eventDate, startTime),
                    'End': combineDateAndTime(eventDate, endTime),
                    'Description': cleanedInfo,
                    'Location': roomMatch ? roomMatch[1].trim() : ''
                });
            }
        });
    }

    if (events.length === 0) {
        alert('Không tìm thấy dữ liệu nào!');
        return;
    }

    downloadICS(events, reminderMinutes);
}

export function handleSVPages(url, savedData) {
    // --- 1. Login Page Logic ---
    if (url.includes('PageDangNhap.aspx')) {
        const accInput = document.getElementById('DN_txtAcc');
        const passInput = document.getElementById('DN_txtPass');
        const loginBtn = document.getElementById('QLTH_btnLogin');

        if (accInput && passInput && loginBtn && !document.getElementById('remember-me')) {
            const rememberRow = document.createElement('tr');
            rememberRow.innerHTML = `
                <td></td>
                <td colspan="2" style="text-align: left; padding: 5px 0 10px 0;">
                    <label style="cursor: pointer; font-size: 13px; color: #333;">
                        <input type="checkbox" id="remember-me" style="vertical-align: middle; margin-right: 5px;">
                        Ghi nhớ đăng nhập
                    </label>
                </td>
            `;

            const buttonRow = loginBtn.closest('tr');
            if (buttonRow && buttonRow.parentNode) {
                buttonRow.parentNode.insertBefore(rememberRow, buttonRow);
            }

            const rememberCb = document.getElementById('remember-me');

            if (savedData) {
                accInput.value = savedData.acc;
                passInput.value = savedData.pass;
                rememberCb.checked = true;

                if (url.includes('autologin=true')) {
                    setTimeout(() => loginBtn.click(), 300);
                }
            }

            rememberCb.addEventListener('change', () => {
                if (!rememberCb.checked) localStorage.removeItem('savedLogin');
            });

            loginBtn.addEventListener('click', () => {
                if (rememberCb.checked) {
                    localStorage.setItem('savedLogin', JSON.stringify({
                        acc: accInput.value,
                        pass: passInput.value
                    }));
                } else {
                    localStorage.removeItem('savedLogin');
                }
            });

            const saveHandler = (e) => {
                if (e.key === 'Enter') {
                    if (rememberCb.checked) {
                        localStorage.setItem('savedLogin', JSON.stringify({
                            acc: accInput.value,
                            pass: passInput.value
                        }));
                    } else {
                        localStorage.removeItem('savedLogin');
                    }
                }
            };
            accInput.addEventListener('keypress', saveHandler);
            passInput.addEventListener('keypress', saveHandler);
        }
    }

    // --- 2. Personal Info Page Logic ---
    if (url.includes('PageCaNhan.aspx')) {
        const tabs = document.getElementById('tabs_LcSV');
        if (tabs && !document.getElementById('privacy-toggle-btn')) {
            tabs.style.display = 'none';
            const btn = document.createElement('button');
            btn.id = 'privacy-toggle-btn';
            btn.textContent = '👁️ Hiện thông tin cá nhân';
            btn.className = 'tmButton';
            btn.type = 'button';
            btn.style.display = 'inline-block';
            btn.style.margin = '15px 0';
            btn.style.padding = '10px 20px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '14px';
            btn.style.lineHeight = 'normal';
            btn.style.height = 'auto'; 
            btn.style.boxSizing = 'border-box';

            let isHidden = true;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                isHidden = !isHidden;
                tabs.style.display = isHidden ? 'none' : 'block';
                btn.textContent = isHidden ? '👁️ Hiện thông tin cá nhân' : '🙈 Ẩn thông tin cá nhân';
            });

            tabs.parentNode.insertBefore(btn, tabs);
        }

        // --- 3. Schedules & Notifications Integration ---
        if (document.getElementById('schedules-container')) return;

        const schedulesContainer = document.createElement('div');
        schedulesContainer.id = 'schedules-container';
        schedulesContainer.style.marginTop = '20px';
        schedulesContainer.innerHTML = '<p style="padding: 10px; color: #666; font-style: italic;"> 🔄 Đang tải thông báo và lịch thi... </p>';
        
        const targetParent = document.getElementById('tabs_LcSV') || document.querySelector('.pageBody');
        if (targetParent) {
            targetParent.parentNode.insertBefore(schedulesContainer, targetParent.nextSibling);

            const fetchHome = fetch('/Default.aspx').then(r => r.text());
            const fetchExams = fetch('/PageLichTH.aspx').then(r => r.text());

            Promise.all([fetchHome, fetchExams])
                .then(([homeHtml, examPageHtml]) => {
                    let finalHTML = '';

                    const homeParser = new DOMParser();
                    const homeDoc = homeParser.parseFromString(homeHtml, 'text/html');
                    const searchBox = homeDoc.querySelector('.GreyBox:has(#MainContent_TB_btnFilter)');
                    const tabsBox = homeDoc.getElementById('tabs_PubTB');
                    
                    if (searchBox || tabsBox) {
                        const cleanHTML = (html) => html.replace(/ui-tabs-active|ui-state-active|ui-state-hover|ui-state-focus/g, '');

                        finalHTML += `
                            <style>
                                .tbBoxContent.collapsed { max-height: 100px; overflow: hidden; position: relative; }
                                .tbBoxContent.collapsed::after { 
                                    content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 40px; 
                                    background: linear-gradient(transparent, white); 
                                }
                                .read-more-btn { color: #4D90FE; cursor: pointer; font-size: 12px; margin-top: 5px; display: inline-block; font-weight: bold; }
                            </style>
                            <div id="original-notifications-wrapper" style="border: 1px solid #ddd; border-radius: 4px; padding: 5px; margin-bottom: 15px;">
                                ${cleanHTML(searchBox ? searchBox.outerHTML : '')}
                                <div id="notifications-scroll-area" style="max-height: 500px; overflow-y: auto; margin-top: 10px;">
                                    ${cleanHTML(tabsBox ? tabsBox.outerHTML : '')}
                                </div>
                            </div>
                        `;
                    }

                    const examParser = new DOMParser();
                    const examDoc = examParser.parseFromString(examPageHtml, 'text/html');
                    const examTable = examDoc.getElementById('TTKB_GridLT');
                    
                    if (examTable) {
                        examTable.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
                        finalHTML += `
                            <div class="GreyBoxCaption" style="margin-top: 20px; margin-bottom: 5px; font-weight: bold; color: #4D90FE;"> 
                                📅 Lịch thi cuối kỳ
                            </div>
                            <div class="GreyBox" style="padding: 5px;">
                                <div style="overflow-x: auto;">
                                    ${examTable.outerHTML}
                                </div>
                            </div>
                        `;
                    }

                    if (finalHTML) {
                        schedulesContainer.innerHTML = finalHTML;

                        const wrapper = document.getElementById('original-notifications-wrapper');
                        if (wrapper) {
                            wrapper.querySelectorAll('a[href^="download/"]').forEach(a => {
                                a.href = 'https://sv.dut.udn.vn/' + a.getAttribute('href');
                            });

                            const processContent = (container) => {
                                container.querySelectorAll('.tbBoxContent').forEach(content => {
                                    if (content.scrollHeight > 120 && !content.nextElementSibling?.classList.contains('read-more-btn')) {
                                        content.classList.add('collapsed');
                                        const btn = document.createElement('span');
                                        btn.className = 'read-more-btn';
                                        btn.textContent = 'Xem thêm...';
                                        btn.onclick = () => {
                                            content.classList.remove('collapsed');
                                            btn.remove();
                                        };
                                        content.parentNode.insertBefore(btn, content.nextSibling);
                                    }
                                });
                            };
                            processContent(wrapper);

                            if (typeof window.jQuery !== 'undefined' && window.jQuery.fn.tabs) {
                                const $tabs = window.jQuery("#tabs_PubTB");
                                
                                const loadTabData = (panel, index) => {
                                    panel.innerHTML = '<p style="padding: 15px; color: #666; font-style: italic;"> 🔄 Đang tải thông báo... </p>';
                                    fetch(`/WebAjax/evLopHP_Load.aspx?E=CTRTBSV&TAB=${index}`)
                                        .then(r => r.text())
                                        .then(html => {
                                            panel.innerHTML = html;
                                            panel.querySelectorAll('a[href^="download/"]').forEach(a => {
                                                a.href = 'https://sv.dut.udn.vn/' + a.getAttribute('href');
                                            });
                                            processContent(panel);
                                        })
                                        .catch(() => {
                                            panel.innerHTML = '<p style="padding: 15px; color: #d9534f;"> ⚠️ Không thể tải thông báo. </p>';
                                        });
                                };

                                try { $tabs.tabs("destroy"); } catch(e) {}
                                $tabs.tabs({
                                    activate: function(event, ui) {
                                        const panel = ui.newPanel[0];
                                        const index = ui.newTab.index();
                                        if (panel && !panel.getAttribute('data-loaded') && index !== 0) {
                                            panel.setAttribute('data-loaded', 'true');
                                            loadTabData(panel, index);
                                        }
                                    },
                                    create: function(event, ui) {
                                        const firstPanel = document.querySelector('#tabs_PubTB > div:first-of-type');
                                        if (firstPanel) firstPanel.setAttribute('data-loaded', 'true');
                                    }
                                });
                            }
                        }
                    } else {
                        schedulesContainer.innerHTML = '<p style="padding: 10px; color: #999;"> ℹ️ Không có thông báo mới hoặc lịch thi. </p>';
                    }
                })
                .catch(err => {
                    schedulesContainer.innerHTML = '<p style="padding: 10px; color: #d9534f;"> ⚠️ Lỗi khi tải dữ liệu lịch. </p>';
                    console.error('Error fetching schedules:', err);
                });
        }
    }

    // --- 5. GPA Calculator Logic ---
    if (url.includes('PageKetQuaHocTap.aspx')) {
        const table = document.querySelector('table.Grid, table#Grid1') || document.querySelector('table');
        if (table && !document.getElementById('gpa-dashboard-card')) {
            const headerRow = Array.from(table.rows).find(row => row.textContent.toLowerCase().includes('tín chỉ') || row.textContent.toLowerCase().includes('điểm chữ'));
            
            if (headerRow) {
                let creditColIdx = -1;
                let letterGradeColIdx = -1;
                let score10ColIdx = -1;

                Array.from(headerRow.cells).forEach((cell, idx) => {
                    const text = cell.textContent.trim().toLowerCase();
                    if (text === 'tc' || text.includes('tín chỉ')) creditColIdx = idx;
                    if (text === 'điểm chữ' || text === 'điểm tl') letterGradeColIdx = idx;
                    if (text === 'hệ 10' || text === 'điểm 10' || text === 'điểm') score10ColIdx = idx;
                });

                if (creditColIdx !== -1 && (letterGradeColIdx !== -1 || score10ColIdx !== -1)) {
                    let totalCredits = 0;
                    let totalGPA4Points = 0;
                    let totalGPA10Points = 0;
                    
                    // Variables for tracking semester stats
                    let currentSemester = null;
                    let semesters = []; // Array to store objects with {name, credits, gpa4Pts, gpa10Pts}

                    const gradeMap = {
                        'A+': 4.0, 'A': 4.0, 'B+': 3.5, 'B': 3.0, 'C+': 2.5, 'C': 2.0, 'D+': 1.5, 'D': 1.0, 'F': 0.0
                    };

                    Array.from(table.rows).slice(headerRow.rowIndex + 1).forEach(row => {
                        // Check if this row is a semester header (usually a single cell spanning multiple columns with text like "Học kỳ")
                        if (row.cells.length === 1 || (row.cells.length > 0 && row.cells[0].colSpan > 1)) {
                            const text = row.cells[0].textContent.trim();
                            if (text.toLowerCase().includes('học kỳ') || text.toLowerCase().includes('kỳ')) {
                                currentSemester = {
                                    name: text,
                                    credits: 0,
                                    gpa4Pts: 0,
                                    gpa10Pts: 0
                                };
                                semesters.push(currentSemester);
                                return;
                            }
                        }

                        if (row.cells.length <= Math.max(creditColIdx, letterGradeColIdx, score10ColIdx)) return;
                        
                        const creditsText = row.cells[creditColIdx].textContent.trim();
                        const credits = parseFloat(creditsText);
                        if (isNaN(credits) || credits === 0) return;

                        let gpa4 = null;
                        let gpa10 = null;

                        if (letterGradeColIdx !== -1) {
                            const letterGrade = row.cells[letterGradeColIdx].textContent.trim().toUpperCase();
                            if (gradeMap.hasOwnProperty(letterGrade)) {
                                gpa4 = gradeMap[letterGrade];
                            }
                        }

                        if (score10ColIdx !== -1) {
                            const score10Text = row.cells[score10ColIdx].textContent.trim();
                            const score10 = parseFloat(score10Text);
                            if (!isNaN(score10)) {
                                gpa10 = score10;
                                if (gpa4 === null) {
                                    if (score10 >= 8.5) gpa4 = 4.0;
                                    else if (score10 >= 8.0) gpa4 = 3.5;
                                    else if (score10 >= 7.0) gpa4 = 3.0;
                                    else if (score10 >= 6.5) gpa4 = 2.5;
                                    else if (score10 >= 5.5) gpa4 = 2.0;
                                    else if (score10 >= 5.0) gpa4 = 1.5;
                                    else if (score10 >= 4.0) gpa4 = 1.0;
                                    else gpa4 = 0.0;
                                }
                            }
                        }

                        if (gpa4 !== null) {
                            totalCredits += credits;
                            totalGPA4Points += (gpa4 * credits);
                            
                            if (currentSemester) {
                                currentSemester.credits += credits;
                                currentSemester.gpa4Pts += (gpa4 * credits);
                            }

                            if (gpa10 !== null) {
                                totalGPA10Points += (gpa10 * credits);
                                if (currentSemester) {
                                    currentSemester.gpa10Pts += (gpa10 * credits);
                                }
                            }
                        }
                    });

                    if (totalCredits > 0) {
                        const finalGPA4 = (totalGPA4Points / totalCredits).toFixed(2);
                        const finalGPA10 = totalGPA10Points > 0 ? (totalGPA10Points / totalCredits).toFixed(2) : 'N/A';
                        
                        // Find the most recent semester with credits
                        let lastActiveSemester = null;
                        for (let i = semesters.length - 1; i >= 0; i--) {
                            if (semesters[i].credits > 0) {
                                lastActiveSemester = semesters[i];
                                break;
                            }
                        }
                        
                        let semesterStatsHtml = '';
                        if (lastActiveSemester) {
                            const semGPA4 = (lastActiveSemester.gpa4Pts / lastActiveSemester.credits).toFixed(2);
                            const semGPA10 = lastActiveSemester.gpa10Pts > 0 ? (lastActiveSemester.gpa10Pts / lastActiveSemester.credits).toFixed(2) : 'N/A';
                            
                            semesterStatsHtml = `
                                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e3e8ee; display: flex; justify-content: space-around; width: 100%;">
                                    <div style="text-align: center; width: 100%;">
                                        <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Học kỳ gần nhất (${lastActiveSemester.name})</div>
                                        <div style="font-size: 16px; font-weight: 600; color: #4b5563;">
                                            Tín chỉ: ${lastActiveSemester.credits} &nbsp;|&nbsp; 
                                            GPA 4.0: <span style="color: #059669;">${semGPA4}</span> &nbsp;|&nbsp; 
                                            GPA 10.0: <span style="color: #2563eb;">${semGPA10 !== 'N/A' ? semGPA10 : '--'}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }

                        const dashboard = document.createElement('div');
                        dashboard.id = 'gpa-dashboard-card';
                        dashboard.className = 'GreyBox';
                        dashboard.style.marginBottom = '20px';
                        dashboard.style.padding = '15px';
                        dashboard.style.display = 'flex';
                        dashboard.style.justifyContent = 'space-around';
                        dashboard.style.alignItems = 'center';
                        dashboard.style.flexWrap = 'wrap';
                        dashboard.style.backgroundColor = '#f9fafc';
                        dashboard.style.border = '1px solid #e3e8ee';
                        dashboard.style.borderRadius = '8px';
                        dashboard.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';

                        const createStatBlock = (label, value, color) => `
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">${label}</div>
                                <div style="font-size: 24px; font-weight: 700; color: ${color};">${value}</div>
                            </div>
                        `;

                        dashboard.innerHTML = `
                            <div style="display: flex; justify-content: space-around; width: 100%;">
                                ${createStatBlock('Tổng tín chỉ', totalCredits, '#374151')}
                                ${createStatBlock('GPA Tích lũy 4.0', finalGPA4, '#059669')}
                                ${createStatBlock('GPA Tích lũy 10.0', finalGPA10 !== 'N/A' ? finalGPA10 : '--', '#2563eb')}
                            </div>
                            ${semesterStatsHtml}
                        `;

                        table.parentNode.insertBefore(dashboard, table);
                    }
                }
            }
        }
    }

    // --- 6. Export Schedule Logic ---
    if (url.includes('PageLichTH.aspx')) {
        const buttonContainer = document.querySelector('#TTKB_cboHocKy')?.parentElement;
        if (buttonContainer && !document.getElementById('export-calendar-btn')) {
            const wrapper = document.createElement('span');
            wrapper.style.marginLeft = '10px';
            wrapper.style.display = 'inline-flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '10px';

            wrapper.innerHTML = `
                <label style="font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" id="export-hoc-cb" checked> Lịch học
                </label>
                <label style="font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" id="export-thi-cb"> Lịch thi
                </label>
                <label style="font-size: 13px; display: flex; align-items: center; gap: 4px; border-left: 1px solid #ccc; padding-left: 10px; margin-left: 5px;">
                    Nhắc trước: 
                    <select id="export-reminder-select" style="font-size: 12px; cursor: pointer;">
                        <option value="none">Không</option>
                        ${[5,10,15,20,25,30,35,40,45,50,55,60].map(m => `<option value="${m}" ${m===30?'selected':''}>${m} phút</option>`).join('')}
                    </select>
                </label>
            `;

            const exportBtn = document.createElement('input');
            exportBtn.id = 'export-calendar-btn';
            exportBtn.type = 'button';
            exportBtn.value = 'Xuất Google Calendar';
            exportBtn.className = 'tmButton';
            exportBtn.style.padding = '4px 10px';
            exportBtn.onclick = () => exportScheduleToGoogleCalendar();

            wrapper.appendChild(exportBtn);
            buttonContainer.appendChild(wrapper);
        }
    }
}

// ==UserScript==
// @name         Enhancer for SVDUT
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.4.32
// @description  Trang web hỗ trợ sinh viên DUT (sv.dut.udn.vn) trở nên hiện đại và tiện lợi hơn.
// @author       hthienloc
// @match        https://sv.dut.udn.vn/*
// @match        http://lms.dut.udn.vn/*
// @match        https://lms.dut.udn.vn/*
// @match        https://wifi.dut.udn.vn/*
// @match        https://*.dut.navia.io.vn/*
// @match        https://gemini.google.com/app*
// @grant        GM_setClipboard
// @license      MIT
// @downloadURL  https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/academic/enhancer-for-svdut.user.js
// @updateURL    https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/academic/enhancer-for-svdut.user.js
// ==/UserScript==

(function() {
'use strict';
// src/sv.js
var PERIOD_TIMES = {
  1: { start: "07:00", end: "07:50" },
  2: { start: "08:00", end: "08:50" },
  3: { start: "09:00", end: "09:50" },
  4: { start: "10:00", end: "10:50" },
  5: { start: "11:00", end: "11:50" },
  6: { start: "12:30", end: "13:20" },
  7: { start: "13:30", end: "14:20" },
  8: { start: "14:30", end: "15:20" },
  9: { start: "15:30", end: "16:20" },
  10: { start: "16:30", end: "17:20" },
  11: { start: "17:30", end: "18:15" },
  12: { start: "18:15", end: "19:00" },
  13: { start: "19:10", end: "19:55" },
  14: { start: "19:55", end: "20:40" }
};
var DAY_OFFSET = {
  "Thứ 2": 0,
  "Thứ 3": 1,
  "Thứ 4": 2,
  "Thứ 5": 3,
  "Thứ 6": 4,
  "Thứ 7": 5,
  "Chủ nhật": 6
};
function combineDateAndTime(date, timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const newDate = new Date(date);
  newDate.setHours(h, m, 0, 0);
  return newDate;
}
function formatToICSDate(date) {
  return date.getFullYear().toString() + (date.getMonth() + 1).toString().padStart(2, "0") + date.getDate().toString().padStart(2, "0") + "T" + date.getHours().toString().padStart(2, "0") + date.getMinutes().toString().padStart(2, "0") + "00";
}
function downloadICS(data, reminderMinutes) {
  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DUT Enhancer//Schedule//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];
  data.forEach((event) => {
    icsContent.push("BEGIN:VEVENT");
    icsContent.push(`SUMMARY:${event.Subject}`);
    icsContent.push(`DTSTART:${formatToICSDate(event.Start)}`);
    icsContent.push(`DTEND:${formatToICSDate(event.End)}`);
    icsContent.push(`LOCATION:${event.Location}`);
    icsContent.push(`DESCRIPTION:${event.Description}`);
    if (reminderMinutes !== "none") {
      icsContent.push("BEGIN:VALARM");
      icsContent.push(`TRIGGER:-PT${reminderMinutes}M`);
      icsContent.push("ACTION:DISPLAY");
      icsContent.push("DESCRIPTION:Reminder");
      icsContent.push("END:VALARM");
    }
    icsContent.push("END:VEVENT");
  });
  icsContent.push("END:VCALENDAR");
  const blob = new Blob([icsContent.join(`\r
`)], { type: "text/calendar;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lich_hoc_dut.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    alert(`\uD83C\uDF89 Tải về thành công!

` + `Hướng dẫn nhập lịch vào Google Calendar:
` + `1. Vào Google Calendar, bấm vào icon Bánh răng -> Cài đặt.
` + `2. Chọn "Thêm lịch" -> "Tạo lịch mới".
` + `3. Nhập tên (ví dụ: Lịch học) và bấm "Tạo lịch".
` + `4. Sau khi tạo xong, vào mục "Nhập & xuất" -> "Nhập".
` + `5. Chọn file vừa tải về từ máy tính.
` + `6. Tại mục "Thêm vào lịch", hãy chọn tên lịch bạn vừa tạo.
` + '7. Bấm "Nhập" để hoàn tất.');
  }, 500);
}
function exportScheduleToGoogleCalendar() {
  const docAll = document;
  const isHocChecked = docAll.getElementById("export-hoc-cb")?.checked;
  const isThiChecked = docAll.getElementById("export-thi-cb")?.checked;
  const reminderVal = docAll.getElementById("export-reminder-select")?.value;
  const reminderMinutes = reminderVal === "none" ? "none" : parseInt(reminderVal) || 30;
  if (!isHocChecked && !isThiChecked) {
    alert("Vui lòng chọn ít nhất một nội dung để xuất!");
    return;
  }
  const week1StartStr = "2025-08-04";
  const week1Start = new Date(week1StartStr);
  if (isNaN(week1Start.getTime())) {
    alert("Ngày cấu hình không hợp lệ!");
    return;
  }
  const events = [];
  if (isHocChecked) {
    const classRows = document.querySelectorAll("#TTKB_GridInfo tr");
    classRows.forEach((row) => {
      const cells = row.cells;
      if (cells.length < 10 || row.classList.contains("kctHeader"))
        return;
      const subject = cells[2].innerText.trim();
      const lecturer = cells[6].innerText.trim();
      const scheduleRaw = cells[7].innerText.trim();
      const weeksRaw = cells[8].innerText.trim();
      if (!scheduleRaw || !weeksRaw)
        return;
      const scheduleParts = scheduleRaw.split(`
`).map((s) => s.trim()).filter((s) => s);
      scheduleParts.forEach((part) => {
        const pieces = part.split(",");
        if (pieces.length < 3)
          return;
        const dayStr = pieces[0].trim();
        const periodsStr = pieces[1].trim();
        const room = pieces[2].trim();
        const dayOff = DAY_OFFSET[dayStr];
        if (dayOff === undefined)
          return;
        const periods = periodsStr.split("-").map(Number);
        const startTimeStr = PERIOD_TIMES[periods[0]]?.start;
        const endTimeStr = PERIOD_TIMES[periods[periods.length - 1]]?.end;
        if (!startTimeStr || !endTimeStr)
          return;
        const weeks = [];
        weeksRaw.split(";").forEach((wRange) => {
          const parts = wRange.split("-").map(Number);
          if (parts.length === 2) {
            for (let i = parts[0];i <= parts[1]; i++)
              weeks.push(i);
          } else if (parts[0]) {
            weeks.push(parts[0]);
          }
        });
        weeks.forEach((weekNum) => {
          const eventDate = new Date(week1Start);
          eventDate.setDate(week1Start.getDate() + (weekNum - 1) * 7 + dayOff);
          events.push({
            Subject: `[Học] ${subject}`,
            Start: combineDateAndTime(eventDate, startTimeStr),
            End: combineDateAndTime(eventDate, endTimeStr),
            Description: `GV: ${lecturer}\\nTuần: ${weekNum}`,
            Location: room
          });
        });
      });
    });
  }
  if (isThiChecked) {
    const examRows = document.querySelectorAll("#TTKB_GridLT tr");
    examRows.forEach((row) => {
      const cells = row.cells;
      if (cells.length < 6 || row.classList.contains("kctHeader"))
        return;
      const subject = cells[2].innerText.trim();
      const examInfo = cells[5].innerText.trim();
      if (!examInfo)
        return;
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
        const endTime = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
        const cleanedInfo = examInfo.split(",").map((s) => s.trim()).filter((s) => !s.startsWith("Ngày:") && !s.startsWith("Giờ:")).join(", ");
        events.push({
          Subject: `[Thi] ${subject}`,
          Start: combineDateAndTime(eventDate, startTime),
          End: combineDateAndTime(eventDate, endTime),
          Description: cleanedInfo,
          Location: roomMatch ? roomMatch[1].trim() : ""
        });
      }
    });
  }
  if (events.length === 0) {
    alert("Không tìm thấy dữ liệu nào!");
    return;
  }
  downloadICS(events, reminderMinutes);
}
function handleSVPages(url, savedData) {
  if (url.includes("PageDangNhap.aspx")) {
    const accInput = document.getElementById("DN_txtAcc");
    const passInput = document.getElementById("DN_txtPass");
    const loginBtn = document.getElementById("QLTH_btnLogin");
    if (accInput && passInput && loginBtn && !document.getElementById("remember-me")) {
      const rememberRow = document.createElement("tr");
      rememberRow.innerHTML = `
                <td></td>
                <td colspan="2" style="text-align: left; padding: 5px 0 10px 0;">
                    <label style="cursor: pointer; font-size: 13px; color: #333;">
                        <input type="checkbox" id="remember-me" style="vertical-align: middle; margin-right: 5px;">
                        Ghi nhớ đăng nhập
                    </label>
                </td>
            `;
      const buttonRow = loginBtn.closest("tr");
      if (buttonRow && buttonRow.parentNode) {
        buttonRow.parentNode.insertBefore(rememberRow, buttonRow);
      }
      const rememberCb = document.getElementById("remember-me");
      if (savedData) {
        accInput.value = savedData.acc;
        passInput.value = savedData.pass;
        rememberCb.checked = true;
        if (url.includes("autologin=true")) {
          setTimeout(() => loginBtn.click(), 300);
        }
      }
      rememberCb.addEventListener("change", () => {
        if (!rememberCb.checked)
          localStorage.removeItem("savedLogin");
      });
      loginBtn.addEventListener("click", () => {
        if (rememberCb.checked) {
          localStorage.setItem("savedLogin", JSON.stringify({
            acc: accInput.value,
            pass: passInput.value
          }));
        } else {
          localStorage.removeItem("savedLogin");
        }
      });
      const saveHandler = (e) => {
        if (e.key === "Enter") {
          if (rememberCb.checked) {
            localStorage.setItem("savedLogin", JSON.stringify({
              acc: accInput.value,
              pass: passInput.value
            }));
          } else {
            localStorage.removeItem("savedLogin");
          }
        }
      };
      accInput.addEventListener("keypress", saveHandler);
      passInput.addEventListener("keypress", saveHandler);
    }
  }
  if (url.includes("PageCaNhan.aspx")) {
    const tabs = document.getElementById("tabs_LcSV");
    if (tabs && !document.getElementById("privacy-toggle-btn")) {
      tabs.style.display = "none";
      const btn = document.createElement("button");
      btn.id = "privacy-toggle-btn";
      btn.textContent = "\uD83D\uDC41️ Hiện thông tin cá nhân";
      btn.className = "tmButton";
      btn.type = "button";
      btn.style.display = "inline-block";
      btn.style.margin = "15px 0";
      btn.style.padding = "10px 20px";
      btn.style.cursor = "pointer";
      btn.style.fontSize = "14px";
      btn.style.lineHeight = "normal";
      btn.style.height = "auto";
      btn.style.boxSizing = "border-box";
      let isHidden = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        isHidden = !isHidden;
        tabs.style.display = isHidden ? "none" : "block";
        btn.textContent = isHidden ? "\uD83D\uDC41️ Hiện thông tin cá nhân" : "\uD83D\uDE48 Ẩn thông tin cá nhân";
      });
      tabs.parentNode.insertBefore(btn, tabs);
    }
    if (document.getElementById("schedules-container"))
      return;
    const schedulesContainer = document.createElement("div");
    schedulesContainer.id = "schedules-container";
    schedulesContainer.style.marginTop = "20px";
    schedulesContainer.innerHTML = '<p style="padding: 10px; color: #666; font-style: italic;"> \uD83D\uDD04 Đang tải thông báo và lịch thi... </p>';
    const targetParent = document.getElementById("tabs_LcSV") || document.querySelector(".pageBody");
    if (targetParent) {
      targetParent.parentNode.insertBefore(schedulesContainer, targetParent.nextSibling);
      const fetchHome = fetch("/Default.aspx").then((r) => r.text());
      const fetchExams = fetch("/PageLichTH.aspx").then((r) => r.text());
      Promise.all([fetchHome, fetchExams]).then(([homeHtml, examPageHtml]) => {
        let finalHTML = "";
        const homeParser = new DOMParser;
        const homeDoc = homeParser.parseFromString(homeHtml, "text/html");
        const searchBox = homeDoc.querySelector(".GreyBox:has(#MainContent_TB_btnFilter)");
        const tabsBox = homeDoc.getElementById("tabs_PubTB");
        if (searchBox || tabsBox) {
          const cleanHTML = (html) => html.replace(/ui-tabs-active|ui-state-active|ui-state-hover|ui-state-focus/g, "");
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
                                ${cleanHTML(searchBox ? searchBox.outerHTML : "")}
                                <div id="notifications-scroll-area" style="max-height: 500px; overflow-y: auto; margin-top: 10px;">
                                    ${cleanHTML(tabsBox ? tabsBox.outerHTML : "")}
                                </div>
                            </div>
                        `;
        }
        const examParser = new DOMParser;
        const examDoc = examParser.parseFromString(examPageHtml, "text/html");
        const examTable = examDoc.getElementById("TTKB_GridLT");
        if (examTable) {
          examTable.querySelectorAll("[onclick]").forEach((el) => el.removeAttribute("onclick"));
          finalHTML += `
                            <div class="GreyBoxCaption" style="margin-top: 20px; margin-bottom: 5px; font-weight: bold; color: #4D90FE;"> 
                                \uD83D\uDCC5 Lịch thi cuối kỳ
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
          const wrapper = document.getElementById("original-notifications-wrapper");
          if (wrapper) {
            wrapper.querySelectorAll('a[href^="download/"]').forEach((a) => {
              a.href = "https://sv.dut.udn.vn/" + a.getAttribute("href");
            });
            const processContent = (container) => {
              container.querySelectorAll(".tbBoxContent").forEach((content) => {
                if (content.scrollHeight > 120 && !content.nextElementSibling?.classList.contains("read-more-btn")) {
                  content.classList.add("collapsed");
                  const btn = document.createElement("span");
                  btn.className = "read-more-btn";
                  btn.textContent = "Xem thêm...";
                  btn.onclick = () => {
                    content.classList.remove("collapsed");
                    btn.remove();
                  };
                  content.parentNode.insertBefore(btn, content.nextSibling);
                }
              });
            };
            processContent(wrapper);
            if (typeof window.jQuery !== "undefined" && window.jQuery.fn.tabs) {
              const $tabs = window.jQuery("#tabs_PubTB");
              const loadTabData = (panel, index) => {
                panel.innerHTML = '<p style="padding: 15px; color: #666; font-style: italic;"> \uD83D\uDD04 Đang tải thông báo... </p>';
                fetch(`/WebAjax/evLopHP_Load.aspx?E=CTRTBSV&TAB=${index}`).then((r) => r.text()).then((html) => {
                  panel.innerHTML = html;
                  panel.querySelectorAll('a[href^="download/"]').forEach((a) => {
                    a.href = "https://sv.dut.udn.vn/" + a.getAttribute("href");
                  });
                  processContent(panel);
                }).catch(() => {
                  panel.innerHTML = '<p style="padding: 15px; color: #d9534f;"> ⚠️ Không thể tải thông báo. </p>';
                });
              };
              try {
                $tabs.tabs("destroy");
              } catch (e) {}
              $tabs.tabs({
                activate: function(event, ui) {
                  const panel = ui.newPanel[0];
                  const index = ui.newTab.index();
                  if (panel && !panel.getAttribute("data-loaded") && index !== 0) {
                    panel.setAttribute("data-loaded", "true");
                    loadTabData(panel, index);
                  }
                },
                create: function(event, ui) {
                  const firstPanel = document.querySelector("#tabs_PubTB > div:first-of-type");
                  if (firstPanel)
                    firstPanel.setAttribute("data-loaded", "true");
                }
              });
            }
          }
        } else {
          schedulesContainer.innerHTML = '<p style="padding: 10px; color: #999;"> ℹ️ Không có thông báo mới hoặc lịch thi. </p>';
        }
      }).catch((err) => {
        schedulesContainer.innerHTML = '<p style="padding: 10px; color: #d9534f;"> ⚠️ Lỗi khi tải dữ liệu lịch. </p>';
        console.error("Error fetching schedules:", err);
      });
    }
  }
  if (url.includes("PageLichTH.aspx")) {
    const buttonContainer = document.querySelector("#TTKB_cboHocKy")?.parentElement;
    if (buttonContainer && !document.getElementById("export-calendar-btn")) {
      const wrapper = document.createElement("span");
      wrapper.style.marginLeft = "10px";
      wrapper.style.display = "inline-flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "10px";
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
                        ${[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((m) => `<option value="${m}" ${m === 30 ? "selected" : ""}>${m} phút</option>`).join("")}
                    </select>
                </label>
            `;
      const exportBtn = document.createElement("input");
      exportBtn.id = "export-calendar-btn";
      exportBtn.type = "button";
      exportBtn.value = "Xuất Google Calendar";
      exportBtn.className = "tmButton";
      exportBtn.style.padding = "4px 10px";
      exportBtn.onclick = () => exportScheduleToGoogleCalendar();
      wrapper.appendChild(exportBtn);
      buttonContainer.appendChild(wrapper);
    }
  }
}

// src/utils.js
function sanitizeNode(node, imgMap = new Map, context = { inBold: false, inItalic: false }) {
  if (!node)
    return "";
  let md = "";
  const parentTag = node.tagName;
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (["TABLE", "TR", "THEAD", "TBODY"].includes(parentTag) && !child.textContent.trim())
        return;
      md += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.classList.contains("accesshide") || child.classList.contains("sr-only") || child.tagName === "SCRIPT" || child.tagName === "STYLE")
        return;
      const tagName = child.tagName;
      const isBlock = ["P", "DIV", "H1", "H2", "H3", "H4", "BR", "LI", "BLOCKQUOTE"].includes(tagName);
      if (isBlock)
        md += `
`;
      switch (tagName) {
        case "SUP":
          md += "^(" + sanitizeNode(child, imgMap, context).trim() + ")";
          break;
        case "SUB":
          md += "_(" + sanitizeNode(child, imgMap, context).trim() + ")";
          break;
        case "STRONG":
        case "B":
          if (context.inBold) {
            md += sanitizeNode(child, imgMap, context);
          } else {
            md += "**" + sanitizeNode(child, imgMap, { ...context, inBold: true }).trim() + "**";
          }
          break;
        case "EM":
        case "I":
          if (context.inItalic) {
            md += sanitizeNode(child, imgMap, context);
          } else {
            md += "*" + sanitizeNode(child, imgMap, { ...context, inItalic: true }).trim() + "*";
          }
          break;
        case "TABLE":
          md += `
` + sanitizeNode(child, imgMap, context).trim() + `
`;
          break;
        case "TR": {
          const rowContent = sanitizeNode(child, imgMap, context);
          md += `
|` + rowContent;
          const table = child.closest("table");
          const isFirstRow = table && child === table.querySelector("tr");
          if (isFirstRow) {
            const colCount = child.querySelectorAll("td, th").length;
            if (colCount > 0) {
              md += `
|` + Array(colCount).fill(" --- ").join("|") + "|";
            }
          }
          break;
        }
        case "TD":
        case "TH":
          const cellContent = sanitizeNode(child, imgMap, context).trim().replace(/\n+/g, "<br>");
          const innerHtml = child.innerHTML;
          md += " " + (cellContent || (innerHtml.includes("<img") ? cellContent : "<br>")) + " |";
          break;
        case "IMG": {
          const alt = child.getAttribute("alt")?.trim() || "";
          const src = child.src || child.getAttribute("src") || "";
          const finalSrc = imgMap.get(src) || src;
          if (finalSrc) {
            const inTable = ["TD", "TH"].includes(parentTag);
            if (inTable) {
              md += ` ![${alt || "image"}](${finalSrc}) `;
            } else {
              md += `

![${alt || "image"}](${finalSrc})

`;
            }
          }
          break;
        }
        default:
          md += sanitizeNode(child, imgMap, context);
      }
      if (isBlock && tagName !== "BR")
        md += `
`;
    }
  });
  return md;
}
function cleanText(input) {
  if (!input)
    return "";
  const text = typeof input === "string" ? input : input.innerText ?? input.textContent ?? "";
  return text.replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").replace(/■\s*/g, "- ").replace(/Mark [0-9.]+ out of [0-9.]+( bits)?\.?/gi, "").replace(/(Correct|Incorrect|Partially correct|Đúng|Sai|Đúng một phần)\.?/gi, "").replace(/(The\s+(?:correct\s+)?answers?\s+(?:is|are):|Câu\s+trả\s+lời\s+đúng\s+là:)\s*/gi, "").replace(/[ \t]*\n[ \t]*/g, `
`).replace(/\n{3,}/g, `

`).replace(/([a-z0-9\)_])\n([a-z0-9\(_])/gi, "$1 $2").trim();
}
async function convertImgToBase64(imgOrUrl) {
  const fetchAsBase64 = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader;
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Fetch conversion failed:", e);
      return url;
    }
  };
  if (imgOrUrl instanceof HTMLImageElement) {
    try {
      if (!imgOrUrl.complete || imgOrUrl.naturalWidth === 0) {
        await new Promise((resolve) => {
          const onDone = () => {
            imgOrUrl.removeEventListener("load", onDone);
            imgOrUrl.removeEventListener("error", onDone);
            resolve();
          };
          imgOrUrl.addEventListener("load", onDone);
          imgOrUrl.addEventListener("error", onDone);
          setTimeout(onDone, 3000);
        });
      }
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = imgOrUrl.naturalWidth || imgOrUrl.width;
      let height = imgOrUrl.naturalHeight || imgOrUrl.height;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      if (canvas.width > 0 && canvas.height > 0) {
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgOrUrl, 0, 0, width, height);
        return canvas.toDataURL("image/jpeg", 0.8);
      }
    } catch (e) {
      console.warn("Canvas conversion failed, falling back to fetch:", e);
    }
    return await fetchAsBase64(imgOrUrl.src);
  }
  return await fetchAsBase64(imgOrUrl);
}

// src/lms.js
async function autoAnswerCurrentQuestion(btn) {
  const queEl = document.querySelector(".que");
  if (!queEl) {
    alert("Không tìm thấy câu hỏi trên trang này.");
    btn.innerText = "\uD83E\uDD16 Ask Gemini";
    return;
  }
  const imgMap = new Map;
  const qImgs = Array.from(queEl.querySelectorAll("img"));
  await Promise.all(qImgs.map(async (img) => {
    const src = img.src;
    if (src && !imgMap.has(src) && !src.startsWith("data:")) {
      const b64 = await convertImgToBase64(img);
      imgMap.set(src, b64);
    }
  }));
  const qtextEl = queEl.querySelector(".qtext") || queEl.querySelector(".formulation") || queEl;
  let questionText = cleanText(sanitizeNode(qtextEl, imgMap));
  const targets = [];
  const promptParts = [];
  if (queEl.classList.contains("multichoice") || queEl.classList.contains("truefalse")) {
    const inputs = Array.from(queEl.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
    const options = inputs.map((input, i) => {
      const ariaId = input.getAttribute("aria-labelledby");
      const labelEl = (ariaId ? document.getElementById(ariaId) : null) || queEl.querySelector(`label[for="${input.id}"]`);
      const text = labelEl ? (labelEl.innerText || labelEl.textContent || "").trim() : "";
      return { index: i, text, el: input, type: input.type };
    }).filter((o) => o.text && o.el.value !== "-1");
    if (options.length === 0)
      return alert("Không tìm thấy đáp án.");
    const isMulti = options.some((o) => o.type === "checkbox");
    targets.push({ type: "choice", isMulti, options });
    const optsText = options.map((o) => `[${o.index}] ${o.text}`).join(`
`);
    promptParts.push(`Type: ${isMulti ? "Multiple choices (checkboxes)" : "Single choice (radio)"}`);
    promptParts.push(`Options:
${optsText}`);
    promptParts.push(`Format required: {"answers": ${isMulti ? "[index1, index2]" : "[index]"}}`);
  } else if (queEl.classList.contains("match")) {
    const rows = queEl.querySelectorAll("table.answer tr");
    const mapping = [];
    const exampleAnswers = {};
    rows.forEach((row, i) => {
      const textEl = row.querySelector(".text");
      const selectEl = row.querySelector("select");
      if (textEl && selectEl) {
        const rowText = (textEl.innerText || textEl.textContent).trim();
        const optionElements = Array.from(selectEl.querySelectorAll("option")).filter((o) => o.value && o.value !== "0");
        const optionsList = optionElements.map((opt, optIdx) => `[${optIdx}] ${opt.innerText.trim()}`).join("  |  ");
        mapping.push({ text: rowText, selectEl, optionElements });
        promptParts.push(`Input ${i}: ${rowText}`);
        promptParts.push(`  Options for Input ${i}: ${optionsList}`);
        exampleAnswers[i] = 0;
      }
    });
    if (mapping.length === 0)
      return alert("Không tìm thấy dropdown.");
    targets.push({ type: "match", mapping });
    promptParts.push(`Format required: {"answers": ${JSON.stringify(exampleAnswers)}}`);
  } else if (queEl.classList.contains("shortanswer") || queEl.classList.contains("numerical")) {
    const input = queEl.querySelector('input[type="text"]');
    if (input) {
      targets.push({ type: "text", el: input, id: 0 });
      promptParts.push(`Type: Text input`);
      promptParts.push(`Format required: {"answers": {"0": "exact text string to fill"}}`);
    } else {
      return alert("Không tìm thấy ô điền từ.");
    }
  } else if (queEl.classList.contains("multianswer")) {
    const inputs = queEl.querySelectorAll('input[type="text"], select');
    const mapping = [];
    const exampleAnswers = {};
    const formulation = queEl.querySelector(".formulation") || queEl.querySelector(".qtext") || queEl;
    const clone = formulation.cloneNode(true);
    const cloneInputs = clone.querySelectorAll('input[type="text"], select');
    inputs.forEach((el, i) => {
      if (el.tagName === "SELECT") {
        const optionElements = Array.from(el.querySelectorAll("option")).filter((o) => o.value && o.text.trim().toLowerCase() !== "choose...");
        const optionsList = optionElements.map((opt, optIdx) => `[${optIdx}] ${opt.innerText.trim()}`).join("  |  ");
        mapping.push({ type: "select", el, optionElements, id: i });
        promptParts.push(`Input ${i} (dropdown): ${optionsList}`);
        exampleAnswers[i] = 0;
      } else {
        mapping.push({ type: "text", el, id: i });
        promptParts.push(`Input ${i} (text): fill in the blank`);
        exampleAnswers[i] = "text";
      }
      if (cloneInputs[i]) {
        const placeholder = document.createTextNode(` [[Input ${i}]] `);
        cloneInputs[i].replaceWith(placeholder);
      }
    });
    clone.querySelectorAll(".feedback, .feedbackspan, .yui3-overlay, .icon, .grade, .state, .accesshide").forEach((el) => el.remove());
    questionText = cleanText(sanitizeNode(clone, imgMap));
    if (mapping.length === 0)
      return alert("Không tìm thấy ô input.");
    targets.push({ type: "cloze", mapping });
    promptParts.push(`Format required: {"answers": ${JSON.stringify(exampleAnswers)}}`);
  } else {
    alert(`Loại câu hỏi này (ví dụ: Drag & drop) chứa sự kiện phức tạp chưa hỗ trợ Auto-fill qua DOM.
Bạn có thể dùng Copy Markdown đề để Gemini giải thích rồi tự chọn tay nhé.`);
    btn.innerText = "\uD83E\uDD16 Ask Gemini";
    return;
  }
  const prompt_text = `You are a quiz assistant. strictly follow instructions. Return ONLY valid JSON, no markdown blocks, no explanations, just the literal string starting with { and ending with }.

` + `Question: ${questionText}

` + promptParts.join(`

`);
  if (typeof GM_setClipboard !== "undefined") {
    GM_setClipboard(prompt_text);
  } else {
    await navigator.clipboard.writeText(prompt_text);
  }
  if (!sessionStorage.getItem("svdut_gemini_opened")) {
    window.open("https://gemini.google.com/app", "_blank");
    sessionStorage.setItem("svdut_gemini_opened", "1");
  }
  const userResult = prompt(`✅ ĐÃ COPY CÂU HỎI VÀO CLIPBOARD!

` + `\uD83D\uDC49 Hãy qua tab Gemini dán (Ctrl+V).
` + `\uD83D\uDC49 Nó sẽ xuất ra 1 file JSON kiểu {"answers": ...}.
` + "\uD83D\uDC49 Copy chuỗi JSON đó dán vào đây để tự điền:");
  if (userResult) {
    try {
      const rawMatch = userResult.match(/\{[\s\S]*\}/);
      if (!rawMatch)
        throw new Error("No JSON found");
      const data = JSON.parse(rawMatch[0]);
      targets.forEach((target) => {
        if (target.type === "choice") {
          const arr = Array.isArray(data.answers) ? data.answers : data.answers !== undefined ? [data.answers] : [];
          if (target.isMulti) {
            target.options.forEach((o) => {
              if (o.el.checked)
                o.el.click();
            });
            arr.forEach((idx) => {
              if (target.options[idx])
                target.options[idx].el.click();
            });
          } else {
            arr.forEach((idx) => {
              if (target.options[idx])
                target.options[idx].el.click();
            });
          }
        } else if (target.type === "match") {
          target.mapping.forEach((m, i) => {
            const optIdx = data.answers && data.answers[String(i)];
            if (optIdx !== undefined && m.optionElements[optIdx]) {
              m.selectEl.value = m.optionElements[optIdx].value;
              m.selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
        } else if (target.type === "text") {
          const val = data.answers && data.answers[String(target.id)];
          if (val !== undefined) {
            target.el.value = val;
            target.el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (target.type === "cloze") {
          target.mapping.forEach((m) => {
            const val = data.answers && data.answers[String(m.id)];
            if (val !== undefined) {
              if (m.type === "select") {
                if (m.optionElements[val]) {
                  m.el.value = m.optionElements[val].value;
                  m.el.dispatchEvent(new Event("change", { bubbles: true }));
                }
              } else {
                m.el.value = val;
                m.el.dispatchEvent(new Event("change", { bubbles: true }));
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
  setTimeout(() => {
    btn.innerText = "\uD83E\uDD16 Ask Gemini";
  }, 3000);
}
async function extractQuiz(options = { includeAnswers: true, diagnose: false }) {
  const questions = document.querySelectorAll(".que");
  const imgMap = new Map;
  const allImgs = Array.from(document.querySelectorAll(".que img"));
  await Promise.all(allImgs.map(async (img) => {
    const src = img.src;
    if (src && !imgMap.has(src) && !src.startsWith("data:")) {
      const b64 = await convertImgToBase64(img);
      imgMap.set(src, b64);
    }
  }));
  let md = "";
  const isReview = !!document.querySelector(".quizreviewsummary") && options.includeAnswers;
  if (options.diagnose) {
    md += `# Quiz Diagnosis Report

I have some incorrect answers in my quiz. Please analyze each question, explain why my selected answer is wrong, and why the correct answer is right.

---

`;
  }
  questions.forEach((q, index) => {
    const isIncorrect = q.classList.contains("incorrect") || q.classList.contains("partiallycorrect");
    if (options.diagnose && !isIncorrect)
      return;
    const qno = q.querySelector(".qno")?.innerText?.trim() || index + 1;
    const formulationEl = q.querySelector(".formulation");
    let contentMd = "";
    if (formulationEl) {
      const clone = formulationEl.cloneNode(true);
      if (q.classList.contains("match")) {
        const qtext = clone.querySelector(".qtext");
        const introText = qtext ? cleanText(sanitizeNode(qtext, imgMap)) : "";
        contentMd = introText + `

`;
        const rightAnswerEl = q.querySelector(".rightanswer");
        const rightAnswerTextRaw = rightAnswerEl ? rightAnswerEl.innerText : "";
        const answerMap = new Map;
        if (isReview && rightAnswerTextRaw) {
          const pairs = rightAnswerTextRaw.split(/[,;\n]/);
          pairs.forEach((pair) => {
            const parts = pair.split(/->|→|:/);
            if (parts.length >= 2) {
              const key = parts[0].trim();
              const val = parts.slice(1).join(":").trim();
              answerMap.set(key, val);
            }
          });
        }
        const allOptions = new Set;
        q.querySelectorAll(".control select option").forEach((opt) => {
          const txt = opt.innerText.trim();
          if (txt && !txt.match(/Choose|Chọn/i))
            allOptions.add(txt);
        });
        let allMatched = isReview && answerMap.size > 0;
        q.querySelectorAll("table.answer tr").forEach((row) => {
          const itemContainer = row.querySelector(".text");
          const itemText = itemContainer ? cleanText(sanitizeNode(itemContainer, imgMap)) : "";
          if (!itemText)
            return;
          let displayAnswer = "__________";
          let userChoice = "";
          if (isReview) {
            const selectEl = row.querySelector("select");
            if (selectEl) {
              const selectedOpt = selectEl.querySelector("option[selected]");
              if (selectedOpt && !selectedOpt.innerText.match(/Choose|Chọn/i)) {
                userChoice = selectedOpt.innerText.trim();
              }
            }
            const matched = answerMap.get(itemText);
            if (matched) {
              displayAnswer = `**${matched}**`;
            } else {
              const cleanItem = itemText.replace(/\*\*/g, "").replace(/__/g, "").trim();
              for (const [key, val] of answerMap.entries()) {
                if (key.includes(cleanItem) || cleanItem.includes(key)) {
                  displayAnswer = `**${val}**`;
                  break;
                }
              }
            }
            if (displayAnswer === "__________")
              allMatched = false;
          }
          if (userChoice && userChoice !== displayAnswer.replace(/\*\*/g, "")) {
            contentMd += `- ${itemText} [ User Choice: ~~${userChoice}~~ | Correct: ${displayAnswer} ]
`;
          } else {
            contentMd += `- ${itemText} [ ${displayAnswer} ]
`;
          }
        });
        if (allOptions.size > 0 && !isReview) {
          contentMd += `
Options: ${Array.from(allOptions).join(", ")}
`;
        }
        if (isReview && rightAnswerEl && !allMatched) {
          const rightAnswerTextMd = cleanText(sanitizeNode(rightAnswerEl, imgMap));
          if (rightAnswerTextMd && (!rightAnswerTextMd.includes("->") && !rightAnswerTextMd.includes("→"))) {
            contentMd += `
> **${rightAnswerTextMd}**
`;
          }
        }
      } else if (q.classList.contains("multichoice") || q.classList.contains("truefalse")) {
        const qtext = clone.querySelector(".qtext");
        const introText = qtext ? cleanText(sanitizeNode(qtext, imgMap)) : "";
        contentMd = introText + `

`;
        const rightAnswerEl = q.querySelector(".rightanswer");
        const rightAnswerText = rightAnswerEl ? cleanText(sanitizeNode(rightAnswerEl, imgMap)) : "";
        const correctAnswers = isReview ? rightAnswerText.split(/[\n;]+/).map((s) => s.trim().toLowerCase()).filter((s) => !!s) : [];
        const choiceItems = [];
        const answerEl = q.querySelector(".answer");
        if (answerEl) {
          answerEl.querySelectorAll(":scope > div").forEach((choice) => {
            const el = choice.querySelector("label") || choice.querySelector('[data-region="answer-label"]');
            const input = choice.querySelector("input");
            if (el)
              choiceItems.push({ label: el, input, container: choice });
          });
        }
        choiceItems.forEach((item) => {
          let choiceText = cleanText(sanitizeNode(item.label, imgMap));
          if (!choiceText)
            return;
          const isSelected = item.input?.checked || item.container.classList.contains("selected");
          const isCorrect = isReview && correctAnswers.some((ans) => {
            const cleanChoice = choiceText.toLowerCase().replace(/^[a-z]\.\s+/i, "").trim();
            const cleanAns = ans.toLowerCase().replace(/^[a-z]\.\s+/i, "").trim();
            return cleanChoice.includes(cleanAns) || cleanAns.includes(cleanChoice);
          });
          let prefix = `[${isCorrect ? "x" : " "}]`;
          if (isSelected && !isCorrect) {
            prefix = `[!]`;
            choiceText = `~~${choiceText}~~ (My Choice)`;
          } else if (isSelected && isCorrect) {
            prefix = `[x]`;
            choiceText = `**${choiceText}** (Correct)`;
          } else if (!isSelected && isCorrect) {
            choiceText = `**${choiceText}** (Should have chosen)`;
          }
          contentMd += `- ${prefix} ${choiceText}
`;
        });
        if (isReview && rightAnswerText && !contentMd.includes("[x]")) {
          const lines = rightAnswerText.split(`
`).map((l) => l.trim()).filter((l) => !!l);
          if (lines.length > 0) {
            contentMd += `
> Correct answer: ` + lines.map((l) => `**${l}**`).join(`
> `) + `
`;
          }
        }
      } else {
        clone.querySelectorAll(".feedback, .feedbackspan, .yui3-overlay, .icon, .grade, .state, .accesshide").forEach((el) => el.remove());
        contentMd = cleanText(sanitizeNode(clone, imgMap));
        const rightAnswerEl = q.querySelector(".rightanswer");
        if (isReview && rightAnswerEl) {
          contentMd += `

> Correct Answer: **${cleanText(sanitizeNode(rightAnswerEl, imgMap))}**
`;
        }
      }
    }
    md += `### Câu hỏi ${qno}

${contentMd}

---

`;
  });
  return md;
}
function handleLMSPages(url, savedData) {
  const loginForm = document.getElementById("login");
  if (loginForm && (url.includes("/login/index.php") || url.includes("/login/"))) {
    const accInput = document.getElementById("username");
    const passInput = document.getElementById("password");
    const loginBtn = document.getElementById("loginbtn");
    if (accInput && passInput && loginBtn && !document.getElementById("remember-me-lms")) {
      const rememberDiv = document.createElement("div");
      rememberDiv.className = "rememberpass mt-2 mb-2";
      rememberDiv.innerHTML = `
                <label style="cursor: pointer; font-size: 14px; color: #333;">
                    <input type="checkbox" id="remember-me-lms" style="vertical-align: middle; margin-right: 5px;">
                    Ghi nhớ đăng nhập (Enhancer)
                </label>
            `;
      loginBtn.parentNode.insertBefore(rememberDiv, loginBtn);
      const rememberCb = document.getElementById("remember-me-lms");
      if (savedData) {
        accInput.value = savedData.acc;
        passInput.value = savedData.pass;
        rememberCb.checked = true;
        if (url.includes("autologin=true")) {
          setTimeout(() => loginBtn.click(), 500);
        }
      }
      loginForm.addEventListener("submit", () => {
        if (rememberCb.checked) {
          localStorage.setItem("savedLoginLMS", JSON.stringify({
            acc: accInput.value,
            pass: passInput.value
          }));
        } else {
          localStorage.removeItem("savedLoginLMS");
        }
      });
    }
  }
  const lmsLoginLink = document.querySelector('.login a[href*="/login/index.php"]');
  if (lmsLoginLink && savedData) {
    if (!lmsLoginLink.href.includes("autologin=true")) {
      lmsLoginLink.href += (lmsLoginLink.href.includes("?") ? "&" : "?") + "autologin=true";
    }
  }
  if (url.includes("/mod/quiz/")) {
    const addMarkdownButtons = () => {
      if (document.getElementById("markdown-buttons-container"))
        return true;
      const navBlock = document.getElementById("mod_quiz_navblock");
      const prevBtn = document.querySelector(".mod_quiz-prev-nav");
      const nextBtn = document.querySelector(".mod_quiz-next-nav");
      const reviewSummary = document.querySelector(".quizreviewsummary");
      const summaryTable = document.querySelector(".quizsummaryofattempt");
      const targetBtn = navBlock || prevBtn || nextBtn || reviewSummary || summaryTable;
      if (!targetBtn)
        return false;
      const container = document.createElement("div");
      container.id = "markdown-buttons-container";
      if (navBlock) {
        container.className = "block block_fake card mb-3";
        container.innerHTML = `
                    <div class="card-body p-3">
                        <h5 class="card-title d-inline">Enhancer Tools</h5>
                        <div class="card-text content mt-3" id="enhancer-buttons-inner"></div>
                    </div>
                `;
      } else {
        container.style.display = "inline-block";
        container.style.marginRight = "8px";
      }
      const buttonTarget = container.querySelector("#enhancer-buttons-inner") || container;
      const createCopyButton = (id, text, options) => {
        const btn = document.createElement("button");
        btn.id = id;
        btn.innerText = text;
        btn.className = "btn btn-secondary";
        btn.style.marginRight = "8px";
        btn.style.marginBottom = "8px";
        if (navBlock)
          btn.style.width = "100%";
        btn.onclick = async (e) => {
          e.preventDefault();
          const originalText = btn.innerText;
          btn.innerText = "Extracting...";
          try {
            const md = await extractQuiz(options);
            if (!md.trim()) {
              alert("Không tìm thấy nội dung câu hỏi để xuất!");
              btn.innerText = originalText;
              return;
            }
            const copyToClipboard = async (text2) => {
              if (typeof GM_setClipboard !== "undefined") {
                GM_setClipboard(text2);
                return true;
              } else {
                return navigator.clipboard.writeText(text2);
              }
            };
            try {
              await copyToClipboard(md);
              btn.innerText = "Copied ✓";
              setTimeout(() => btn.innerText = text, 1500);
            } catch (err) {
              console.error("Failed to copy: ", err);
              alert("Lỗi khi copy vào clipboard: " + err);
              btn.innerText = originalText;
            }
          } catch (err) {
            console.error("Quiz export failed: ", err);
            alert("Lỗi khi xuất Markdown: " + err);
            btn.innerText = originalText;
          }
        };
        return btn;
      };
      const copyBtn = createCopyButton("copy-markdown-btn", "\uD83D\uDCCB Copy Markdown đề bài", { includeAnswers: false });
      const copyAnswerBtn = createCopyButton("copy-answer-btn", "\uD83D\uDCCB Copy Markdown đáp án", { includeAnswers: true });
      const diagnoseBtn = createCopyButton("diagnose-btn", "\uD83E\uDE7A Giải thích câu sai (AI)", { includeAnswers: true, diagnose: true });
      diagnoseBtn.className = "btn btn-danger";
      diagnoseBtn.style.marginRight = "8px";
      diagnoseBtn.style.marginBottom = "8px";
      if (navBlock)
        diagnoseBtn.style.width = "100%";
      diagnoseBtn.title = "Trích xuất các câu sai và nhờ AI giải thích";
      const originalDiagnoseClick = diagnoseBtn.onclick;
      diagnoseBtn.onclick = async (e) => {
        await originalDiagnoseClick(e);
        if (!sessionStorage.getItem("svdut_gemini_opened")) {
          window.open("https://gemini.google.com/app", "_blank");
          sessionStorage.setItem("svdut_gemini_opened", "1");
        }
      };
      const downloadBtn = document.createElement("button");
      downloadBtn.id = "download-markdown-btn";
      downloadBtn.innerText = "\uD83D\uDCE5 Tải file Markdown (.md)";
      downloadBtn.className = "btn btn-info";
      downloadBtn.style.marginBottom = "8px";
      if (navBlock) {
        downloadBtn.style.width = "100%";
        downloadBtn.style.marginRight = "8px";
      }
      downloadBtn.onclick = async (e) => {
        e.preventDefault();
        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = "⌛ Đang chuẩn bị...";
        try {
          const md = await extractQuiz({ includeAnswers: true });
          if (!md.trim()) {
            alert("Không tìm thấy nội dung câu hỏi để xuất!");
            downloadBtn.innerText = originalText;
            return;
          }
          const blob = new Blob([md], { type: "text/markdown" });
          const url2 = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url2;
          let filename = `quiz_export_${new Date().getTime()}`;
          try {
            const breadcrumbs = Array.from(document.querySelectorAll(".breadcrumb-item")).map((item) => item.textContent.trim());
            if (breadcrumbs.length > 0) {
              const quizName = breadcrumbs[breadcrumbs.length - 1];
              const courseLink = document.querySelector('.breadcrumb-item a[title="Course"]') || document.querySelector('.breadcrumb-item a[title="Khóa học"]');
              let courseName = "";
              if (courseLink) {
                courseName = courseLink.textContent.trim();
              } else if (breadcrumbs.length >= 3) {
                courseName = breadcrumbs[2];
              }
              if (courseName && quizName) {
                filename = `${courseName} ${quizName}`;
              } else if (quizName) {
                filename = quizName;
              }
            }
            filename = filename.replace(/[\/\\:*?"<>|\[\]]/g, "").replace(/\s+/g, "_").trim();
          } catch (e2) {
            console.error("Error extracting filename:", e2);
          }
          a.download = `${filename}.md`;
          a.click();
          URL.revokeObjectURL(url2);
          downloadBtn.innerText = "✅ Đã tải xong";
          setTimeout(() => downloadBtn.innerText = "\uD83D\uDCE5 Tải file Markdown (.md)", 1500);
        } catch (err) {
          console.error("Download failed: ", err);
          alert("Lỗi khi tải file: " + err);
          downloadBtn.innerText = originalText;
        }
      };
      const geminiBtn = document.createElement("button");
      geminiBtn.id = "ask-gemini-btn";
      geminiBtn.innerText = "\uD83E\uDD16 Hỏi Gemini (AI)";
      geminiBtn.className = "btn btn-warning";
      geminiBtn.style.marginBottom = "8px";
      if (navBlock) {
        geminiBtn.style.width = "100%";
      } else {
        geminiBtn.style.marginLeft = "8px";
      }
      geminiBtn.title = "Nhờ Gemini AI trả lời câu hỏi hiện tại";
      geminiBtn.onclick = async (e) => {
        e.preventDefault();
        geminiBtn.disabled = true;
        try {
          await autoAnswerCurrentQuestion(geminiBtn);
        } finally {
          geminiBtn.disabled = false;
        }
      };
      const isAttempt = window.location.href.includes("attempt.php");
      const isReview = window.location.href.includes("review.php");
      buttonTarget.appendChild(geminiBtn);
      if (isReview) {
        buttonTarget.appendChild(diagnoseBtn);
      }
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
      return true;
    };
    const injectTimer = setInterval(() => {
      if (addMarkdownButtons())
        clearInterval(injectTimer);
    }, 1000);
    setTimeout(() => clearInterval(injectTimer), 1e4);
  }
  if (url.includes("/mod/quiz/summary.php")) {
    const addSummaryButtons = () => {
      if (document.getElementById("summary-view-all-btn"))
        return true;
      const container = document.querySelector(".submitbtns.mdl-align");
      if (!container)
        return false;
      const controls = container.querySelector(".controls");
      if (!controls)
        return false;
      const btn = document.createElement("button");
      btn.id = "summary-view-all-btn";
      btn.innerText = "\uD83D\uDD0D Xem tất cả câu hỏi (Enhancer)";
      const navBlock = document.getElementById("mod_quiz_navblock");
      if (navBlock) {
        btn.className = "btn btn-primary mb-2 w-100";
      } else {
        btn.className = "btn btn-primary ml-2";
      }
      btn.onclick = async (e) => {
        e.preventDefault();
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "⌛ Đang tải câu hỏi...";
        try {
          await showAllQuestionsOnSummary();
          btn.innerText = "✅ Đã tải xong";
        } catch (err) {
          console.error("Failed to load questions:", err);
          alert("Lỗi khi tải câu hỏi: " + err);
          btn.innerText = originalText;
          btn.disabled = false;
        }
      };
      controls.appendChild(btn);
      return true;
    };
    const injectTimer = setInterval(() => {
      if (addSummaryButtons())
        clearInterval(injectTimer);
    }, 1000);
    setTimeout(() => clearInterval(injectTimer), 1e4);
  }
}
async function showAllQuestionsOnSummary() {
  const summaryTable = document.querySelector(".quizsummaryofattempt");
  if (!summaryTable)
    throw new Error("Không tìm thấy bảng tổng kết.");
  const links = Array.from(summaryTable.querySelectorAll('a[href*="attempt.php"]'));
  if (links.length === 0)
    throw new Error("Không tìm thấy liên kết đến các câu hỏi.");
  const pages = new Set;
  links.forEach((link) => {
    const url = new URL(link.href);
    url.hash = "";
    pages.add(url.toString());
  });
  let questionsContainer = document.getElementById("all-questions-container");
  if (!questionsContainer) {
    questionsContainer = document.createElement("div");
    questionsContainer.id = "all-questions-container";
    questionsContainer.style.marginTop = "30px";
    questionsContainer.style.padding = "20px";
    questionsContainer.style.borderTop = "2px solid #eee";
    questionsContainer.innerHTML = '<h3 class="mb-4">Nội dung câu hỏi</h3>';
    const parent = summaryTable.closest("#region-main") || summaryTable.parentNode;
    parent.appendChild(questionsContainer);
  }
  for (const pageUrl of pages) {
    const resp = await fetch(pageUrl);
    const html = await resp.text();
    const parser = new DOMParser;
    const doc = parser.parseFromString(html, "text/html");
    const questions = doc.querySelectorAll(".que");
    questions.forEach((q) => {
      const clone = document.importNode(q, true);
      clone.querySelectorAll(".questionflag, .grade, .state, .accesshide").forEach((el) => el.remove());
      questionsContainer.appendChild(clone);
    });
  }
}

// src/wifi.js
function handleWifiPages(url) {
  if (url.includes("wifi.dut.udn.vn") || url.includes("dut.navia.io.vn")) {
    const loginBtn = document.querySelector('a.hero__left__button[href="/login"]');
    if (loginBtn) {
      console.log("[DUT Portal] Auto-clicking MS login...");
      loginBtn.click();
    }
  }
}

// src/gemini.js
function handleGeminiPages() {
  console.log("[Enhancer] Gemini auto-copy enabled.");
  const processedTexts = new Set;
  const observer = new MutationObserver((mutations) => {
    const targets = document.querySelectorAll('model-response, .message-content, [data-message-author-role="assistant"]');
    targets.forEach((target) => {
      const content = (target.innerText || target.textContent || "").trim();
      if (!content || content.length < 20)
        return;
      const jsonMatch = content.match(/\{[\s\S]*?"answers"[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        if (processedTexts.has(jsonStr))
          return;
        try {
          JSON.parse(jsonStr);
          if (typeof GM_setClipboard !== "undefined") {
            GM_setClipboard(jsonStr);
          } else {
            navigator.clipboard.writeText(jsonStr);
          }
          console.log("[Enhancer] Detected JSON and copied to clipboard:", jsonStr);
          processedTexts.add(jsonStr);
          showCopyToast();
        } catch (e) {}
      }
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
function showCopyToast() {
  let toast = document.getElementById("svdut-copy-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "svdut-copy-toast";
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: sans-serif;
            font-weight: bold;
            transition: opacity 0.3s;
        `;
    document.body.appendChild(toast);
  }
  toast.innerText = "✅ Đã tự động copy đáp án!";
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}

// src/index.js
var style = document.createElement("style");
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
  const logo = document.querySelector(".logoBox");
  if (logo) {
    logo.style.cursor = "pointer";
    logo.title = "Đi tới trang chủ DUT (dut.udn.vn)";
    logo.addEventListener("click", () => window.open("https://dut.udn.vn/", "_blank"));
  }
  const savedData = JSON.parse(localStorage.getItem("savedLogin") || "null");
  const loginLink = document.getElementById("linkDangNhap");
  if (loginLink && savedData) {
    if (!loginLink.href.includes("autologin=true")) {
      loginLink.href = "PageDangNhap.aspx?autologin=true";
    }
  }
  if (url.includes("sv.dut.udn.vn")) {
    handleSVPages(url, savedData);
  } else if (url.includes("lms.dut.udn.vn")) {
    const lmsSavedData = JSON.parse(localStorage.getItem("savedLoginLMS") || "null");
    handleLMSPages(url, lmsSavedData);
  } else if (url.includes("wifi.dut.udn.vn")) {
    handleWifiPages(url);
  } else if (url.includes("gemini.google.com")) {
    handleGeminiPages();
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

})();
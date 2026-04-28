export function sanitizeNode(node, imgMap = new Map(), context = { inBold: false, inItalic: false }) {
    if (!node) return '';
    let md = '';
    const parentTag = node.tagName;
    node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
            // Skip vertical whitespace between table elements to prevent breaking rows
            if (['TABLE', 'TR', 'THEAD', 'TBODY'].includes(parentTag) && !child.textContent.trim()) return;
            md += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.classList.contains('accesshide') ||
                child.classList.contains('sr-only') ||
                child.tagName === 'SCRIPT' ||
                child.tagName === 'STYLE') return;

            const tagName = child.tagName;
            const isBlock = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BR', 'LI', 'BLOCKQUOTE'].includes(tagName);

            if (isBlock) md += '\n';

            switch (tagName) {
                case 'SUP': md += '^(' + sanitizeNode(child, imgMap, context).trim() + ')'; break;
                case 'SUB': md += '_(' + sanitizeNode(child, imgMap, context).trim() + ')'; break;
                case 'STRONG':
                case 'B': 
                    if (context.inBold) {
                        md += sanitizeNode(child, imgMap, context);
                    } else {
                        md += '**' + sanitizeNode(child, imgMap, { ...context, inBold: true }).trim() + '**';
                    }
                    break;
                case 'EM':
                case 'I': 
                    if (context.inItalic) {
                        md += sanitizeNode(child, imgMap, context);
                    } else {
                        md += '*' + sanitizeNode(child, imgMap, { ...context, inItalic: true }).trim() + '*';
                    }
                    break;
                case 'TABLE':
                    md += '\n' + sanitizeNode(child, imgMap, context).trim() + '\n';
                    break;
                case 'TR': {
                    const rowContent = sanitizeNode(child, imgMap, context);
                    md += '\n|' + rowContent;
                    
                    // Add separator if it's the first row of the table
                    const table = child.closest('table');
                    const isFirstRow = table && child === table.querySelector('tr');
                    
                    if (isFirstRow) {
                        const colCount = child.querySelectorAll('td, th').length;
                        if (colCount > 0) {
                            md += '\n|' + Array(colCount).fill(' --- ').join('|') + '|';
                        }
                    }
                    break;
                }
                case 'TD':
                case 'TH':
                    const cellContent = sanitizeNode(child, imgMap, context).trim().replace(/\n+/g, '<br>');
                    const innerHtml = child.innerHTML;
                    // Preserve images in table cells
                    md += ' ' + (cellContent || (innerHtml.includes('<img') ? cellContent : '<br>')) + ' |';
                    break;
                case 'IMG': {
                    const alt = child.getAttribute('alt')?.trim() || '';
                    const src = child.src || child.getAttribute('src') || '';
                    const finalSrc = imgMap.get(src) || src;

                    if (finalSrc) {
                        const inTable = ['TD', 'TH'].includes(parentTag);
                        if (inTable) {
                            md += ` ![${alt || 'image'}](${finalSrc}) `;
                        } else {
                            // Standard Markdown image with double newlines for compatibility
                            md += `\n\n![${alt || 'image'}](${finalSrc})\n\n`;
                        }
                    }
                    break;
                }
                default: md += sanitizeNode(child, imgMap, context);
            }

            if (isBlock && tagName !== 'BR') md += '\n';
        }
    });
    return md;
}

export function cleanText(input) {
    if (!input) return '';
    const text = (typeof input === 'string') ? input : (input.innerText ?? input.textContent ?? '');
    return text
        .replace(/\u00A0/g, ' ')           // No-break space to space
        .replace(/[ \t]+/g, ' ')           // Collapse horizontal whitespace
        .replace(/■\s*/g, '- ')            // Bullet point icon to markdown
        .replace(/Mark [0-9.]+ out of [0-9.]+( bits)?\.?/gi, '') // Remove score info
        .replace(/(Correct|Incorrect|Partially correct|Đúng|Sai|Đúng một phần)\.?/gi, '') // Remove status labels anywhere
        .replace(/(The\s+(?:correct\s+)?answers?\s+(?:is|are):|Câu\s+trả\s+lời\s+đúng\s+là:)\s*/gi, '') // Remove answer prefix
        .replace(/[ \t]*\n[ \t]*/g, '\n') // Trim horizontal whitespace around newlines
        .replace(/\n{3,}/g, '\n\n')      // Collapse 3+ newlines to 2
        .replace(/([a-z0-9\)_])\n([a-z0-9\(_])/gi, '$1 $2') // Rejoin accidental line breaks
        .trim();
}

export async function convertImgToBase64(imgOrUrl) {
    const fetchAsBase64 = async (url) => {
        try {
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(url);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('Fetch conversion failed:', e);
            return url;
        }
    };

    if (imgOrUrl instanceof HTMLImageElement) {
        try {
            if (!imgOrUrl.complete || imgOrUrl.naturalWidth === 0) {
                await new Promise((resolve) => {
                    const onDone = () => {
                        imgOrUrl.removeEventListener('load', onDone);
                        imgOrUrl.removeEventListener('error', onDone);
                        resolve();
                    };
                    imgOrUrl.addEventListener('load', onDone);
                    imgOrUrl.addEventListener('error', onDone);
                    setTimeout(onDone, 3000); 
                });
            }

            const canvas = document.createElement('canvas');
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
                const ctx = canvas.getContext('2d');
                // Fill with white background to prevent transparent PNGs from becoming black in JPEG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(imgOrUrl, 0, 0, width, height);
                // Use JPEG with 0.8 quality to drastically reduce base64 length
                return canvas.toDataURL('image/jpeg', 0.85);
            }
        } catch (e) {
            console.warn('Canvas conversion failed, falling back to fetch:', e);
        }
        return await fetchAsBase64(imgOrUrl.src);
    }

    return await fetchAsBase64(imgOrUrl);
}

import fs from 'fs';
import path from 'path';

// Scan scripts directory
const scriptsDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'scripts');
const scripts = [];

function scanDir(dir, category) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            scanDir(fullPath, item.name);
        } else if (item.name.endsWith('.user.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');

            // Extract UserScript metadata
            const match = content.match(/\/\/ ==UserScript==\s*([\s\S]*?)\/\/ ==\/UserScript==/);
            if (!match) continue;

            const metadata = {};
            const lines = match[1].split('\n');
            for (const line of lines) {
                const keyMatch = line.match(/\/\/\s*@(\w+)\s+(.*)/);
                if (keyMatch) {
                    const key = keyMatch[1];
                    const value = keyMatch[2].trim();
                    if (key === 'match') {
                        if (!metadata.match) metadata.match = [];
                        metadata.match.push(value);
                    } else {
                        metadata[key] = value;
                    }
                }
            }

            // Determine icon
            let icon = `https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/assets/icons/${path.basename(metadata.name || '').toLowerCase().replace(/\s+/g, '-')}.svg`;
            if (metadata.icon) {
                icon = metadata.icon;
            }

            scripts.push({
                name: metadata.name || path.basename(item.name, '.user.js'),
                description: metadata.description || '',
                url: `scripts/${category}/${item.name}`,
                icon: icon,
                tags: [category, ...(metadata.match || []).map(m => m.replace('*://*/*', 'all').replace(/\./g, ''))]
            });
        }
    }
}

// Scan all categories
const categories = fs.readdirSync(scriptsDir, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name);

for (const cat of categories) {
    scanDir(path.join(scriptsDir, cat), cat);
}

// Update index.html
const indexPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Replace scripts array
const scriptsJson = JSON.stringify(scripts, null, 12);
html = html.replace(
    /const scripts = \[[\s\S]*?\];/,
    `const scripts = ${scriptsJson};`
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Updated index.html with ${scripts.length} scripts`);

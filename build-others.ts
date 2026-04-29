import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const scriptsToSync = [
  { name: "Facebook Affiliate Filter", src: "src/social/filter-fb-affiliate/index.js", dist: "scripts/social/filter-fb-affiliate.user.js" },
  { name: "SoundCloud Downloader", src: "src/media/soundcloud-downloader/index.js", dist: "scripts/media/soundcloud-downloader.user.js" },
  { name: "YouTube Navigator", src: "src/media/youtube-navigator/index.js", dist: "scripts/media/youtube-navigator.user.js" },
  { name: "Jules Helper", src: "src/productivity/jules-helper/index.js", dist: "scripts/productivity/jules-helper.user.js" },
  { name: "Facebook Chess Move Classifier", src: "src/social/fb-chess-classifier/index.js", dist: "scripts/social/fb-chess-classifier.user.js" },
  { name: "Gemini Prompt Pro", src: "src/productivity/gemini-prompt-pro/index.js", dist: "scripts/productivity/gemini-prompt-pro.user.js" },
  { name: "Void Scroll", src: "src/productivity/void-scroll/index.js", dist: "scripts/productivity/void-scroll.user.js" },
  { name: "Gemini Explainer", src: "src/productivity/gemini-explainer/index.js", dist: "scripts/productivity/gemini-explainer.user.js" },
  { name: "Anti-Toxic", src: "src/social/anti-toxic/index.js", dist: "scripts/social/anti-toxic.user.js" }
];

function bumpVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length === 3) {
    parts[2]++; // Bump patch version
    return parts.join('.');
  }
  return version + '.1';
}

function getCoreContent(content: string): string {
  // Remove version line to compare actual code changes
  return content.replace(/\/\/ @version\s+.*/, "");
}

console.log("🚀 Starting build & auto-bump process...");

for (const script of scriptsToSync) {
  if (!existsSync(script.src)) {
    console.warn(`⚠️ Source not found: ${script.src}`);
    continue;
  }

  const srcContent = readFileSync(script.src, "utf8");
  let finalContent = srcContent;

  if (existsSync(script.dist)) {
    const distContent = readFileSync(script.dist, "utf8");
    
    if (getCoreContent(srcContent) !== getCoreContent(distContent)) {
      console.log(`✨ Changes detected in [${script.name}]`);
      
      const versionMatch = srcContent.match(/\/\/ @version\s+([\d.]+)/);
      if (versionMatch) {
        const oldVersion = versionMatch[1];
        const newVersion = bumpVersion(oldVersion);
        // Replace ONLY the version number part of the specific @version line
        finalContent = srcContent.replace(
          /(\/\/ @version\s+)[\d.]+/,
          `$1${newVersion}`
        );
        
        // Update the source file with new version
        writeFileSync(script.src, finalContent);
        console.log(`📈 Bumped version: ${oldVersion} -> ${newVersion}`);
      }
    }
  }

  // Ensure directory exists
  const distDir = join(...script.dist.split("/").slice(0, -1));
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  writeFileSync(script.dist, finalContent);
  console.log(`✅ Synced: ${script.dist}`);
}

console.log("🎉 Build complete!");

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const scriptsToSync = [
  { src: "src/social/filter-fb-affiliate/index.js", dist: "scripts/social/filter-fb-affiliate.user.js" },
  { src: "src/media/soundcloud-downloader/index.js", dist: "scripts/media/soundcloud-downloader.user.js" },
  { src: "src/productivity/jules-helper/index.js", dist: "scripts/productivity/jules-helper.user.js" }
];

console.log("🚀 Syncing single-file userscripts...");

for (const script of scriptsToSync) {
  const distDir = join(...script.dist.split("/").slice(0, -1));
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }
  
  try {
    copyFileSync(script.src, script.dist);
    console.log(`✅ Synced: ${script.dist}`);
  } catch (e) {
    console.error(`❌ Failed to sync ${script.src}:`, e.message);
  }
}

console.log("🎉 All scripts updated!");

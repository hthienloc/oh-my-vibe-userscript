import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function bumpVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length === 3) {
    parts[2]++;
    return parts.join('.');
  }
  return version + '.1';
}

async function build() {
  console.log("🚀 Starting build for Enhancer for SVDUT...");

  const result = await Bun.build({
    entrypoints: ["src/index.js"],
    target: "browser",
    minify: false,
  });

  if (!result.success) {
    console.error("❌ Build failed");
    process.exit(1);
  }

  const bundledCode = await result.outputs[0].text();
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  let version = pkg.version;

  // Path to the central output
  const outputDir = join("..", "..", "..", "scripts", "academic");
  const outputPath = join(outputDir, "enhancer-for-svdut.user.js");

  // Auto-bump detection
  if (existsSync(outputPath)) {
    const existingContent = readFileSync(outputPath, "utf8");
    // Extract code only (after 'use strict';)
    const existingCode = existingContent.split("'use strict';")[1]?.split("})();")[0]?.trim();
    
    if (existingCode && bundledCode.trim() !== existingCode) {
      console.log("✨ Changes detected in Enhancer for SVDUT source");
      const oldVersion = version;
      version = bumpVersion(oldVersion);
      
      // Update package.json
      pkg.version = version;
      writeFileSync("package.json", JSON.stringify(pkg, null, 2));
      console.log(`📈 Bumped version: ${oldVersion} -> ${version}`);
    }
  }

  let header = readFileSync("src/header.js", "utf8");
  header = header.replace(/@version\s+[\d.]+/, `@version      ${version}`);

  const finalCode = `${header}\n(function() {\n'use strict';\n${bundledCode}\n})();`;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  writeFileSync(outputPath, finalCode);
  console.log(`✅ Build complete: ${outputPath} (v${version})`);
}

build();

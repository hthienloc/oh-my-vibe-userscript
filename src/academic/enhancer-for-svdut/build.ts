import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function build() {
  console.log("🚀 Starting build for Enhancer for SVDUT...");

  const result = await Bun.build({
    entrypoints: ["src/index.js"],
    target: "browser",
    minify: false,
  });

  if (!result.success) {
    console.error("❌ Build failed");
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  // Read package.json version
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const version = pkg.version;
  console.log(`📦 Version: ${version}`);

  let header = readFileSync("src/header.js", "utf8");
  
  // Overwrite @version in header
  header = header.replace(/@version\s+[\d.]+/, `@version      ${version}`);

  const bundledCode = await result.outputs[0].text();

  // Combine header and code, with IIFE wrapper for the bundle
  const finalCode = `${header}\n(function() {\n'use strict';\n${bundledCode}\n})();`;

  // Output to the central scripts directory
  const outputDir = join("..", "..", "..", "scripts", "academic");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = join(outputDir, "enhancer-for-svdut.user.js");
  writeFileSync(outputPath, finalCode);
  console.log(`✅ Build complete: ${outputPath}`);
}

build();

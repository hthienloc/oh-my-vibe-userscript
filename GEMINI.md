# 🤖 Gemini / AI Agent Guidelines: oh-my-vibe-userscript

Welcome! You are operating as an expert userscript developer and maintainer for the **oh-my-vibe-userscript** monorepo. This document provides the necessary context, architectural rules, and workflows to help you navigate and contribute effectively to this codebase.

## 🎯 Project Overview
This repository is a centralized monorepo for curated, high-performance userscripts designed to enhance web productivity and academic workflows. It uses **Bun** as the primary package manager and build orchestrator.

## 📂 Architecture & Structure
- **`src/`**: The single source of truth for all userscript source code. It is categorized into domains:
  - `academic/` - Education-related scripts (e.g., SVDUT enhancer).
  - `social/` - Social media and content enhancements (e.g., Facebook, YouTube).
  - `productivity/` - Development and workflow tools (e.g., Gemini prompts, Jules helper).
- **`scripts/`**: The built and distributed `.user.js` files. **DO NOT edit these directly.**
- **`build-others.ts`**: A custom build script that synchronizes changes from `src/` to `scripts/` and automatically bumps the `@version` patch number if code changes are detected.
- **`package.json`**: Contains the build scripts (`build:svdut`, `build:others`, `build`).

## 🛠️ Tech Stack & Conventions
- **Language**: Vanilla JavaScript / TypeScript. Keep it clean, lightweight, and performant.
- **Userscript Engine**: Target Tampermonkey / Greasemonkey APIs.
- **Headers**: Every script in `src/` must have a proper UserScript header block containing `@name`, `@namespace`, `@version`, `@description`, `@author`, `@match`, `@grant`, etc.
- **UI Injections**:
  - Use vanilla DOM APIs (`document.createElement`, `querySelector`).
  - Isolate CSS styles (e.g., inject a `<style>` block with unique IDs/classes to avoid CSS bleeding).
  - Use `MutationObserver` responsibly for injecting UI elements into SPAs (Single Page Applications) without impacting page performance.
- **No Dependencies**: Prefer zero-dependency Vanilla JS unless absolutely necessary.

## 🔄 Development Workflow
When tasked with creating a new script or updating an existing one:

1. **Locate or Create Source**: Always work within the `src/<category>/<script-name>/` directory. Modify `index.js` or `index.ts`.
2. **Implement Changes**: Ensure code is robust against website updates (use flexible CSS selectors or robust XPath).
3. **Build & Sync**: 
   - Run `npm run build` or `bun run build` to synchronize the changes to the `scripts/` directory.
   - The `build-others.ts` script will automatically detect the difference, bump the `@version` patch number in your `src/` file, and output the final version to `scripts/`.
4. **Testing Context**: Remember that the user tests the script from the `scripts/` directory using their userscript manager.

## 🚨 AI Rules of Engagement
- **Never modify `scripts/*.user.js` directly.** Always target the files in `src/`.
- **Match existing patterns**: Follow the established code structure (IIFE wrappers, clear function definitions, separated style injection, minimal DOM queries).
- **Avoid Over-engineering**: Userscripts should be fast and unintrusive. Favor simplicity over complex abstractions.
- **Error Handling**: Fail gracefully. If a target website's DOM changes, the script shouldn't break the entire page. Use `try...catch` blocks and optional chaining (`?.`).
- **Commits**: Follow conventional commits (`feat:`, `fix:`, `refactor:`, etc.) and ensure the auto-pull hook is respected.

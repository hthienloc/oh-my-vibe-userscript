# Userscript Collection 🛡️

A centralized monorepo containing curated, high-performance userscripts designed to enhance web productivity and academic workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/hthienloc/oh-my-vibe-userscript/actions/workflows/build.yml/badge.svg)](https://github.com/hthienloc/oh-my-vibe-userscript/actions/workflows/build.yml)

## Project Overview

This repository serves as a personal hub for various userscripts. By utilizing a monorepo architecture, we ensure consistent coding standards, shared build logic, and synchronized versioning across all distributed components.

## 📦 Core Components

### 🏠 Academic Suite
- **Enhancer for SVDUT**: A comprehensive tool for the DUT (Da Nang University of Technology) student portal. 
  - *Features*: Automated WiFi portal login, exam schedule synchronization to Google Calendar, and AI-powered quiz diagnostic reporting.
  - [Install Component](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/academic/enhancer-for-svdut.user.js)

### 📱 Social & Content Tools
- **Facebook Affiliate Filter**: A security-focused script to maintain a clean feed by automatically detecting and hiding affiliate spam and promotional comments.
  - [Install Component](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/social/filter-fb-affiliate.user.js)
- **SoundCloud Media Downloader**: Extracts high-fidelity audio with full embedded ID3 metadata (covers, artists, titles) directly within the browser.
  - [Install Component](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/media/soundcloud-downloader.user.js)

### 🛠️ Developer Productivity
- **Jules Bridge Helper**: A bi-directional synchronization bridge between Jules AI and the Gemini web interface.
  - *Requirement*: Requires the [Python Relay Server](./src/productivity/jules-helper/server/relay_server.py) to be active.
  - [Install Component](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/jules-helper.user.js)

## 🏗️ Architecture & Development

This project uses a modern build system powered by **Bun** to manage modular source code and distribute production-ready userscripts.

### Repository Structure
```text
.
├── src/               # Modular Source Code
│   ├── academic/      # Education-related scripts
│   ├── social/        # Social media and content enhancements
│   └── productivity/  # Development and workflow tools
├── scripts/           # Built and Distributed Userscripts
└── build.ts           # Unified Build Orchestrator
```

### Build & Maintenance
To contribute or build from source:

1.  **Clone & Install**: `bun install`
2.  **Synchronize**: `npm run build` (This automatically bumps patch versions if changes are detected in `src/`).
3.  **Local Testing**: Point your userscript manager to the files in the `scripts/` directory.

## ⚖️ License

Distributed under the MIT License. Copyright © 2025 **hthienloc**.

---
*Maintained with transparency and code integrity in mind.*

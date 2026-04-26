# Vibecode Userscripts 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Scripts Count](https://img.shields.io/badge/scripts-5-orange.svg)]()

**Vibecode Userscripts** is a curated collection of high-quality userscripts, meticulously crafted in the **Vibecode** style to optimize user experience and boost productivity for developers and casual web users alike.

## ✨ Available Scripts

### 🏠 Academic / University (sv.dut.udn.vn)

- **Enhancer for SVDUT**: Modernizes the DUT (Da Nang University of Technology) student portal. Includes features like automatic WiFi login, exam schedule management, and AI-assisted quiz solving.
  - [Install Now](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/academic/enhancer-for-svdut.user.js)

### 📱 Social Media (Facebook)

- **Facebook Affiliate Comment Filter**: Automatically detects and hides spam comments containing Shopee/Lazada affiliate links or promotional keywords.
  - [Install Now](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/social/filter-fb-affiliate.user.js)
- **Do Mixi Gemini**: A specialized utility for the MixiGaming community.
  - [Install Now](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/social/do-mixi-gemini.user.js)

### 🎵 Media / Downloaders

- **SoundCloud Downloader**: Download high-quality tracks directly from SoundCloud with full ID3 metadata (Title, Artist, Album Art).
  - [Install Now](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/media/soundcloud-downloader.user.js)

### 🛠️ Productivity / Development

- **Jules Helper**: A bi-directional bridge between Jules AI and Gemini, enabling seamless message syncing and rapid response approval.
  - [Install Userscript](https://github.com/hthienloc/oh-my-vibe-userscript/raw/main/scripts/productivity/jules-helper.user.js)
  - **Note**: Requires the local relay server to be running via `npm run jules-bridge` for syncing features.

## 🚀 General Installation

1. Install a userscript manager: **[Tampermonkey](https://www.tampermonkey.net/)**.
2. Browse the scripts above and click the corresponding **Install Now** link.
3. Click **Install** in the window that appears.

## 🛠️ Development

All scripts in this collection follow clean code standards, focus on high performance, and are regularly maintained.

### Project Structure

```text
.
├── src/            # Source code (Monorepo)
├── scripts/        # Distributed .user.js files (Auto-generated)
│   ├── academic/   # Education & University scripts
│   ├── social/     # Social media enhancements
│   ├── media/      # Media downloaders & tools
│   └── productivity/# Dev tools & productivity boosters
├── build.ts        # Central build orchestrator
└── README.md
```

### Build Commands

```bash
# Install dependencies
bun install

# Build all scripts
npm run build

# Run Jules Helper relay server
npm run jules-bridge
```

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Developed by **hthienloc**.

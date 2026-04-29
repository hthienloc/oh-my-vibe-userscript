// ==UserScript==
// @name         SoundCloud Downloader
// @namespace    https://github.com/hthienloc/oh-my-vibe-userscript
// @version      1.3.5
// @description  Download SoundCloud tracks with embedded ID3 metadata (title, artist, album, cover art) locally.
// @author       hthienloc (based on maple3142)
// @match        https://soundcloud.com/*
// @require      https://cdn.jsdelivr.net/npm/browser-id3-writer@4.0.0/dist/browser-id3-writer.min.js
// @grant        none
// @license      MIT
// @icon         https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico
// @updateURL    https://raw.githubusercontent.com/hthienloc/oh-my-vibe-userscript/main/scripts/media/soundcloud-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/hthienloc/oh-my-vibe-userscript/main/scripts/media/soundcloud-downloader.user.js
// ==/UserScript==

/* jshint esversion: 8 */

/**
 * Intercepts method calls on an object.
 * @param {Object} obj The object containing the method.
 * @param {string} name The method name to hook.
 * @param {Function} callback The hook callback.
 * @param {string} type Hook execution timing: 'before' or 'after'.
 * @returns {Function} Function to remove the hook.
 */
function hook(obj, name, callback, type) {
    const fn = obj[name];
    if (typeof fn !== "function") return () => {};
    obj[name] = function (...args) {
        if (type === "before") callback.apply(this, args);
        const result = fn.apply(this, args);
        if (type === "after") callback.apply(this, args);
        return result;
    };
    return () => {
        obj[name] = fn;
    };
}

/**
 * Triggers a file download given a URL and filename.
 * @param {string} url Data URL or object URL.
 * @param {string} name Desired filename.
 */
function triggerDownload(url, name) {
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = url;
    a.download = name;
    a.click();
    a.remove();
}

const btn = {
    init() {
        this.el = document.createElement("button");
        this.el.textContent = "Download";
        this.el.classList.add("sc-button");
        this.el.classList.add("sc-button-medium");
        this.el.classList.add("sc-button-icon");
        this.el.classList.add("sc-button-responsive");
        this.el.classList.add("sc-button-secondary");
        this.el.classList.add("sc-button-download");
    },
    cb() {
        // Try playlist header first (Standard for Album/Playlist/System pages)
        let header = document.querySelector(".systemPlaylistDetails__controls");
        if (header) {
            // Check if already attached
            if (header.contains(this.el)) return;

            const wrapper = document.createElement("div");
            wrapper.className = "systemPlaylistDetails__button";
            wrapper.appendChild(this.el);

            // Try to find "Add to Next up" to insert after it
            const nextUp = header.querySelector(".addToNextUp");
            if (nextUp && nextUp.parentElement && nextUp.parentElement.parentElement === header) {
                nextUp.parentElement.insertAdjacentElement("afterend", wrapper);
            } else {
                header.appendChild(wrapper);
            }
            return;
        }

        // Try standard track button group (Standard for Track pages)
        let par = document.querySelector(".sc-button-toolbar .sc-button-group");
        if (par && this.el.parentElement !== par) {
            par.insertAdjacentElement("beforeend", this.el);
        }
    },
    attach() {
        this.detach();
        this.observer = new MutationObserver(this.cb.bind(this));
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.cb();
    },
    detach() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        // If attached via wrapper, remove the wrapper too
        if (this.el.parentElement && this.el.parentElement.classList.contains("systemPlaylistDetails__button")) {
            this.el.parentElement.remove();
        } else if (this.el.parentElement) {
            this.el.remove();
        }
    }
};

/**
 * Hooks network requests to discover SoundCloud's Client ID.
 * @returns {Promise<string>}
 */
function getClientId() {
    return new Promise((resolve) => {
        let resolved = false;
        const check = (url) => {
            if (resolved) return true;
            try {
                const u = new URL(url, document.baseURI);
                const clientId = u.searchParams.get("client_id");
                if (clientId) {
                    console.log("Found clientId:", clientId);
                    resolved = true;
                    cleanup();
                    resolve(clientId);
                    return true;
                }
            } catch (e) {}
            return false;
        };

        const unhookXhr = hook(XMLHttpRequest.prototype, "open", function (method, url) {
            check(url);
        }, "after");

        const unhookFetch = hook(window, "fetch", function (input) {
            const url = typeof input === "string" ? input : (input && input.url);
            if (url) check(url);
        }, "before");

        const cleanup = () => {
            unhookXhr();
            unhookFetch();
            if (observer) observer.disconnect();
        };

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.tagName === "SCRIPT" && node.src) check(node.src);
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        for (const s of document.scripts) {
            if (s.src && check(s.src)) break;
        }
    });
}

const clientIdPromise = getClientId();
let controller = null;

/**
 * Finds the highest quality artwork URL for a track.
 * @param {Object} track
 * @returns {string|null}
 */
function artworkBestUrl(track) {
    let art = track.artwork_url || (track.user && track.user.avatar_url) || null;
    if (
        !art &&
        track.publisher_metadata &&
        track.publisher_metadata.artwork &&
        track.publisher_metadata.artwork.url
    ) {
        art = track.publisher_metadata.artwork.url;
    }
    if (!art) return null;
    return art.replace("-large", "-t1080x1080").replace("-crop", "-t1080x1080");
}

/**
 * Fetches data as ArrayBuffer with optional progress callback.
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @param {Function} [onProgress]
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchArrayBuffer(url, signal, onProgress) {
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error("Fetch failed: " + resp.status);

    if (!onProgress) return resp.arrayBuffer();

    const contentLength = +resp.headers.get("Content-Length");
    if (!contentLength) return resp.arrayBuffer();

    let loaded = 0;
    const reader = resp.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onProgress(Math.round((loaded / contentLength) * 100));
    }

    const allChunks = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        allChunks.set(chunk, offset);
        offset += chunk.length;
    }

    return allChunks.buffer;
}

/**
 * Downloads a single track and applies ID3 tags.
 * @param {Object} track
 * @param {string} clientId
 * @param {Function} onProgress
 */
async function downloadTrack(track, clientId, onProgress) {
    try {
        const progressive =
            track.media &&
            track.media.transcodings &&
            track.media.transcodings.find(
                (t) => t.format && t.format.protocol === "progressive"
            );
        if (!progressive) {
            console.warn("Track unsupported:", track.title);
            return;
        }
        const { url } = await fetch(
            progressive.url + `?client_id=${clientId}`
        ).then((r) => r.json());
        const audioBuf = await fetchArrayBuffer(url, null, onProgress);
        let coverBuf = null;
        const artUrl = artworkBestUrl(track);
        if (artUrl) {
            try {
                coverBuf = await fetchArrayBuffer(artUrl);
            } catch (e) {
                console.warn("cover fetch failed", e);
                coverBuf = null;
            }
        }

        let filename = (track.title || "track").trim().replace(/\.(mp3|wav|flac|ogg|m4a)$/i, "") + ".mp3";
        filename = filename.replace(/[\/\\?%*:|"<>]/g, "_");

        let taggedBlob = null;
        try {
            const writer = new ID3Writer(audioBuf);
            if (track.title) writer.setFrame("TIT2", track.title);
            if (track.user && track.user.username)
                writer.setFrame("TPE1", [track.user.username]);
            if (
                track.publisher_metadata &&
                track.publisher_metadata.album_title
            ) {
                writer.setFrame("TALB", track.publisher_metadata.album_title);
            }
            if (coverBuf) {
                let mime = "image/jpeg";
                const dv = new Uint8Array(coverBuf);
                if (dv[0] === 0x89 && dv[1] === 0x50 && dv[2] === 0x4e)
                    mime = "image/png";
                writer.setFrame("APIC", {
                    type: 3,
                    data: coverBuf,
                    description: "Cover",
                    mime: mime
                });
            }
            writer.addTag();
            taggedBlob = writer.getBlob();
        } catch (e) {
            console.warn("ID3 tagging failed, falling back to raw file", e);
            taggedBlob = new Blob([audioBuf], { type: "audio/mpeg" });
        }

        const urlObj = URL.createObjectURL(taggedBlob);
        triggerDownload(urlObj, filename);
        setTimeout(() => URL.revokeObjectURL(urlObj), 60 * 1000);

    } catch (err) {
        console.error("Download failed", track.title, err);
    }
}

/**
 * Triggers loading logic based on current SoundCloud URL.
 * @param {string} by Context identifier (e.g., 'init', 'pushState')
 */
async function load(by) {
    btn.detach();
    if (
        /^(\/(you|stations|stream|upload|search|settings))/.test(
            location.pathname
        ) && !location.pathname.includes("/sets/")
    )
        return;
    const clientId = await clientIdPromise;
    if (controller) {
        controller.abort();
        controller = null;
    }
    controller = new AbortController();
    
    let result = null;
    try {
        result = await fetch(
            `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
                location.href
            )}&client_id=${clientId}`,
            { signal: controller.signal }
        ).then((r) => r.json());
    } catch (e) {}

    if (result && result.kind === "track") {
        btn.el.textContent = "Download";
        btn.el.onclick = async () => {
            btn.el.textContent = "Downloading... (0%)";
            btn.el.disabled = true;
            await downloadTrack(result, clientId, (percent) => {
                btn.el.textContent = `Downloading... (${percent}%)`;
            });
            btn.el.textContent = "Download";
            btn.el.disabled = false;
        };
        btn.attach();
    } else if (result && (result.kind === "playlist" || result.kind === "album")) {
        btn.el.textContent = "Download Album";
        btn.el.onclick = async () => {
             console.log("Album download not fully implemented in this version wrapper");
        };
        btn.attach();
    }
}

/**
 * Initializes listeners and UI components.
 */
function init() {
    btn.init();
    load("init");
    hook(history, "pushState", () => load("pushState"), "after");
    window.addEventListener("popstate", () => load("popstate"));
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

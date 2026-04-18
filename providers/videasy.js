"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function normalizePlaybackHeaders(headers) {
      if (!headers || typeof headers !== "object") return headers;
      const normalized = {};
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "user-agent") normalized["User-Agent"] = value;
        else if (lowerKey === "referer" || lowerKey === "referrer") normalized["Referer"] = value;
        else if (lowerKey === "origin") normalized["Origin"] = value;
        else if (lowerKey === "accept") normalized["Accept"] = value;
        else if (lowerKey === "accept-language") normalized["Accept-Language"] = value;
        else normalized[key] = value;
      }
      return normalized;
    }
    function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints) {
      const text = [
        stream?.url,
        stream?.name,
        stream?.title,
        stream?.server,
        providerName
      ].filter(Boolean).join(" ").toLowerCase();
      if (text.includes("mixdrop") || text.includes("m1xdrop") || text.includes("mxcontent")) {
        return true;
      }
      if (text.includes("loadm") || text.includes("loadm.cam")) {
        return true;
      }
      return false;
    }
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F44C} FHD";
      else if (quality === "720p") quality = "\u26A1 HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "Unknow";
      let title = `\u{1F4C1} ${stream.title || "Stream"}`;
      let language = stream.language;
      if (!language) {
        if (stream.name && (stream.name.includes("SUB ITA") || stream.name.includes("SUB"))) language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
        else if (stream.title && (stream.title.includes("SUB ITA") || stream.title.includes("SUB"))) language = "\u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
        else language = "\u{1F1EE}\u{1F1F9}";
      }
      let details = [];
      if (stream.size) details.push(`\u{1F4E6} ${stream.size}`);
      const desc = details.join(" | ");
      let pName = stream.name || stream.server || providerName;
      if (pName) {
        pName = pName.replace(/\s*\[?\(?\s*SUB\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*SUB\s*\)?\]?/i, "").replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "").trim();
      }
      if (pName === providerName) {
        pName = pName.charAt(0).toUpperCase() + pName.slice(1);
      }
      if (pName) {
        pName = `\u2699\uFE0F ${pName}`;
      }
      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? { ...stream.behaviorHints } : {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      finalHeaders = normalizePlaybackHeaders(finalHeaders);
      const isStreamingCommunityProvider = String(providerName || "").toLowerCase() === "streamingcommunity" || String(stream?.name || "").toLowerCase().includes("streamingcommunity");
      if (isStreamingCommunityProvider && !finalHeaders) {
        delete behaviorHints.proxyHeaders;
        delete behaviorHints.headers;
        delete behaviorHints.notWebReady;
      }
      if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
      }
      const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, providerName, finalHeaders, behaviorHints);
      if (!isStreamingCommunityProvider && shouldForceNotWebReady) {
        behaviorHints.notWebReady = true;
      } else {
        delete behaviorHints.notWebReady;
      }
      const finalName = pName;
      let finalTitle = `\u{1F4C1} ${stream.title || "Stream"}`;
      if (desc) finalTitle += ` | ${desc}`;
      if (language) finalTitle += ` | ${language}`;
      return {
        ...stream,
        // Keep original properties
        name: finalName,
        title: finalTitle,
        // Metadata for Stremio UI reconstruction (safer names for RN)
        providerName: pName,
        qualityTag: quality,
        description: desc,
        originalTitle: stream.title || "Stream",
        // Ensure language is set for Stremio/Nuvio sorting
        language,
        // Mark as formatted
        _nuvio_formatted: true,
        behaviorHints,
        // Explicitly ensure root headers are preserved for Nuvio
        headers: finalHeaders
      };
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT2 = 12e3;
    var CONTEXT_TIMEOUT = 2500;
    function createTimeoutSignal2(timeoutMs) {
      const parsed = Number.parseInt(String(timeoutMs), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { signal: void 0, cleanup: null, timed: false };
      }
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
      }
      if (typeof AbortController !== "undefined" && typeof setTimeout === "function") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, parsed);
        return {
          signal: controller.signal,
          cleanup: () => clearTimeout(timeoutId),
          timed: true
        };
      }
      return { signal: void 0, cleanup: null, timed: false };
    }
    async function fetchWithTimeout(url, options = {}) {
      if (typeof fetch === "undefined") {
        throw new Error("No fetch implementation found!");
      }
      const { timeout, ...fetchOptions } = options;
      const requestTimeout = timeout || FETCH_TIMEOUT2;
      const timeoutConfig = createTimeoutSignal2(requestTimeout);
      const requestOptions = { ...fetchOptions };
      if (timeoutConfig.signal) {
        if (requestOptions.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
          requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
        } else if (!requestOptions.signal) {
          requestOptions.signal = timeoutConfig.signal;
        }
      }
      try {
        const response = await fetch(url, requestOptions);
        return response;
      } catch (error) {
        if (error && error.name === "AbortError" && timeoutConfig.timed) {
          throw new Error(`Request to ${url} timed out after ${requestTimeout}ms`);
        }
        throw error;
      } finally {
        if (typeof timeoutConfig.cleanup === "function") {
          timeoutConfig.cleanup();
        }
      }
    }
    module2.exports = { fetchWithTimeout, createTimeoutSignal: createTimeoutSignal2, FETCH_TIMEOUT: FETCH_TIMEOUT2, CONTEXT_TIMEOUT };
  }
});

// src/videasy/index.js
var cheerio = require("cheerio");
var { formatStream } = require_formatter();
var { createTimeoutSignal, fetchWithHeaders } = require_fetch_helper();
function getVideasyBaseUrl() {
  return "https://player.videasy.net";
}
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
var FETCH_TIMEOUT = 15e3;
async function getStreams(id, type, season = 1, episode = 1) {
  try {
    const typeStr = String(type || "").toLowerCase();
    const mediaType = typeStr === "movie" ? "movie" : typeStr === "anime" ? "anime" : "tv";
    let url;
    if (mediaType === "movie") {
      url = `${getVideasyBaseUrl()}/movie/${id}`;
    } else if (mediaType === "anime") {
      url = `${getVideasyBaseUrl()}/anime/${id}/${episode || 1}`;
    } else {
      url = `${getVideasyBaseUrl()}/tv/${id}/${season || 1}/${episode || 1}`;
    }
    const signal = createTimeoutSignal(FETCH_TIMEOUT);
    const response = await fetchWithHeaders(url, {
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
        "Referer": getVideasyBaseUrl()
      }
    });
    if (!response || !response.ok) {
      console.error("[Videasy] Fetch failed:", response?.status);
      return [];
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const streams = [];
    const iframe = $("iframe");
    if (iframe.length > 0) {
      const src = iframe.attr("src");
      if (src) {
        streams.push({
          title: "Videasy Player",
          url: src,
          name: "Videasy",
          quality: "auto",
          language: "it"
        });
      }
    }
    const videoJsPlayer = $("video-js, .video-player, .player-container");
    if (videoJsPlayer.length > 0) {
      const sources = videoJsPlayer.find("source");
      sources.each((_, el) => {
        const src = $(el).attr("src");
        const quality = $(el).attr("data-quality") || $(el).attr("label") || "auto";
        if (src) {
          streams.push({
            title: "Videasy Video",
            url: src,
            name: "Videasy",
            quality: String(quality).toLowerCase().includes("1080") ? "1080p" : String(quality).toLowerCase().includes("720") ? "720p" : String(quality).toLowerCase().includes("480") ? "480p" : "auto",
            language: "it"
          });
        }
      });
    }
    const scriptTags = $("script");
    scriptTags.each((_, el) => {
      const scriptContent = $(el).html() || "";
      const m3u8Match = scriptContent.match(/(?:src|source|file|url)[^"'#]*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
      if (m3u8Match) {
        streams.push({
          title: "Videasy HLS",
          url: m3u8Match[1],
          name: "Videasy",
          quality: "auto",
          language: "it"
        });
      }
      const mp4Match = scriptContent.match(/(?:src|source|file|url)[^"'#]*['"]([^'"]+\.mp4[^'"]*)['"]/i);
      if (mp4Match) {
        streams.push({
          title: "Videasy MP4",
          url: mp4Match[1],
          name: "Videasy",
          quality: "1080p",
          language: "it"
        });
      }
    });
    if (streams.length === 0) {
      streams.push({
        title: "Videasy Embed",
        url,
        name: "Videasy",
        quality: "auto",
        language: "it",
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: {
            request: {
              "User-Agent": USER_AGENT,
              "Referer": getVideasyBaseUrl()
            }
          }
        }
      });
    }
    return streams.map((stream) => formatStream(stream, "Videasy")).filter(Boolean);
  } catch (error) {
    console.error("[Videasy] getStreams failed:", error.message);
    return [];
  }
}
module.exports = { getStreams };

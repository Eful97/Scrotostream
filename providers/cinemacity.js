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
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
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
        pName = `\u{1F4E1} ${pName}`;
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
    function createTimeoutSignal(timeoutMs) {
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
    async function fetchWithTimeout2(url, options = {}) {
      if (typeof fetch === "undefined") {
        throw new Error("No fetch implementation found!");
      }
      const { timeout, ...fetchOptions } = options;
      const requestTimeout = timeout || FETCH_TIMEOUT2;
      const timeoutConfig = createTimeoutSignal(requestTimeout);
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
    module2.exports = { fetchWithTimeout: fetchWithTimeout2, createTimeoutSignal, FETCH_TIMEOUT: FETCH_TIMEOUT2, CONTEXT_TIMEOUT };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal } = require_fetch_helper();
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    async function checkQualityFromPlaylist2(url, headers = {}) {
      try {
        if (!url.includes(".m3u8")) return null;
        const finalHeaders = { ...headers };
        if (!finalHeaders["User-Agent"]) {
          finalHeaders["User-Agent"] = USER_AGENT2;
        }
        const timeoutConfig = createTimeoutSignal(3e3);
        try {
          const response = await fetch(url, {
            headers: finalHeaders,
            signal: timeoutConfig.signal
          });
          if (!response.ok) return null;
          const text = await response.text();
          const quality = checkQualityFromText(text);
          if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
          return quality;
        } finally {
          if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
          }
        }
      } catch (e) {
        return null;
      }
    }
    function checkQualityFromText(text) {
      if (!text) return null;
      if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return "1440p";
      if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return "720p";
      if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return "480p";
      return null;
    }
    function getQualityFromUrl(url) {
      if (!url) return null;
      const urlPath = url.split("?")[0].toLowerCase();
      if (urlPath.includes("4k") || urlPath.includes("2160")) return "4K";
      if (urlPath.includes("1440") || urlPath.includes("2k")) return "1440p";
      if (urlPath.includes("1080") || urlPath.includes("fhd")) return "1080p";
      if (urlPath.includes("720") || urlPath.includes("hd")) return "720p";
      if (urlPath.includes("480") || urlPath.includes("sd")) return "480p";
      if (urlPath.includes("360")) return "360p";
      return null;
    }
    module2.exports = { checkQualityFromPlaylist: checkQualityFromPlaylist2, getQualityFromUrl, checkQualityFromText };
  }
});

// src/cinemacity/index.js
var { formatStream } = require_formatter();
var { checkQualityFromPlaylist } = require_quality_helper();
var { fetchWithTimeout } = require_fetch_helper();
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function base64Decode(str) {
  try {
    if (typeof atob === "function") {
      return decodeURIComponent(escape(atob(str)));
    }
  } catch (e) {
  }
  try {
    let output = "";
    let buffer = 0;
    let bits = 0;
    const input = String(str || "").replace(/[^A-Za-z0-9+/=]/g, "");
    for (let i = 0; i < input.length; i++) {
      const char = input.charAt(i);
      if (char === "=") break;
      const value = BASE64_CHARS.indexOf(char);
      if (value < 0) continue;
      buffer = buffer << 6 | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output += String.fromCharCode(buffer >> bits & 255);
      }
    }
    try {
      return decodeURIComponent(escape(output));
    } catch {
      return output;
    }
  } catch (e) {
    console.error("[CinemaCity] Base64 decode error:", e);
    return "";
  }
}
var BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var FETCH_TIMEOUT = 1e4;
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
function getMappingApiUrl() {
  return "https://animemapping.realbestia.com";
}
function normalizeConfigBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
}
function getMappingLanguage(providerContext = null) {
  const explicit = String(providerContext?.mappingLanguage || "").trim().toLowerCase();
  if (explicit === "it") return "it";
  return normalizeConfigBoolean(providerContext?.easyCatalogsLangIt) ? "it" : null;
}
function getSessionCookies() {
  const cookieB64 = "ZGxlX3VzZXJfaWQ9MzI3Mjk7IGRsZV9wYXNzd29yZD04OTQxNzFjNmE4ZGFiMThlZTU5NGQ1YzY1MjAwOWEzNTs=";
  return base64Decode(cookieB64);
}
async function getIdsFromKitsu(kitsuId, season, episode, providerContext = null) {
  try {
    if (!kitsuId) return null;
    const params = new URLSearchParams();
    const parsedEpisode = Number.parseInt(String(episode || ""), 10);
    const parsedSeason = Number.parseInt(String(season || ""), 10);
    params.set("ep", Number.isInteger(parsedEpisode) && parsedEpisode > 0 ? String(parsedEpisode) : "1");
    if (Number.isInteger(parsedSeason) && parsedSeason >= 0) {
      params.set("s", String(parsedSeason));
    }
    const mappingLanguage = getMappingLanguage(providerContext);
    if (mappingLanguage) {
      params.set("lang", mappingLanguage);
    }
    const url = `${getMappingApiUrl()}/kitsu/${encodeURIComponent(String(kitsuId).trim())}?${params.toString()}`;
    const response = await fetchWithTimeout(url, { timeout: FETCH_TIMEOUT });
    if (!response.ok) return null;
    const payload = await response.json();
    const ids = payload && payload.mappings && payload.mappings.ids ? payload.mappings.ids : {};
    const tmdbEpisode = payload && payload.mappings && (payload.mappings.tmdb_episode || payload.mappings.tmdbEpisode) || payload && (payload.tmdb_episode || payload.tmdbEpisode) || null;
    const tmdbId = ids && /^\d+$/.test(String(ids.tmdb || "").trim()) ? String(ids.tmdb).trim() : null;
    const imdbId = ids && /^tt\d+$/i.test(String(ids.imdb || "").trim()) ? String(ids.imdb).trim() : null;
    const mappedSeason = Number.parseInt(String(
      tmdbEpisode && (tmdbEpisode.season || tmdbEpisode.seasonNumber || tmdbEpisode.season_number) || ""
    ), 10);
    const mappedEpisode = Number.parseInt(String(
      tmdbEpisode && (tmdbEpisode.episode || tmdbEpisode.episodeNumber || tmdbEpisode.episode_number) || ""
    ), 10);
    const rawEpisodeNumber = Number.parseInt(String(
      tmdbEpisode && (tmdbEpisode.rawEpisodeNumber || tmdbEpisode.raw_episode_number || tmdbEpisode.rawEpisode) || ""
    ), 10);
    return {
      tmdbId,
      imdbId,
      mappedSeason: Number.isInteger(mappedSeason) && mappedSeason > 0 ? mappedSeason : null,
      mappedEpisode: Number.isInteger(mappedEpisode) && mappedEpisode > 0 ? mappedEpisode : null,
      rawEpisodeNumber: Number.isInteger(rawEpisodeNumber) && rawEpisodeNumber > 0 ? rawEpisodeNumber : null
    };
  } catch (e) {
    console.error("[CinemaCity] Kitsu mapping error:", e);
    return null;
  }
}
async function searchByImdb(imdbId) {
  const cookies = getSessionCookies();
  const trySearch = async (query) => {
    const searchUrl = `${BASE_URL}/index.php?do=search&subaction=search&story=${query}`;
    try {
      const response = await fetchWithTimeout(searchUrl, {
        timeout: FETCH_TIMEOUT,
        headers: {
          "User-Agent": USER_AGENT,
          "Cookie": cookies || "",
          "Referer": `${BASE_URL}/`
        }
      });
      if (!response.ok) return null;
      const html = await response.text();
      const resultMatch = html.match(/Found\s+(\d+)\s+responses/i) || html.match(/Trovat[io]\s+(\d+)\s+risultat[io]/i) || html.match(/Query results\s*\d+\s*-\s*(\d+)/i);
      if (!resultMatch || parseInt(resultMatch[1]) === 0) {
        if (!html.includes(query)) return null;
      }
      let searchArea = "";
      const markerIdx = resultMatch ? html.indexOf(resultMatch[0]) : html.indexOf('id="dle-content"');
      if (markerIdx === -1) {
        if (html.includes("site search yielded no results") || html.includes("ricerca non ha prodotto risultati")) {
          return null;
        }
        return null;
      }
      const contentEndStrings = ['id="side"', "class='side'", "<footer", "<aside"];
      let contentEndIdx = html.length;
      for (const s of contentEndStrings) {
        const pos = html.indexOf(s, markerIdx);
        if (pos !== -1 && pos < contentEndIdx) contentEndIdx = pos;
      }
      searchArea = html.substring(markerIdx, contentEndIdx);
      const links = [...searchArea.matchAll(/<a[^>]+href=["']((?:https?:\/\/cinemacity\.cc)?\/(?:movies|anime|series|tv-series)\/\d+-[^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      if (links.length > 0) {
        let bestMatch = links[0];
        const queryPos = searchArea.indexOf(query);
        if (queryPos !== -1) {
          let minDistance = Infinity;
          for (const match of links) {
            const distance = Math.abs(match.index - queryPos);
            if (distance < minDistance) {
              minDistance = distance;
              bestMatch = match;
            }
          }
        }
        let bestLink = bestMatch[1];
        let bestTitle = bestMatch[2].replace(/<[^>]*>?/gm, "").trim();
        if (bestLink.startsWith("/")) bestLink = BASE_URL + bestLink;
        return { url: bestLink, title: bestTitle };
      }
    } catch (e) {
      console.error(`[CinemaCity] Search error for ${query}:`, e);
    }
    return null;
  };
  let link = await trySearch(imdbId);
  if (link) return link;
  const numericId = imdbId.replace(/\D/g, "");
  if (numericId && numericId !== imdbId) {
    link = await trySearch(numericId);
  }
  return link;
}
function extractJsonArray(decoded) {
  let start = decoded.indexOf("file:");
  if (start === -1) start = decoded.indexOf("sources:");
  if (start === -1) return null;
  start = decoded.indexOf("[", start);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < decoded.length; i++) {
    if (decoded[i] === "[") depth++;
    else if (decoded[i] === "]") depth--;
    if (depth === 0) {
      return decoded.substring(start, i + 1);
    }
  }
  return null;
}
function resolveUrl(baseUrl, relativeOrAbsoluteUrl) {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).toString();
  } catch {
    return relativeOrAbsoluteUrl;
  }
}
function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return BASE_URL;
  }
}
function extractPlayerReferer(html, pageUrl) {
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']*player\.php[^"']*)["']/i);
  if (!iframeMatch || !iframeMatch[1]) {
    return pageUrl;
  }
  return resolveUrl(pageUrl, iframeMatch[1]);
}
function parseCompositeSeriesId(rawId, season, episode) {
  const parsed = {
    normalizedId: String(rawId || "").trim(),
    season: Number.isInteger(season) ? season : Number.parseInt(season, 10) || 1,
    episode: Number.isInteger(episode) ? episode : Number.parseInt(episode, 10) || 1
  };
  const match = parsed.normalizedId.match(/^(tt\d+|\d+|tmdb:\d+):(\d+):(\d+)$/i);
  if (!match) {
    return parsed;
  }
  parsed.normalizedId = match[1];
  parsed.season = Number.parseInt(match[2], 10) || parsed.season;
  parsed.episode = Number.parseInt(match[3], 10) || parsed.episode;
  return parsed;
}
function pickStream(fileData, type, season = 1, episode = 1) {
  if (typeof fileData === "string") {
    return fileData;
  }
  if (Array.isArray(fileData)) {
    if (type === "movie" || fileData.every((x) => x && typeof x === "object" && "file" in x && !("folder" in x))) {
      return fileData[0]?.file;
    }
    let selectedSeasonFolder = null;
    for (const s of fileData) {
      if (!s || typeof s !== "object" || !s.folder) continue;
      const title = (s.title || "").toLowerCase();
      const seasonRegex = new RegExp(`(?:season|stagione|s)\\s*0*${season}\\b`, "i");
      if (seasonRegex.test(title)) {
        selectedSeasonFolder = s.folder;
        break;
      }
    }
    if (!selectedSeasonFolder && fileData.length > 0) {
      for (const s of fileData) {
        if (s && s.folder) {
          selectedSeasonFolder = s.folder;
          break;
        }
      }
    }
    if (!selectedSeasonFolder) return null;
    let selectedEpisodeFile = null;
    for (const e of selectedSeasonFolder) {
      if (!e || typeof e !== "object" || !e.file) continue;
      const title = (e.title || "").toLowerCase();
      const epRegex = new RegExp(`(?:episode|episodio|e)\\s*0*${episode}\\b`, "i");
      if (epRegex.test(title)) {
        selectedEpisodeFile = e.file;
        break;
      }
    }
    if (!selectedEpisodeFile) {
      const idx = Math.max(0, episode - 1);
      const epData = idx < selectedSeasonFolder.length ? selectedSeasonFolder[idx] : selectedSeasonFolder[0];
      selectedEpisodeFile = epData?.file || null;
    }
    return selectedEpisodeFile;
  }
  return null;
}
async function getStreams(id, type, season, episode, providerContext = null) {
  const parsedRequest = parseCompositeSeriesId(id, season, episode);
  id = parsedRequest.normalizedId;
  season = parsedRequest.season;
  episode = parsedRequest.episode;
  let imdbId = String(id || "").trim();
  const providerType = type === "tv" || type === "series" || type === "anime" ? "tv" : "movie";
  const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
  const contextImdbId = providerContext && /^tt\d+$/i.test(String(providerContext.imdbId || "")) ? String(providerContext.imdbId) : null;
  const contextKitsuId = providerContext && /^\d+$/.test(String(providerContext.kitsuId || "")) ? String(providerContext.kitsuId) : null;
  const shouldIncludeSeasonHintForKitsu = providerContext && providerContext.seasonProvided === true;
  if (imdbId.startsWith("kitsu:") || contextKitsuId) {
    const kitsuId = contextKitsuId || ((imdbId.match(/^kitsu:(\d+)/i) || [])[1] || null);
    const seasonHintForKitsu = shouldIncludeSeasonHintForKitsu ? season : null;
    const mapped = kitsuId ? await getIdsFromKitsu(kitsuId, seasonHintForKitsu, episode, providerContext) : null;
    if (mapped) {
      if (mapped.imdbId) {
        imdbId = mapped.imdbId;
      } else if (mapped.tmdbId) {
        imdbId = mapped.tmdbId;
      }
      if (mapped.mappedSeason && mapped.mappedEpisode) {
        season = mapped.mappedSeason;
        episode = mapped.mappedEpisode;
      } else if (mapped.rawEpisodeNumber) {
        episode = mapped.rawEpisodeNumber;
      }
    }
  }
  if (!imdbId.startsWith("tt") && contextImdbId) {
    imdbId = contextImdbId;
  } else if (!/^\d+$/.test(imdbId) && contextTmdbId) {
    imdbId = contextTmdbId;
  }
  if (!imdbId.startsWith("tt")) {
    if (providerContext && providerContext.imdbId && providerContext.imdbId.startsWith("tt")) {
      imdbId = providerContext.imdbId;
    } else {
      try {
        const tmdbId = imdbId.replace(/\D/g, "");
        if (tmdbId) {
          let externalUrl = "";
          if (providerType === "movie") {
            externalUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
          } else {
            externalUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
          }
          const response = await fetchWithTimeout(externalUrl, { timeout: FETCH_TIMEOUT });
          if (response.ok) {
            const data = await response.json();
            if (data.imdb_id) {
              imdbId = data.imdb_id;
            }
          }
        }
      } catch (e) {
        console.error("[CinemaCity] TMDB to IMDb resolution error:", e);
      }
    }
  }
  if (!imdbId.startsWith("tt")) {
    return [];
  }
  try {
    const isStremioAddon = providerContext && providerContext.__requestContext === true;
    const proxyUrl = providerContext && providerContext.proxyUrl || (typeof global !== "undefined" && global.CF_PROXY_URL ? global.CF_PROXY_URL : null);
    const proxyPassword = providerContext && providerContext.proxyPassword || "";
    const searchResult = await searchByImdb(imdbId);
    if (!searchResult || !searchResult.url) {
      return [];
    }
    const movieUrl = searchResult.url;
    let movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, "").trim();
    if (type === "tv" || type === "series") {
      movieTitle += ` ${season}x${episode}`;
    }
    if (isStremioAddon) {
      if (!proxyUrl) {
        return [];
      }
      let finalTargetUrl = movieUrl;
      if (type === "tv" || type === "series") {
        const separator = finalTargetUrl.includes("?") ? "&" : "?";
        finalTargetUrl += `${separator}s=${season}&e=${episode}`;
      }
      const passwordQuery = proxyPassword ? `&api_password=${encodeURIComponent(proxyPassword)}` : "";
      const extractorUrl = `${proxyUrl}/extractor/video.m3u8?host=city&d=${encodeURIComponent(finalTargetUrl)}&redirect_stream=true${passwordQuery}`;
      const result2 = {
        name: "CinemaCity",
        title: movieTitle,
        url: extractorUrl,
        quality: "1080p",
        type: "direct",
        behaviorHints: {
          notWebReady: true
        }
      };
      return [formatStream(result2, "CinemaCity")];
    }
    const cookies = getSessionCookies();
    const response = await fetchWithTimeout(movieUrl, {
      timeout: FETCH_TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        "Cookie": cookies,
        "Referer": `${BASE_URL}/`
      }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const playerReferer = extractPlayerReferer(html, movieUrl);
    const atobRegex = /atob\s*\(\s*['"](.*?)['"]\s*\)/gi;
    let match;
    let fileData = null;
    while ((match = atobRegex.exec(html)) !== null) {
      const encoded = match[1];
      try {
        if (encoded.length < 50) continue;
        let decoded;
        try {
          decoded = base64Decode(encoded);
        } catch (e) {
          continue;
        }
        if (!decoded) continue;
        if (decoded.trim().startsWith("[")) {
          try {
            fileData = JSON.parse(decoded);
            if (fileData && fileData.length > 0) break;
          } catch (e) {
          }
        }
        const rawJson = extractJsonArray(decoded);
        if (rawJson) {
          try {
            const cleanJson = rawJson.replace(/\\(.)/g, "$1");
            fileData = JSON.parse(cleanJson);
          } catch (e) {
            try {
              fileData = JSON.parse(rawJson);
            } catch (e2) {
            }
          }
          if (fileData && fileData.length > 0) break;
        }
        const fileMatch = decoded.match(/(?:file|sources)\s*:\s*['"](.*?)['"]/i);
        if (fileMatch) {
          const url = fileMatch[1];
          if (url.includes(".m3u8") || url.includes(".mp4")) {
            fileData = url;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    if (!fileData) {
      return [];
    }
    const streamUrl = pickStream(fileData, type, season, episode);
    if (!streamUrl) return [];
    const results = [];
    const streamHeaders = {
      "User-Agent": USER_AGENT,
      "Referer": playerReferer,
      "Origin": getOrigin(movieUrl),
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "Connection": "keep-alive",
      "Cookie": cookies
    };
    const result = {
      name: "CinemaCity",
      title: movieTitle,
      url: streamUrl,
      quality: "1080p",
      type: "direct",
      headers: streamHeaders,
      behaviorHints: {
        notWebReady: true
      }
    };
    if (streamUrl.includes(".m3u8")) {
      const detectedQuality = await checkQualityFromPlaylist(streamUrl, result.headers);
      if (detectedQuality) result.quality = detectedQuality;
    }
    results.push(formatStream(result, "CinemaCity"));
    return results;
  } catch (e) {
    console.error("[CinemaCity] Error:", e);
    return [];
  }
}
module.exports = { getStreams };

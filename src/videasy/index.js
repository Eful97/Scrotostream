"use strict";

const cheerio = require("cheerio");
const { formatStream } = require("../formatter.js");
const { createTimeoutSignal, fetchWithHeaders } = require("../fetch_helper.js");

function getVideasyBaseUrl() {
  return "https://player.videasy.net";
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const FETCH_TIMEOUT = 15000;

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
            quality: String(quality).toLowerCase().includes("1080") ? "1080p" :
                   String(quality).toLowerCase().includes("720") ? "720p" :
                   String(quality).toLowerCase().includes("480") ? "480p" : "auto",
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
        url: url,
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

    return streams
      .map((stream) => formatStream(stream, "Videasy"))
      .filter(Boolean);
      
  } catch (error) {
    console.error("[Videasy] getStreams failed:", error.message);
    return [];
  }
}

module.exports = { getStreams };
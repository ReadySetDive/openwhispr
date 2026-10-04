/**
 * Web and news search helper for Localwhispr.
 * Uses real-time news feeds, DuckDuckGo public HTML web search, and DuckDuckGo Instant Answers
 * to provide up-to-date web results without requiring third-party API keys or cloud accounts.
 */

function unescapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether the search query is looking for current news, headlines, or breaking stories.
 */
function isNewsQuery(query) {
  const q = query.toLowerCase();
  return /\b(news|headline|headlines|breaking|top stories|current events|latest updates|today's news)\b/.test(q);
}

/**
 * Fetches real-time news headlines from public RSS feeds when news is requested.
 */
async function fetchNewsResults(query, limit = 5) {
  try {
    const isGeneral = /^(current\s+)?(top\s+)?(breaking\s+)?news(\s+today|\s+headlines)?$/i.test(query.trim());
    const rssUrl = isGeneral
      ? "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"
      : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const xml = await res.text();
    const itemRegex =
      /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?(?:<description>([\s\S]*?)<\/description>)?[\s\S]*?<\/item>/gi;
    const items = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const title = unescapeHtml(match[1]);
      const url = match[2].trim();
      const pubDate = match[3].trim();
      const desc = unescapeHtml(match[4] || "");
      items.push({
        title,
        url,
        text: desc ? `${desc} (${pubDate})` : `Published: ${pubDate}`,
        publishedDate: pubDate,
      });
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Perform a web search using real-time news feeds and DuckDuckGo endpoints.
 * @param {string} query The search query string.
 * @param {number} numResults Maximum results to return (default: 5).
 * @returns {Promise<Array<{ title: string, url: string, text: string, publishedDate: string | null }>>}
 */
async function searchDuckDuckGo(query, numResults = 5) {
  if (!query || typeof query !== "string") {
    return [];
  }

  const results = [];
  const seenUrls = new Set();
  const trimmedQuery = query.trim();

  // 1. If query is news-oriented, prioritize actual current news headlines
  if (isNewsQuery(trimmedQuery)) {
    const newsItems = await fetchNewsResults(trimmedQuery, numResults);
    for (const item of newsItems) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        results.push(item);
      }
    }
  }

  // 2. DuckDuckGo HTML web search for organic web pages and rich snippets
  if (results.length < numResults) {
    try {
      const htmlRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmedQuery)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(4500),
        }
      );

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippets = [];
        let sm;
        while ((sm = snippetRegex.exec(html)) !== null) {
          snippets.push(unescapeHtml(sm[1]));
        }

        const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let tm;
        let idx = 0;
        while ((tm = titleRegex.exec(html)) !== null && results.length < numResults) {
          let rawUrl = tm[1];
          const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            try {
              rawUrl = decodeURIComponent(uddgMatch[1]);
            } catch {}
          } else if (rawUrl.startsWith("//")) {
            rawUrl = "https:" + rawUrl;
          }
          const rawTitle = unescapeHtml(tm[2]);
          if (rawUrl && rawTitle && !seenUrls.has(rawUrl)) {
            seenUrls.add(rawUrl);
            results.push({
              title: rawTitle,
              url: rawUrl,
              text: snippets[idx] || "",
              publishedDate: null,
            });
          }
          idx++;
        }
      }
    } catch {
      // HTML search failed or timed out
    }
  }

  // 3. DuckDuckGo Instant Answer API for direct encyclopedia abstracts (definitions, entities)
  if (results.length < numResults) {
    try {
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}&format=json&no_html=1&skip_disambig=0`;
      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.AbstractText && !seenUrls.has(data.AbstractURL)) {
          const url = data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}`;
          results.unshift({
            title: unescapeHtml(data.Heading || trimmedQuery),
            url,
            text: unescapeHtml(data.AbstractText),
            publishedDate: null,
          });
          seenUrls.add(url);
        }
      }
    } catch {
      // Instant answer failed
    }
  }

  return results.slice(0, numResults);
}

module.exports = {
  searchDuckDuckGo,
  unescapeHtml,
  isNewsQuery,
};

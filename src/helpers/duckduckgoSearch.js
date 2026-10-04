/**
 * DuckDuckGo public search helper for Localwhispr.
 * Uses DuckDuckGo's public Instant Answer API and public search endpoint
 * to provide real-time web results without requiring third-party API keys or cloud accounts.
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Perform a web search using DuckDuckGo public endpoints.
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

  // 1. DuckDuckGo Instant Answer API (Official public API)
  try {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}&format=json&no_html=1&skip_disambig=0`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.AbstractText) {
        const url = data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}`;
        results.push({
          title: unescapeHtml(data.Heading || trimmedQuery),
          url,
          text: unescapeHtml(data.AbstractText),
          publishedDate: null,
        });
        seenUrls.add(url);
      }

      if (Array.isArray(data.Results)) {
        for (const r of data.Results) {
          if (r.FirstURL && r.Text && !seenUrls.has(r.FirstURL)) {
            seenUrls.add(r.FirstURL);
            results.push({
              title: unescapeHtml(r.Text.split(" - ")[0] || r.Text),
              url: r.FirstURL,
              text: unescapeHtml(r.Text),
              publishedDate: null,
            });
          }
        }
      }

      const processTopics = (topics) => {
        if (!Array.isArray(topics)) return;
        for (const item of topics) {
          if (item.Topics && Array.isArray(item.Topics)) {
            processTopics(item.Topics);
          } else if (item.FirstURL && item.Text && !seenUrls.has(item.FirstURL)) {
            seenUrls.add(item.FirstURL);
            results.push({
              title: unescapeHtml(item.Text.split(" - ")[0] || item.Text),
              url: item.FirstURL,
              text: unescapeHtml(item.Text),
              publishedDate: null,
            });
          }
        }
      };
      processTopics(data.RelatedTopics);
    }
  } catch (err) {
    // If Instant Answer endpoint fails or is blocked, proceed to HTML fallback
  }

  // 2. Supplement / fallback with DuckDuckGo HTML web search
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
    } catch (err) {
      // HTML search failed
    }
  }

  return results.slice(0, numResults);
}

module.exports = {
  searchDuckDuckGo,
  unescapeHtml,
};

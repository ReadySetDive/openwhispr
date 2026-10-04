/**
 * DuckDuckGo public search helper for the renderer process.
 */

export function unescapeHtml(text: string): string {
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

export interface WebSearchResultItem {
  title: string;
  url: string;
  text: string;
  publishedDate?: string | null;
}

export async function searchDuckDuckGo(
  query: string,
  numResults = 5
): Promise<WebSearchResultItem[]> {
  if (!query || typeof query !== "string") {
    return [];
  }

  const results: WebSearchResultItem[] = [];
  const seenUrls = new Set<string>();
  const trimmedQuery = query.trim();

  // 1. DuckDuckGo Instant Answer API (Official public API)
  try {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}&format=json&no_html=1&skip_disambig=0`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.AbstractText) {
        const url =
          data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(trimmedQuery)}`;
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

      const processTopics = (topics: any) => {
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
    // Fall back to HTML search
  }

  // 2. Supplement / fallback with DuckDuckGo HTML search
  if (results.length < numResults) {
    try {
      const htmlRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmedQuery)}`,
        {
          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          },
        }
      );

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippets: string[] = [];
        let sm: RegExpExecArray | null;
        while ((sm = snippetRegex.exec(html)) !== null) {
          snippets.push(unescapeHtml(sm[1]));
        }

        const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let tm: RegExpExecArray | null;
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
      // HTML search failed
    }
  }

  return results.slice(0, numResults);
}

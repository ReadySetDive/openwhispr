/**
 * Zero-dependency HTML to clean Markdown converter.
 * Prunes boilerplate (scripts, styles, nav, ads, headers, footers) and
 * converts semantic content into readable markdown for LLM consumption.
 */

function unescapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Resolves a relative or protocol-relative link against the base URL.
 */
function resolveUrl(href, baseUrl) {
  if (!href) return "";
  if (!baseUrl) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Converts raw HTML into clean, pruned Markdown.
 * @param {string} html Raw HTML string
 * @param {string} [pageUrl] Original page URL
 * @param {number} [maxChars] Maximum character budget for the returned markdown
 * @returns {{ title: string, markdown: string }}
 */
function htmlToMarkdown(html, pageUrl = "", maxChars = 7000) {
  if (!html || typeof html !== "string") {
    return { title: "", markdown: "" };
  }

  // 1. Extract Title
  let title = "";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = unescapeHtml(titleMatch[1].replace(/<[^>]+>/g, "").trim());
  }
  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) title = unescapeHtml(ogTitleMatch[1].trim());
  }

  let doc = html;

  // 2. Strip non-content and layout tags
  doc = doc.replace(/<(script|style|svg|noscript|nav|header|footer|aside|form|iframe|menu)[\s\S]*?<\/\1>/gi, " ");
  doc = doc.replace(/<!--[\s\S]*?-->/g, " ");

  // 3. Try to locate main article / content body to ignore global page chrome
  const articleMatch =
    doc.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    doc.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    doc.match(/<div[^>]*id=["'](?:content|main-content|article|story|post-body)["'][^>]*>([\s\S]*?)<\/div>/i);
  if (articleMatch) {
    doc = articleMatch[1];
  }

  // 4. Transform semantic elements to markdown
  // Headings
  doc = doc.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  doc = doc.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  doc = doc.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  doc = doc.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n\n#### $1\n\n");

  // Code blocks and inline code
  doc = doc.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n\n```\n$1\n```\n\n");
  doc = doc.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n\n```\n$1\n```\n\n");
  doc = doc.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Bold & Italic
  doc = doc.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
  doc = doc.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");

  // Links
  doc = doc.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, "").trim();
    if (!cleanText || href.startsWith("javascript:") || href.startsWith("#")) return cleanText;
    const resolved = resolveUrl(href, pageUrl);
    return `[${cleanText}](${resolved})`;
  });

  // Blockquotes
  doc = doc.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "\n> $1\n");

  // Lists
  doc = doc.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  doc = doc.replace(/<\/(?:ul|ol)>/gi, "\n");

  // Paragraphs and breaks
  doc = doc.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");
  doc = doc.replace(/<br\s*\/?>/gi, "\n");
  doc = doc.replace(/<hr\s*\/?>/gi, "\n---\n");

  // 5. Strip all remaining HTML tags
  doc = doc.replace(/<[^>]+>/g, " ");

  // 6. Unescape entities
  doc = unescapeHtml(doc);

  // 7. Normalize whitespace
  doc = doc
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 8. Truncate to context budget
  let truncated = false;
  if (doc.length > maxChars) {
    // Find last newline or period before budget
    let cutPoint = doc.lastIndexOf("\n", maxChars);
    if (cutPoint === -1 || cutPoint < maxChars * 0.75) {
      cutPoint = doc.lastIndexOf(". ", maxChars);
    }
    if (cutPoint === -1 || cutPoint < maxChars * 0.75) {
      cutPoint = maxChars;
    }
    doc = doc.slice(0, cutPoint).trim();
    truncated = true;
  }

  // 9. Format final markdown output with header
  let result = "";
  if (title) result += `# ${title}\n`;
  if (pageUrl) result += `URL: ${pageUrl}\n\n`;
  result += doc;
  if (truncated) {
    result += "\n\n*(Content truncated to fit context window)*";
  }

  return { title, markdown: result };
}

/**
 * Fetches an external webpage and converts its HTML to clean Markdown.
 * @param {string} url Target webpage URL
 * @param {number} [timeoutMs] Request timeout in milliseconds (default 10,000)
 * @returns {Promise<{ success: boolean, title?: string, url: string, markdown?: string, error?: string }>}
 */
async function fetchAndParseWebPage(url, timeoutMs = 10000) {
  if (!url || typeof url !== "string") {
    return { success: false, url: "", error: "Missing or invalid URL" };
  }

  let validUrl = url.trim();
  if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
    validUrl = "https://" + validUrl;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(validUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        url: validUrl,
        error: `HTTP request failed with status ${res.status} (${res.statusText})`,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      return {
        success: false,
        url: validUrl,
        error: "URL points to a binary PDF file, not an HTML web page.",
      };
    }

    const html = await res.text();
    const { title, markdown } = htmlToMarkdown(html, validUrl);

    return {
      success: true,
      title: title || validUrl,
      url: validUrl,
      markdown,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { success: false, url: validUrl, error: `Request timed out after ${timeoutMs / 1000}s` };
    }
    return { success: false, url: validUrl, error: err.message || "Failed to fetch webpage" };
  }
}

module.exports = {
  htmlToMarkdown,
  fetchAndParseWebPage,
  unescapeHtml,
};

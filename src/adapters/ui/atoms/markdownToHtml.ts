/**
 * Tiny, zero-dependency Markdown → safe-HTML renderer (SPEC §17.27).
 *
 * The kiosk's `TextNode` value can now be authored in Markdown so a
 * status note can carry **bold**, *italic*, headings, lists, links,
 * and inline `code` without bringing in a 30 KB parser. The supported
 * subset is intentionally small — exactly the inline + block features
 * a kiosk operator actually needs for a status note:
 *
 *   - **Inline** — bold (`**...**`), italic (`*...*` and `_..._`),
 *     inline code (`` `...` ``), and links `[label](url)`.
 *   - **Block** — paragraphs (separated by a blank line; single
 *     newlines inside a paragraph become a `<br>`), headings
 *     (`#`/`##`/`###` mapped to `<h3>`/`<h4>`/`<h5>` so they read as
 *     section titles **inside** the tile rather than competing with
 *     the tile's own `<h1>`/`<h2>` title row), unordered lists
 *     (`-` or `*` lines), and ordered lists (`1.` lines).
 *
 * Safety contract:
 *   - Every user-supplied character is HTML-escaped **before** any
 *     Markdown transform runs, so raw `<script>` (or any other tag)
 *     never reaches the DOM.
 *   - URLs in `[label](url)` are gated by {@link isSafeHref} — only
 *     `http(s):` / `mailto:` / relative paths pass; `javascript:`,
 *     `data:`, `vbscript:` etc. degrade to plain text (the label
 *     stays, the link drops).
 *   - The renderer returns a `string` of HTML; Lit consumers MUST
 *     pipe it through `unsafeHTML(...)` to inject. Wrapping in
 *     `unsafeHTML` is safe **because** of the escape-first contract
 *     above; calling it on arbitrary external HTML would not be.
 *
 * Not supported (deliberately out of scope for the kiosk MVP):
 *   - Code fences (` ``` `).
 *   - Block quotes (`>`).
 *   - Tables.
 *   - Images (no domain need; would also widen the URL allow-list).
 *   - Nested lists (the parser flattens; `-`-indented `-` lines join
 *     the same list).
 *
 * Lives under `adapters/ui/markdown/` (not under `views/`) because it
 * is view-agnostic — a future tooltip / drawer / focus panel can
 * import the same renderer without coupling to a specific Lit
 * element.
 */

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * HTML-escape every special character in `s`. The `'` quote is
 * escaped as `&#39;` (numeric entity, valid in both HTML4 and HTML5)
 * because `&apos;` is HTML5-only and we do not control the host
 * page's doctype in every embedding context.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);
}

/**
 * Allow-list URL gate for `[label](url)` links. Accepts:
 *   - `http://…` / `https://…`
 *   - `mailto:…`
 *   - relative paths (`/…`, `./…`, `../…`)
 *   - in-page anchors (`#…`)
 *
 * Rejects: `javascript:`, `data:`, `vbscript:`, and anything else
 * (including unsafe `file:` URIs and unknown schemes).
 *
 * Exported so view-level callers can reuse the same gate when they
 * synthesize their own links.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === "") return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^mailto:/i.test(trimmed)) return true;
  if (/^[#/]/.test(trimmed)) return true;
  if (/^\.{1,2}\//.test(trimmed)) return true;
  return false;
}

/**
 * Apply inline Markdown transforms to an already-HTML-escaped line.
 *
 * Order matters and inline `code` is special: a `**bold**` (or other
 * marker) sequence inside backticks must stay literal. We achieve
 * this by **stashing** every `code` span behind a placeholder token
 * before any other transform runs, then restoring the spans last.
 * After stashing, the order is: links (so a `*` inside a URL does
 * not start an italic run), then bold, then italic. The italic regex
 * requires the `*` / `_` to NOT be flanked by another marker
 * character, which keeps `**bold**` and `__doc__` unaffected by the
 * italic pass.
 */
function renderInline(escaped: string): string {
  const codeStash: string[] = [];
  let html = escaped.replace(/`([^`\n]+)`/g, (_, code: string) => {
    const idx = codeStash.length;
    codeStash.push(`<code>${code}</code>`);
    return `\u0000c${idx}\u0000`;
  });
  html = html.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (_, label: string, href: string) => {
      const decoded = decodeHrefForGate(href);
      if (!isSafeHref(decoded)) return label;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );
  html = html.replace(
    /\*\*([^*\n]+)\*\*/g,
    (_, inner: string) => `<strong>${inner}</strong>`,
  );
  html = html.replace(
    /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
    (_, before: string, inner: string) => `${before}<em>${inner}</em>`,
  );
  html = html.replace(
    /(^|[^_\w])_([^_\n]+)_(?=[^_\w]|$)/g,
    (_, before: string, inner: string) => `${before}<em>${inner}</em>`,
  );
  html = html.replace(
    /\u0000c(\d+)\u0000/g,
    (_, idx: string) => codeStash[Number(idx)] ?? "",
  );
  return html;
}

/**
 * The `[label](url)` regex captures the URL as it appears in the
 * source. Since `escapeHtml` already turned `&` into `&amp;`, we have
 * to undo that transform before the URL hits the safety gate so the
 * gate sees the actual scheme. We re-emit the escaped form on the
 * output side (it is the safe encoding for `href` attributes).
 */
function decodeHrefForGate(escaped: string): string {
  return escaped.replace(/&amp;/g, "&");
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; level: 3 | 4 | 5; text: string };

/**
 * Render a Markdown source string to a sanitized HTML string.
 *
 * Pipeline:
 *   1. Split into lines, classify each line into a block kind
 *      (`paragraph`, `heading`, `unordered-list-item`,
 *      `ordered-list-item`).
 *   2. Group consecutive list-item lines into a single `<ul>` / `<ol>`
 *      block; group consecutive paragraph lines into a `<p>` joined
 *      with `<br>`.
 *   3. HTML-escape every line, then run inline transforms.
 *   4. Concatenate the blocks into a single HTML string.
 *
 * Empty input returns an empty string.
 */
export function renderMarkdownToHtml(src: string): string {
  if (!src) return "";
  const lines = src.split(/\r?\n/);
  const blocks: Block[] = [];
  let pending: Block | null = null;

  function flush(): void {
    if (pending) {
      blocks.push(pending);
      pending = null;
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.replace(/^\s+/, "");

    if (trimmed === "") {
      flush();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const level = (heading[1]!.length + 2) as 3 | 4 | 5;
      blocks.push({ kind: "h", level, text: heading[2]! });
      continue;
    }

    const ulMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ulMatch) {
      if (pending?.kind !== "ul") flush();
      if (!pending) pending = { kind: "ul", items: [] };
      (pending as { kind: "ul"; items: string[] }).items.push(ulMatch[1]!);
      continue;
    }

    const olMatch = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (olMatch) {
      if (pending?.kind !== "ol") flush();
      if (!pending) pending = { kind: "ol", items: [] };
      (pending as { kind: "ol"; items: string[] }).items.push(olMatch[1]!);
      continue;
    }

    if (pending?.kind !== "p") flush();
    if (!pending) pending = { kind: "p", lines: [] };
    (pending as { kind: "p"; lines: string[] }).lines.push(trimmed);
  }
  flush();

  return blocks.map(renderBlock).join("");
}

function renderBlock(block: Block): string {
  if (block.kind === "h") {
    const inline = renderInline(escapeHtml(block.text));
    return `<h${block.level}>${inline}</h${block.level}>`;
  }
  if (block.kind === "ul") {
    return (
      "<ul>" +
      block.items.map((it) => `<li>${renderInline(escapeHtml(it))}</li>`).join("") +
      "</ul>"
    );
  }
  if (block.kind === "ol") {
    return (
      "<ol>" +
      block.items.map((it) => `<li>${renderInline(escapeHtml(it))}</li>`).join("") +
      "</ol>"
    );
  }
  // paragraph: lines joined with <br>, each line escaped + inline-formatted.
  return (
    "<p>" +
    block.lines.map((l) => renderInline(escapeHtml(l))).join("<br>") +
    "</p>"
  );
}

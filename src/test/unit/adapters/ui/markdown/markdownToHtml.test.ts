import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  isSafeHref,
  renderMarkdownToHtml,
} from "../../../../../adapters/ui/markdown/markdownToHtml.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
    expect(escapeHtml("a<b")).toBe("a&lt;b");
    expect(escapeHtml("a>b")).toBe("a&gt;b");
    expect(escapeHtml('a"b')).toBe("a&quot;b");
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("leaves safe characters untouched", () => {
    expect(escapeHtml("plain text 123 — em-dash")).toBe(
      "plain text 123 — em-dash",
    );
  });

  it("escapes a `<script>` tag end-to-end (defence-in-depth)", () => {
    // SPEC §17.27 — the safety net for the markdown renderer is "escape
    // every char before any markdown transform". This test pins the
    // utility so a future change can't silently drop the escape.
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
  });
});

describe("isSafeHref", () => {
  it("accepts http + https + mailto + relative + anchor URLs", () => {
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("https://example.com/path")).toBe(true);
    expect(isSafeHref("mailto:ops@example.com")).toBe(true);
    expect(isSafeHref("/local/path")).toBe(true);
    expect(isSafeHref("./relative")).toBe(true);
    expect(isSafeHref("../parent")).toBe(true);
    expect(isSafeHref("#anchor")).toBe(true);
  });

  it("rejects javascript: data: vbscript: and unknown schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>")).toBe(false);
    expect(isSafeHref("vbscript:msg")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
    expect(isSafeHref("ftp://example.com")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
});

describe("renderMarkdownToHtml — base cases", () => {
  it("returns an empty string for empty input", () => {
    expect(renderMarkdownToHtml("")).toBe("");
  });

  it("wraps a single plain line in a paragraph", () => {
    expect(renderMarkdownToHtml("Hello world")).toBe("<p>Hello world</p>");
  });

  it("escapes HTML in plain content (no transforms)", () => {
    expect(renderMarkdownToHtml("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
  });

  it("does NOT execute embedded <script> markup (escape-first contract)", () => {
    const html = renderMarkdownToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderMarkdownToHtml — inline formatting", () => {
  it("renders **bold**", () => {
    expect(renderMarkdownToHtml("a **bold** word")).toBe(
      "<p>a <strong>bold</strong> word</p>",
    );
  });

  it("renders *italic* (asterisk)", () => {
    expect(renderMarkdownToHtml("a *slanted* word")).toBe(
      "<p>a <em>slanted</em> word</p>",
    );
  });

  it("renders _italic_ (underscore, word-boundary)", () => {
    expect(renderMarkdownToHtml("a _slanted_ word")).toBe(
      "<p>a <em>slanted</em> word</p>",
    );
  });

  it("does NOT italicise underscores inside identifiers", () => {
    // `snake_case_token` should stay plain — the underscores are
    // intra-word and shouldn't be treated as italic markers.
    expect(renderMarkdownToHtml("snake_case_token")).toBe(
      "<p>snake_case_token</p>",
    );
  });

  it("renders `inline code`", () => {
    expect(renderMarkdownToHtml("call `fn()` now")).toBe(
      "<p>call <code>fn()</code> now</p>",
    );
  });

  it("does NOT bold inside backticks (code wins over bold)", () => {
    // The renderer processes `code` before bold, so `**text**` inside
    // backticks should stay raw markdown text inside <code>.
    expect(renderMarkdownToHtml("`**not bold**`")).toBe(
      "<p><code>**not bold**</code></p>",
    );
  });

  it("renders [label](url) links with target+rel hardening", () => {
    const html = renderMarkdownToHtml("see [docs](https://example.com)");
    expect(html).toBe(
      '<p>see <a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a></p>',
    );
  });

  it("downgrades unsafe-scheme links to plain label text", () => {
    // SPEC §17.27 — `javascript:` should never reach the DOM as a real
    // anchor. The label text is preserved (so the operator sees what
    // they typed); the `<a>` is dropped.
    const html = renderMarkdownToHtml("see [click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
    expect(html).toContain("click");
  });
});

describe("renderMarkdownToHtml — block structure", () => {
  it("splits on blank lines into paragraphs", () => {
    expect(renderMarkdownToHtml("First.\n\nSecond.")).toBe(
      "<p>First.</p><p>Second.</p>",
    );
  });

  it("joins single-newline lines with <br> inside a paragraph", () => {
    expect(renderMarkdownToHtml("Line A\nLine B")).toBe(
      "<p>Line A<br>Line B</p>",
    );
  });

  it("renders # / ## / ### as <h3> / <h4> / <h5>", () => {
    // Inside a tile we deliberately downshift from h1/h2 (the tile's
    // title) to h3/h4/h5 so the markdown headings nest visually.
    expect(renderMarkdownToHtml("# Top")).toBe("<h3>Top</h3>");
    expect(renderMarkdownToHtml("## Sub")).toBe("<h4>Sub</h4>");
    expect(renderMarkdownToHtml("### Sub-sub")).toBe("<h5>Sub-sub</h5>");
  });

  it("renders a `-`-prefixed run as a <ul> with one <li> per line", () => {
    expect(renderMarkdownToHtml("- A\n- B\n- C")).toBe(
      "<ul><li>A</li><li>B</li><li>C</li></ul>",
    );
  });

  it("renders a `1.`-prefixed run as an <ol>", () => {
    expect(renderMarkdownToHtml("1. First\n2. Second\n3. Third")).toBe(
      "<ol><li>First</li><li>Second</li><li>Third</li></ol>",
    );
  });

  it("inline-formats inside list items", () => {
    expect(renderMarkdownToHtml("- **A** done\n- *B* todo")).toBe(
      "<ul><li><strong>A</strong> done</li><li><em>B</em> todo</li></ul>",
    );
  });

  it("composes a heading + paragraph + list into one HTML string", () => {
    const md = "## Status\n\nOn track.\n\n- A\n- B";
    expect(renderMarkdownToHtml(md)).toBe(
      "<h4>Status</h4><p>On track.</p><ul><li>A</li><li>B</li></ul>",
    );
  });
});

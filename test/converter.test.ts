import { describe, it, expect } from "vitest";
import { extractArticle, htmlToMarkdown, buildMarkdown } from "../src/converter";

// ============ extractArticle ============

describe("extractArticle", () => {
  it("extracts title and content from article HTML", () => {
    const html = `
      <html>
        <head><title>Test Title</title></head>
        <body>
          <article>
            <h1>Main Heading</h1>
            <p>This is a paragraph with enough content to be considered an article by readability. 
               We need to add more text here so that Readability considers this content worth extracting.
               Adding more sentences to ensure the content is long enough for the algorithm.
               The readability algorithm needs substantial content to work properly.</p>
            <p>Another paragraph with additional content to make this look like a real article.
               More text is needed to pass the content length threshold of the readability parser.</p>
          </article>
        </body>
      </html>
    `;

    const result = extractArticle(html, "https://example.com/test");
    expect(result.title).toBeTruthy();
    expect(result.content).toBeTruthy();
  });

  it("falls back to body content when Readability fails", () => {
    const html = `
      <html>
        <head><title>Sparse Page</title></head>
        <body><p>Short</p></body>
      </html>
    `;

    const result = extractArticle(html, "https://example.com");
    expect(result.title).toBe("Sparse Page");
    expect(result.content).toContain("Short");
  });

  it("uses 'Untitled' when no title is present", () => {
    const html = "<html><body><p>No title</p></body></html>";

    const result = extractArticle(html, "https://example.com");
    expect(result.title).toBe("Untitled");
  });
});

// ============ htmlToMarkdown ============

describe("htmlToMarkdown", () => {
  it("converts headings", () => {
    const md = htmlToMarkdown("<h1>Title</h1><h2>Subtitle</h2>");
    expect(md).toContain("# Title");
    expect(md).toContain("## Subtitle");
  });

  it("converts paragraphs", () => {
    const md = htmlToMarkdown("<p>Hello world</p>");
    expect(md).toContain("Hello world");
  });

  it("converts links", () => {
    const md = htmlToMarkdown('<a href="https://example.com">Link</a>');
    expect(md).toContain("[Link](https://example.com)");
  });

  it("converts images", () => {
    const md = htmlToMarkdown('<img src="img.png" alt="photo">');
    expect(md).toContain("![photo](img.png)");
  });

  it("converts code blocks", () => {
    const md = htmlToMarkdown("<pre><code>const x = 1;</code></pre>");
    expect(md).toContain("```");
    expect(md).toContain("const x = 1;");
  });

  it("converts unordered lists", () => {
    const md = htmlToMarkdown("<ul><li>A</li><li>B</li></ul>");
    expect(md).toContain("- A");
    expect(md).toContain("- B");
  });

  it("converts tables", () => {
    const md = htmlToMarkdown(
      "<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>"
    );
    expect(md).toContain("Name");
    expect(md).toContain("Alice");
    expect(md).toContain("|");
  });
});

// ============ buildMarkdown ============

describe("buildMarkdown", () => {
  it("includes title as h1", () => {
    const md = buildMarkdown("My Title", "https://example.com", "Content");
    expect(md).toContain("# My Title");
  });

  it("includes source URL as blockquote", () => {
    const md = buildMarkdown("T", "https://example.com", "C");
    expect(md).toContain("> 来源: [https://example.com](https://example.com)");
  });

  it("includes separator", () => {
    const md = buildMarkdown("T", "https://example.com", "C");
    expect(md).toContain("---");
  });

  it("trims content whitespace", () => {
    const md = buildMarkdown("T", "https://example.com", "  content  ");
    expect(md).toContain("content");
    expect(md).not.toContain("  content  ");
  });

  it("produces correct structure order", () => {
    const md = buildMarkdown("Title", "https://x.com", "Body");
    const lines = md.split("\n");
    expect(lines[0]).toBe("# Title");
    expect(lines[2]).toContain("来源");
    expect(lines[4]).toBe("---");
    expect(lines[6]).toBe("Body");
  });
});

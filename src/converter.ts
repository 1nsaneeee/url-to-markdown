/**
 * 核心转换逻辑
 * 独立于 VS Code API（除了 Progress 回调），方便单元测试
 */
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { NodeHtmlMarkdown } from "node-html-markdown";
import {
  NetworkError,
  TimeoutError,
  HttpError,
  ParseError,
  parseCharsetFromContentType,
  detectCharsetFromHtml,
  normalizeCharset,
} from "./utils";

const DEFAULT_TIMEOUT_MS = 15_000;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export interface ProgressReporter {
  report(value: { message?: string; increment?: number }): void;
}

export interface ConvertResult {
  title: string;
  markdown: string;
}

/**
 * 抓取网页 HTML 内容（带超时 + 编码处理 + 进度报告）
 */
export async function fetchPage(
  url: string,
  progress?: ProgressReporter
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error: unknown) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(DEFAULT_TIMEOUT_MS);
    }
    throw new NetworkError("网络请求失败", error);
  }

  clearTimeout(timer);

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText);
  }

  // 读取为 ArrayBuffer 以支持非 UTF-8 编码
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null;

  // 流式读取以报告进度
  const reader = response.body?.getReader();
  if (!reader) {
    throw new NetworkError("无法读取响应内容");
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    receivedBytes += value.length;

    if (progress) {
      if (totalBytes && totalBytes > 0) {
        const percent = Math.round((receivedBytes / totalBytes) * 100);
        progress.report({ message: `正在下载... ${percent}%` });
      } else {
        const kb = Math.round(receivedBytes / 1024);
        progress.report({ message: `已下载 ${kb}KB...` });
      }
    }
  }

  // 合并 chunks
  const buffer = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  // 编码检测与解码
  let charset = parseCharsetFromContentType(contentType);
  if (!charset) {
    charset = detectCharsetFromHtml(buffer.buffer);
  }

  if (charset && charset !== "utf-8" && charset !== "utf8") {
    const normalized = normalizeCharset(charset);
    try {
      return new TextDecoder(normalized).decode(buffer);
    } catch {
      // TextDecoder 不支持该编码，回退 UTF-8
      return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    }
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

/**
 * 使用 Readability 提取文章正文
 */
export function extractArticle(
  html: string,
  url: string
): { title: string; content: string } {
  let dom: JSDOM;
  try {
    dom = new JSDOM(html, { url });
  } catch (error) {
    throw new ParseError("HTML 解析失败", error);
  }

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    // Readability 无法解析时，回退到 body 内容
    const rawTitle = dom.window.document.title?.trim();
    const title = rawTitle || "Untitled";
    const content = dom.window.document.body?.innerHTML || html;
    return { title, content };
  }

  return {
    title: article.title?.trim() || dom.window.document.title?.trim() || "Untitled",
    content: article.content,
  };
}

/**
 * 将 HTML 转换为 Markdown
 */
export function htmlToMarkdown(html: string): string {
  const nhm = new NodeHtmlMarkdown({
    codeBlockStyle: "fenced",
    bulletMarker: "-",
    maxConsecutiveNewlines: 2,
  });
  return nhm.translate(html);
}

/**
 * 构建最终 Markdown 文档
 */
export function buildMarkdown(
  title: string,
  sourceUrl: string,
  content: string
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> 来源: [${sourceUrl}](${sourceUrl})`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(content.trim());
  lines.push("");

  return lines.join("\n");
}

/**
 * 完整转换流程：fetch → extract → convert → build
 */
export async function convertUrl(
  url: string,
  progress?: ProgressReporter
): Promise<ConvertResult> {
  progress?.report({ message: "正在获取页面..." });
  const html = await fetchPage(url, progress);

  progress?.report({ message: "正在提取正文..." });
  const article = extractArticle(html, url);

  progress?.report({ message: "正在转换为 Markdown..." });
  const markdownContent = htmlToMarkdown(article.content);
  const markdown = buildMarkdown(article.title, url, markdownContent);

  return {
    title: article.title,
    markdown,
  };
}

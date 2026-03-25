import { describe, it, expect } from "vitest";
import {
  isValidUrl,
  validateUrlInput,
  sanitizeFilename,
  parseCharsetFromContentType,
  detectCharsetFromHtml,
  normalizeCharset,
  getErrorMessage,
  NetworkError,
  TimeoutError,
  HttpError,
  ParseError,
} from "../src/utils";

// ============ URL 验证 ============

describe("isValidUrl", () => {
  it("accepts valid http URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("https://example.com/path?q=1#hash")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("validateUrlInput", () => {
  it("returns null for valid URLs", () => {
    expect(validateUrlInput("https://example.com")).toBeNull();
  });

  it("returns error for empty input", () => {
    expect(validateUrlInput("")).toBe("请输入网址");
  });

  it("returns error for invalid URLs", () => {
    expect(validateUrlInput("not-a-url")).toBe(
      "请输入有效的网址（以 http:// 或 https:// 开头）"
    );
  });
});

// ============ 文件名 ============

describe("sanitizeFilename", () => {
  it("removes illegal characters", () => {
    expect(sanitizeFilename('file:name<>|"test')).toBe("filenametest");
  });

  it("replaces spaces with hyphens", () => {
    expect(sanitizeFilename("hello world test")).toBe("hello-world-test");
  });

  it("collapses multiple hyphens", () => {
    expect(sanitizeFilename("a---b")).toBe("a-b");
  });

  it("trims leading/trailing hyphens", () => {
    expect(sanitizeFilename("---hello---")).toBe("hello");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeFilename(long).length).toBe(100);
  });

  it("returns 'untitled' for empty result", () => {
    expect(sanitizeFilename(":::")).toBe("untitled");
  });
});

// ============ 编码检测 ============

describe("parseCharsetFromContentType", () => {
  it("extracts charset from content-type header", () => {
    expect(
      parseCharsetFromContentType("text/html; charset=utf-8")
    ).toBe("utf-8");
    expect(
      parseCharsetFromContentType("text/html; charset=GBK")
    ).toBe("gbk");
  });

  it("returns null when no charset", () => {
    expect(parseCharsetFromContentType("text/html")).toBeNull();
    expect(parseCharsetFromContentType(null)).toBeNull();
  });
});

describe("detectCharsetFromHtml", () => {
  function toBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str).buffer;
  }

  it("detects <meta charset>", () => {
    expect(
      detectCharsetFromHtml(toBuffer('<html><head><meta charset="gbk">'))
    ).toBe("gbk");
  });

  it("detects <meta http-equiv Content-Type>", () => {
    const html =
      '<meta http-equiv="Content-Type" content="text/html; charset=gb2312">';
    expect(detectCharsetFromHtml(toBuffer(html))).toBe("gb2312");
  });

  it("returns null when no meta charset", () => {
    expect(
      detectCharsetFromHtml(toBuffer("<html><head><title>test</title>"))
    ).toBeNull();
  });
});

describe("normalizeCharset", () => {
  it("maps gb2312 to gbk", () => {
    expect(normalizeCharset("gb2312")).toBe("gbk");
    expect(normalizeCharset("GB2312")).toBe("gbk");
  });

  it("maps gb18030 to gbk", () => {
    expect(normalizeCharset("gb18030")).toBe("gbk");
  });

  it("maps latin1 to windows-1252", () => {
    expect(normalizeCharset("latin1")).toBe("windows-1252");
  });

  it("passes through unknown charsets", () => {
    expect(normalizeCharset("utf-8")).toBe("utf-8");
    expect(normalizeCharset("euc-kr")).toBe("euc-kr");
  });
});

// ============ 错误消息 ============

describe("getErrorMessage", () => {
  it("formats TimeoutError", () => {
    expect(getErrorMessage(new TimeoutError(15000))).toBe(
      "请求超时（15秒），请稍后重试"
    );
  });

  it("formats HttpError 404", () => {
    expect(getErrorMessage(new HttpError(404, "Not Found"))).toBe(
      "页面不存在（404）"
    );
  });

  it("formats HttpError 403", () => {
    expect(getErrorMessage(new HttpError(403, "Forbidden"))).toBe(
      "访问被拒绝（403）"
    );
  });

  it("formats HttpError generic", () => {
    expect(getErrorMessage(new HttpError(502, "Bad Gateway"))).toBe(
      "网关错误（502）"
    );
  });

  it("formats NetworkError", () => {
    expect(getErrorMessage(new NetworkError("fail"))).toBe(
      "网络连接失败，请检查网络设置"
    );
  });

  it("formats ParseError", () => {
    expect(getErrorMessage(new ParseError("fail"))).toBe(
      "页面内容解析失败，该页面可能不包含可提取的文章内容"
    );
  });

  it("handles unknown errors", () => {
    expect(getErrorMessage("string error")).toBe("发生未知错误");
  });
});

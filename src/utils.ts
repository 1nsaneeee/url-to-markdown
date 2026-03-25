/**
 * 自定义错误类型 & 工具函数
 * 独立于 VS Code API，方便单元测试
 */

// ============ 错误类型 ============

export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`请求超时（${Math.round(timeoutMs / 1000)}秒）`);
    this.name = "TimeoutError";
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
  }
}

export class ParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ParseError";
  }
}

// ============ 错误消息映射 ============

export function getErrorMessage(error: unknown): string {
  if (error instanceof TimeoutError) {
    return `请求超时（${Math.round(error.timeoutMs / 1000)}秒），请稍后重试`;
  }

  if (error instanceof HttpError) {
    switch (error.status) {
      case 404:
        return "页面不存在（404）";
      case 403:
        return "访问被拒绝（403）";
      case 401:
        return "需要登录认证（401）";
      case 500:
        return "服务器内部错误（500）";
      case 502:
        return "网关错误（502）";
      case 503:
        return "服务暂不可用（503）";
      default:
        return `服务器返回错误：${error.status} ${error.statusText}`;
    }
  }

  if (error instanceof NetworkError) {
    return "网络连接失败，请检查网络设置";
  }

  if (error instanceof ParseError) {
    return "页面内容解析失败，该页面可能不包含可提取的文章内容";
  }

  if (error instanceof Error) {
    return `未知错误：${error.message}`;
  }

  return "发生未知错误";
}

// ============ URL 验证 ============

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateUrlInput(value: string): string | null {
  if (!value) {
    return "请输入网址";
  }
  if (!isValidUrl(value)) {
    return "请输入有效的网址（以 http:// 或 https:// 开头）";
  }
  return null;
}

// ============ 文件名工具 ============

/**
 * 将标题转为安全的文件名
 */
export function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "untitled";
}

// ============ 编码检测 ============

/**
 * 从 Content-Type header 中提取 charset
 */
export function parseCharsetFromContentType(
  contentType: string | null
): string | null {
  if (!contentType) {
    return null;
  }
  const match = contentType.match(/charset=([^\s;]+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

/**
 * 从 HTML <meta> 标签中检测 charset
 */
export function detectCharsetFromHtml(buffer: ArrayBuffer): string | null {
  // 先用 ASCII 解码前 4KB 来查找 meta 标签
  const preview = new TextDecoder("ascii", { fatal: false }).decode(
    buffer.slice(0, 4096)
  );

  // <meta charset="xxx">
  const charsetMeta = preview.match(/<meta\s+charset=["']?([^"'\s>]+)/i);
  if (charsetMeta) {
    return charsetMeta[1].toLowerCase();
  }

  // <meta http-equiv="Content-Type" content="text/html; charset=xxx">
  const httpEquiv = preview.match(
    /<meta\s+http-equiv=["']?Content-Type["']?\s+content=["'][^"']*charset=([^"'\s;]+)/i
  );
  if (httpEquiv) {
    return httpEquiv[1].toLowerCase();
  }

  return null;
}

/**
 * 标准化 charset 名称（用于 TextDecoder）
 */
export function normalizeCharset(charset: string): string {
  const map: Record<string, string> = {
    gb2312: "gbk",
    gb18030: "gbk",
    "x-gbk": "gbk",
    "chinese": "gbk",
    "euc-cn": "gbk",
    "shift-jis": "shift_jis",
    "x-sjis": "shift_jis",
    "ks_c_5601-1987": "euc-kr",
    "iso-8859-1": "windows-1252",
    latin1: "windows-1252",
  };
  const lower = charset.toLowerCase().trim();
  return map[lower] || lower;
}

import * as vscode from "vscode";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { NodeHtmlMarkdown } from "node-html-markdown";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "url-to-markdown.convert",
    async () => {
      // 1. 让用户输入 URL
      const url = await vscode.window.showInputBox({
        prompt: "输入要转换的网址",
        placeHolder: "https://example.com/article",
        validateInput: (value) => {
          if (!value) {
            return "请输入网址";
          }
          try {
            new URL(value);
            return null;
          } catch {
            return "请输入有效的网址";
          }
        },
      });

      if (!url) {
        return;
      }

      // 2. 显示加载进度
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "正在转换...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "正在获取页面..." });

          // 3. 抓取页面 HTML
          const html = await fetchPage(url);

          progress.report({ message: "正在提取正文..." });

          // 4. 用 Readability 提取正文
          const article = extractArticle(html, url);

          progress.report({ message: "正在转换为 Markdown..." });

          // 5. 将 HTML 转为 Markdown
          const nhm = new NodeHtmlMarkdown({
            codeBlockStyle: "fenced",
            bulletMarker: "-",
            maxConsecutiveNewlines: 2,
          });

          const title = article.title;
          const contentHtml = article.content;
          const markdown = buildMarkdown(title, url, nhm.translate(contentHtml));

          // 6. 在新编辑器中打开
          const doc = await vscode.workspace.openTextDocument({
            content: markdown,
            language: "markdown",
          });

          await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active,
          });

          vscode.window.showInformationMessage("转换完成！");
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * 抓取网页 HTML 内容
 */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * 使用 Readability 提取文章正文
 */
function extractArticle(
  html: string,
  url: string
): { title: string; content: string } {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    // Readability 无法解析时，回退到 body 内容
    return {
      title: dom.window.document.title || "Untitled",
      content: dom.window.document.body?.innerHTML || html,
    };
  }

  return {
    title: article.title,
    content: article.content,
  };
}

/**
 * 构建最终 Markdown 文档
 */
function buildMarkdown(
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

export function deactivate() {}

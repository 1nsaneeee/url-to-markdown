import * as vscode from "vscode";
import * as path from "path";
import { convertUrl } from "./converter";
import { HistoryManager } from "./history";
import { validateUrlInput, isValidUrl, sanitizeFilename, getErrorMessage } from "./utils";

let historyManager: HistoryManager;

export function activate(context: vscode.ExtensionContext) {
  historyManager = new HistoryManager(context.globalState);

  // 命令 1：输入 URL 转换
  context.subscriptions.push(
    vscode.commands.registerCommand("url-to-markdown.convert", () =>
      convertFromInput()
    )
  );

  // 命令 2：选中文本转换
  context.subscriptions.push(
    vscode.commands.registerCommand("url-to-markdown.convertSelection", () =>
      convertFromSelection()
    )
  );

  // 命令 3：历史记录
  context.subscriptions.push(
    vscode.commands.registerCommand("url-to-markdown.history", () =>
      showHistory()
    )
  );
}

// ============ 命令处理 ============

async function convertFromInput(): Promise<void> {
  const url = await vscode.window.showInputBox({
    prompt: "输入要转换的网址",
    placeHolder: "https://example.com/article",
    validateInput: validateUrlInput,
  });

  if (!url) {
    return;
  }

  await doConvert(url);
}

async function convertFromSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("没有活动的编辑器");
    return;
  }

  const selection = editor.selection;
  const text = editor.document.getText(selection).trim();

  if (!text) {
    vscode.window.showWarningMessage("请先选中一个网址");
    return;
  }

  if (!isValidUrl(text)) {
    vscode.window.showWarningMessage(`"${text}" 不是有效的网址`);
    return;
  }

  await doConvert(text);
}

async function showHistory(): Promise<void> {
  const entries = historyManager.getAll();

  if (entries.length === 0) {
    vscode.window.showInformationMessage("暂无转换历史");
    return;
  }

  const items: vscode.QuickPickItem[] = entries.map((entry) => ({
    label: entry.url,
    description: entry.title,
    detail: new Date(entry.timestamp).toLocaleString("zh-CN"),
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "选择一个网址重新转换",
    matchOnDescription: true,
  });

  if (selected) {
    await doConvert(selected.label);
  }
}

// ============ 核心转换流程 ============

async function doConvert(url: string): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "URL to Markdown",
        cancellable: false,
      },
      async (progress) => {
        const result = await convertUrl(url, progress);

        // 记录历史
        await historyManager.add(url, result.title);

        // 让用户选择输出方式
        await handleOutput(result.title, result.markdown);

        vscode.window.showInformationMessage("转换完成！");
      }
    );
  } catch (error: unknown) {
    vscode.window.showErrorMessage(getErrorMessage(error));
  }
}

// ============ 输出处理 ============

async function handleOutput(title: string, markdown: string): Promise<void> {
  const hasWorkspace =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0;

  if (!hasWorkspace) {
    // 没有工作区，直接在编辑器中打开
    await openInEditor(markdown);
    return;
  }

  const choice = await vscode.window.showQuickPick(
    [
      { label: "$(file) 在编辑器中打开", value: "editor" },
      { label: "$(save) 保存为文件", value: "save" },
    ],
    { placeHolder: "选择输出方式" }
  );

  if (!choice || choice.value === "editor") {
    await openInEditor(markdown);
  } else {
    await saveToFile(title, markdown);
  }
}

async function openInEditor(markdown: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: markdown,
    language: "markdown",
  });

  await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Active,
  });
}

async function saveToFile(title: string, markdown: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    // 回退到 Save As 对话框
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${sanitizeFilename(title)}.md`),
      filters: { Markdown: ["md"] },
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, "utf-8"));
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
    return;
  }

  const filename = `${sanitizeFilename(title)}.md`;
  const filePath = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, filename)
  );

  // 检查文件是否已存在
  try {
    await vscode.workspace.fs.stat(filePath);
    // 文件存在，询问覆盖
    const overwrite = await vscode.window.showWarningMessage(
      `文件 "${filename}" 已存在，是否覆盖？`,
      "覆盖",
      "取消"
    );
    if (overwrite !== "覆盖") {
      // 改为在编辑器中打开
      await openInEditor(markdown);
      return;
    }
  } catch {
    // 文件不存在，继续
  }

  await vscode.workspace.fs.writeFile(filePath, Buffer.from(markdown, "utf-8"));
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}

export function deactivate() {}

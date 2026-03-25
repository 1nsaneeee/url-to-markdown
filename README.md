# URL to Markdown

一个 VS Code 扩展，输入网址即可将网页内容转换为干净的 Markdown 格式。

## 功能

- 🔗 输入任意网址，自动抓取页面内容
- 📄 智能提取正文（自动去除导航栏、广告、页脚等干扰内容）
- ✨ 转换为标准 Markdown，支持：
  - 标题层级（h1-h6）
  - 图片
  - 超链接
  - 代码块
  - 表格

## 使用方法

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `Convert URL to Markdown`
3. 粘贴网址，回车
4. 转换结果会在新标签页中打开

![demo](https://img.shields.io/badge/VS_Code-Extension-blue?logo=visualstudiocode)

## 安装

### 从 GitHub Release 安装

1. 前往 [Releases](https://github.com/1nsaneeee/url-to-markdown/releases) 下载最新的 `.vsix` 文件
2. 在 VS Code 中按 `Ctrl+Shift+P` → 输入 `Install from VSIX`
3. 选择下载的 `.vsix` 文件

### 从源码构建

```bash
git clone https://github.com/1nsaneeee/url-to-markdown.git
cd url-to-markdown
npm install
npm run compile
```

按 `F5` 启动调试。

## 技术栈

| 组件 | 库 | 用途 |
|------|-----|------|
| 正文提取 | [@mozilla/readability](https://github.com/mozilla/readability) | Firefox 阅读模式同款引擎，智能提取文章正文 |
| HTML → Markdown | [node-html-markdown](https://github.com/crosstype/node-html-markdown) | 高性能 HTML 转 Markdown，原生支持表格 |
| DOM 解析 | [jsdom](https://github.com/jsdom/jsdom) | Node.js 环境下的 DOM 实现 |

## License

[MIT](LICENSE)

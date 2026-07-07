# AyWebPDFRender.js

本文介绍基于 PDF.js 为 Scratch 3.0 开发的 PDF 查看器扩展，提供文件上传、分页浏览、页码查询以及图片数据输出等功能，使 Scratch 项目能够直接集成 PDF 内容。

<!-- more -->

## 简介

AyWebPDFRender 是一款为 Scratch 3.0 设计的扩展程序，通过封装 PDF.js 渲染引擎，将 PDF 文件的解析、浏览和截图能力以积木块的形式开放给 Scratch 用户。扩展本身不依赖任何外部 UI 组件，所有交互由积木触发，适合教育场景、互动课件及数据展示项目。

## 主要功能

- **一键上传**：通过积木弹出文件选择对话框，支持本地 PDF 文件加载。
- **页码导航**：提供“下一页”、“上一页”和“跳转到指定页”积木，支持随意翻页。
- **信息查询**：可实时获取当前页码、总页数、文件名及文件大小。
- **图片输出**：将当前页渲染为 Base64 编码的 PNG 图片，可直接用于舞台展示或传递给其他扩展。
- **错误处理**：加载或渲染失败时弹出明确提示，避免项目静默崩溃。

## 技术实现

### 1. 动态加载 PDF.js 与 Worker

扩展采用按需加载策略，仅在首次调用时从 CDN 获取 PDF.js 核心库和 Worker 文件，减少初始加载体积。

```javascript
_loadPDFJS() {
  if (window.pdfjsLib) return;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload = () => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  };
  document.head.appendChild(script);
}
```

### 2. 积木定义与注册

通过 `getInfo` 方法向 Scratch 注册积木，区分命令块（COMMAND）和报告器块（REPORTER）。共 9 个积木，覆盖 PDF 浏览全流程。

```javascript
getInfo() {
  return {
    id: 'aypdfviewer',
    name: 'AyWebPDFRender',
    blocks: [
      { opcode: 'uploadPDF', blockType: Scratch.BlockType.COMMAND, text: '上传 PDF 文件并加载' },
      { opcode: 'showPage', blockType: Scratch.BlockType.COMMAND, text: '显示第 [PAGE] 页', arguments: { PAGE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 } } },
      // 其他积木（下一页、上一页、获取当前页码、总页数、文件名、文件大小、当前页图片）
    ]
  };
}
```

### 3. 文件上传与 PDF 解析

`uploadPDF` 方法动态创建 `<input type="file">` 触发文件选择，使用 `FileReader` 读取 ArrayBuffer，并调用 PDF.js 的 `getDocument` 方法解析文档。成功后自动保存文件名和大小（单位 KB），并渲染第一页。

```javascript
uploadPDF() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    this._pdfDoc = await loadingTask.promise;
    this._currentPage = 1;
    await this._renderPage(this._currentPage);
  };
  input.click();
}
```

### 4. 页面渲染与 Base64 缓存

使用 Canvas 绘制 PDF 页面，渲染比例（scale）固定为 1.8，兼顾清晰度与性能。渲染完成后将图片转为 Base64 字符串（去除前缀）并缓存，后续翻页无需重复渲染，直接返回缓存数据。

```javascript
async _renderPage(pageNum) {
  const page = await this._pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.8 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  this._currentPageImage = canvas.toDataURL('image/png').split(',')[1];
}
```

### 5. 页码导航与边界控制

所有翻页方法（`nextPage`、`prevPage`、`showPage`）均对输入页码进行边界校验，自动限制在 1 至总页数之间，避免越界错误。

```javascript
async showPage(args) {
  const pageNum = Math.min(Math.max(args.PAGE, 1), this._pdfDoc.numPages);
  this._currentPage = pageNum;
  await this._renderPage(pageNum);
}
```

### 6. 异常处理与用户反馈

在文件加载、页面解析、渲染等关键步骤中使用 `try...catch` 捕获异常，并通过 `alert` 弹出具体错误信息，帮助用户定位问题（如文件损坏、网络中断等）。

```javascript
try {
  // 核心操作
} catch (err) {
  alert("渲染第 " + pageNum + " 页失败：" + err.message);
}
```

## 在 Scratch 中使用

- 加载扩展：在 Scratch 编辑器中通过“加载扩展”功能导入该 JS 文件（本地或 URL）。
- 积木位置：加载成功后，积木将出现在“我的模块”分类下。
- 典型流程：先调用“上传 PDF”积木，再使用翻页积木浏览，最后通过“当前页图片”获取 Base64 数据，配合“从 URL 加载造型”积木将图片显示在舞台上。

## 技术参数

- 核心依赖：PDF.js 3.11.174（动态加载）
- 运行环境：Scratch 3.0（Web 端）
- 积木数量：9 个（5 个命令，4 个报告器）
- 渲染方式：Canvas 2D，输出 PNG Base64
- 缓存策略：单页缓存，翻页时刷新
- 错误反馈：浏览器原生 Alert

## 开源与许可

- 开源协议：MIT
- 源码仓库：[https://github.com/AeYunDian/ay-pdf-render](https://github.com/AeYunDian/ay-pdf-render)
- CDN 引用地址：[https://net.undz.cn/static/js/2090f9af4850100768f3a4e62b7e2fa3.js](https://net.undz.cn/static/js/2090f9af4850100768f3a4e62b7e2fa3.js)

## 相关资源

- [PDF.js 官方文档](https://mozilla.github.io/pdf.js/)
- [Scratch 扩展开发文档](https://scratch.mit.edu/developers)

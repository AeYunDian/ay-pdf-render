class PDFViewerExtension {
  constructor() {
    this._pdfDoc = null;           // PDF文档对象
    this._currentPage = 1;         // 当前页码
    this._loading = false;         // 加载状态
    this._currentPageImage = '';   // 当前页的纯 Base64 图片数据
    this._fileName = '';           // 上传的文件名
    this._fileSize = '';           // 文件大小（KB）
    // 动态加载 PDF.js 及 Worker
    this._loadPDFJS();
  }

  // 加载 PDF.js 核心库和 Worker
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

  // 扩展元数据（积木块定义）
  getInfo() {
    return {
      id: 'aypdfviewer',
      name: 'AyWebPDFRender',
      blocks: [
        // ===== 命令积木 =====
        {
          opcode: 'uploadPDF',
          blockType: Scratch.BlockType.COMMAND,
          text: '上传 PDF 文件并加载'
        },
        {
          opcode: 'showPage',
          blockType: Scratch.BlockType.COMMAND,
          text: '显示第 [PAGE] 页',
          arguments: {
            PAGE: {
              type: Scratch.ArgumentType.NUMBER,
              defaultValue: 1
            }
          }
        },
        {
          opcode: 'nextPage',
          blockType: Scratch.BlockType.COMMAND,
          text: '下一页'
        },
        {
          opcode: 'prevPage',
          blockType: Scratch.BlockType.COMMAND,
          text: '上一页'
        },

        // ===== 报告器积木（文件信息） =====
        {
          opcode: 'getFileName',
          blockType: Scratch.BlockType.REPORTER,
          text: '文件名'
        },
        {
          opcode: 'getFileSize',
          blockType: Scratch.BlockType.REPORTER,
          text: '文件大小'
        },
        {
          opcode: 'getCurrentPage',
          blockType: Scratch.BlockType.REPORTER,
          text: '当前页码'
        },
        {
          opcode: 'getPageCount',
          blockType: Scratch.BlockType.REPORTER,
          text: '总页数'
        },
        {
          opcode: 'getCurrentPageImage',
          blockType: Scratch.BlockType.REPORTER,
          text: '当前页图片 (base64)'
        }
      ]
    };
  }

  // ---------- 积木实现 ----------

  // 1. 上传PDF
  uploadPDF(args, util) {
    if (this._loading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this._loading = true;
      try {
        // 保存文件信息
        this._fileName = file.name;
        const sizeInBytes = file.size;
        this._fileSize = (sizeInBytes / 1024).toFixed(1) + ' KB'; // 例如 "124.5 KB"

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        this._pdfDoc = await loadingTask.promise;
        this._currentPage = 1;
        // 加载成功后渲染第一页，并保存 Base64
        await this._renderPage(this._currentPage);
      } catch (err) {
        alert('pdf加载错误，' + err.message);
      } finally {
        this._loading = false;
        document.body.removeChild(input);
      }
    };
    input.click();
  }

  // 2. 显示指定页
  async showPage(args) {
    if (!this._pdfDoc) return;
    const pageNum = Math.min(Math.max(args.PAGE, 1), this._pdfDoc.numPages);
    this._currentPage = pageNum;
    await this._renderPage(pageNum);
  }

  // 3. 下一页
  async nextPage() {
    if (!this._pdfDoc || this._currentPage >= this._pdfDoc.numPages) return;
    this._currentPage++;
    await this._renderPage(this._currentPage);
  }

  // 4. 上一页
  async prevPage() {
    if (!this._pdfDoc || this._currentPage <= 1) return;
    this._currentPage--;
    await this._renderPage(this._currentPage);
  }

  // ===== 报告器方法 =====
  getFileName() {
    return this._fileName || '';
  }

  getFileSize() {
    return this._fileSize || '';
  }

  getCurrentPage() {
    return this._currentPage;
  }

  getPageCount() {
    return this._pdfDoc ? this._pdfDoc.numPages : 0;
  }

  getCurrentPageImage() {
    return 'data:image/png;base64,' + this._currentPageImage || '';
  }

  // ---------- 核心渲染方法（只渲染，不添加造型）----------
  async _renderPage(pageNum) {
    if (!this._pdfDoc) return;

    try {
      const page = await this._pdfDoc.getPage(pageNum);
      const scale = 1.8;
      const viewport = page.getViewport({ scale });
      if (viewport.width <= 0 || viewport.height <= 0) throw new Error('页面尺寸无效');

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataURL = canvas.toDataURL('image/png');
      if (dataURL.length < 100) throw new Error('图像数据过短');

      const base64Data = dataURL.split(',')[1];
      if (!base64Data) throw new Error('Base64 提取失败');

      this._currentPageImage = base64Data;
      console.log('✅ 第 ' + pageNum + ' 页图片已准备 (Base64 长度: ' + base64Data.length + ')');

    } catch (err) {
      alert('渲染第 ' + pageNum + ' 页失败：' + err.message);
      console.error(err);
    }
  }
}

// 注册扩展
Scratch.extensions.register(new PDFViewerExtension());
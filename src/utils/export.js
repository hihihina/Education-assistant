export async function exportElementToPdf(element, title, options = {}) {
  if (!element) return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: options.backgroundColor || "#ffffff",
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  const imgData = canvas.toDataURL("image/png");

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${title}.pdf`);
}

export async function exportElementToWord(element, title) {
  if (!element) return;

  const styles = await collectDocumentStyles();

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        color: #15345b;
        background: #ffffff;
        font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      img {
        max-width: 100%;
      }
      ${styles}
    </style>
  </head>
  <body>
    ${element.outerHTML}
  </body>
</html>`;

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword",
  });

  downloadBlob(blob, `${title}.doc`);
}

async function collectDocumentStyles() {
  const inlineStyles = Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent || "")
    .join("\n");

  const linkedStyleUrls = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.href)
    .filter(Boolean);

  const linkedStyles = await Promise.all(
    linkedStyleUrls.map(async (href) => {
      try {
        const response = await fetch(href);
        return response.ok ? await response.text() : "";
      } catch (error) {
        return "";
      }
    })
  );

  return [inlineStyles, ...linkedStyles].filter(Boolean).join("\n");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

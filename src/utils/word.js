import mammoth from "mammoth/mammoth.browser";

const MAX_DOC_CHAR_COUNT = 12000;

export async function extractWordText(file) {
  if (!file) {
    throw new Error("未选择 Word 文档。");
  }

  const lowerName = String(file.name || "").toLowerCase();
  if (!lowerName.endsWith(".docx")) {
    throw new Error("当前仅支持 .docx 格式的 Word 文档，请先转换后再上传。");
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const normalizedText = normalizeWordText(result.value);

  if (!normalizedText) {
    throw new Error("未从 Word 文档中提取到可用文本。");
  }

  const truncated = normalizedText.length > MAX_DOC_CHAR_COUNT;
  const text = truncated
    ? `${normalizedText.slice(0, MAX_DOC_CHAR_COUNT)}\n\n[文档内容过长，已按前 ${MAX_DOC_CHAR_COUNT} 字截断]`
    : normalizedText;

  return {
    fileName: file.name,
    text,
    rawLength: normalizedText.length,
    truncated,
    warnings: (result.messages || []).map((item) => item.message).filter(Boolean),
  };
}

function normalizeWordText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0007/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

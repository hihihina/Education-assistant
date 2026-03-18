const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const MAX_SHEET_COUNT = 3;
const MAX_ROW_COUNT = 20;
const MAX_COLUMN_COUNT = 12;
const MAX_TEXT_LENGTH = 12000;

let xlsxRuntime = null;

export async function extractSpreadsheetText(file) {
  if (!file) {
    throw new Error("未选择 Excel 文件。");
  }

  const lowerName = String(file.name || "").toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    throw new Error("当前仅支持 .xlsx、.xls、.csv 格式的 Excel 文件。");
  }

  const XLSX = await getXLSX();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetNames = workbook.SheetNames || [];

  if (!sheetNames.length) {
    throw new Error("未从 Excel 文件中读取到工作表内容。");
  }

  let totalRows = 0;
  const sections = sheetNames.slice(0, MAX_SHEET_COUNT).map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    const rows = rawRows
      .map((row) => row.map((cell) => normalizeCell(cell)).slice(0, MAX_COLUMN_COUNT))
      .filter((row) => row.some(Boolean));

    totalRows += rows.length;

    const previewRows = rows.slice(0, MAX_ROW_COUNT);
    const previewText = previewRows
      .map((row, index) => `第 ${index + 1} 行：${row.map((cell) => cell || "--").join(" | ")}`)
      .join("\n");

    return [
      `工作表：${sheetName}`,
      `可识别行数：${rows.length}`,
      `预览列数：${Math.min(MAX_COLUMN_COUNT, Math.max(...rows.map((row) => row.length), 0))}`,
      previewText || "未识别到有效预览内容。",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const rawText = [
    `文件名：${file.name}`,
    `工作表数量：${sheetNames.length}`,
    `总预估行数：${totalRows}`,
    "",
    sections.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const normalizedText = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalizedText) {
    throw new Error("未从 Excel 文件中提取到可用内容。");
  }

  const truncated = normalizedText.length > MAX_TEXT_LENGTH;
  const text = truncated
    ? `${normalizedText.slice(0, MAX_TEXT_LENGTH)}\n\n[Excel 内容过长，已按前 ${MAX_TEXT_LENGTH} 字截断]`
    : normalizedText;

  return {
    fileName: file.name,
    text,
    rawLength: normalizedText.length,
    truncated,
    sheetNames,
  };
}

async function getXLSX() {
  if (!xlsxRuntime) {
    xlsxRuntime = await import("xlsx");
  }
  return xlsxRuntime;
}

function normalizeCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

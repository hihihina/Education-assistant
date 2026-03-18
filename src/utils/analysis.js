export const DISTRIBUTION_BANDS = [
  { key: "0-39", label: "0-39", min: 0, max: 39, level: "bad" },
  { key: "40-59", label: "40-59", min: 40, max: 59, level: "bad" },
  { key: "60-74", label: "60-74", min: 60, max: 74, level: "mid" },
  { key: "75-84", label: "75-84", min: 75, max: 84, level: "mid" },
  { key: "85-100", label: "85-100", min: 85, max: 100, level: "good" },
];

const SUBJECT_DEFINITIONS = [
  createSubjectDef("chinese", "语文", ["语文"], ["语文成绩", "语文学科", "语文得分", "语文总评"], ["语文老师", "语文班主任", "语文备注", "语文排名", "语文得分率", "语文平均"]),
  createSubjectDef("math", "数学", ["数学"], ["数学成绩", "数学学科", "数学得分", "数学总评"], ["数学老师", "数学班主任", "数学备注", "数学排名", "数学得分率", "数学平均"]),
  createSubjectDef("english", "英语", ["英语"], ["英语成绩", "英语学科", "英语得分", "英语总评"], ["英语老师", "英语班主任", "英语备注", "英语排名", "英语得分率", "英语平均"]),
  createSubjectDef("physics", "物理", ["物理"], ["物理成绩", "物理学科", "物理得分", "物理总评"], ["物理老师", "物理班主任", "物理备注", "物理排名", "物理得分率", "物理平均"]),
  createSubjectDef("chemistry", "化学", ["化学"], ["化学成绩", "化学学科", "化学得分", "化学总评"], ["化学老师", "化学班主任", "化学备注", "化学排名", "化学得分率", "化学平均"]),
  createSubjectDef("biology", "生物", ["生物"], ["生物成绩", "生物学科", "生物得分", "生物总评"], ["生物老师", "生物班主任", "生物备注", "生物排名", "生物得分率", "生物平均"]),
  createSubjectDef("history", "历史", ["历史"], ["历史成绩", "历史学科", "历史得分", "历史总评"], ["历史老师", "历史班主任", "历史备注", "历史排名", "历史得分率", "历史平均"]),
  createSubjectDef("politics", "政治", ["政治"], ["政治成绩", "政治学科", "政治得分", "政治总评"], ["政治老师", "政治班主任", "政治备注", "政治排名", "政治得分率", "政治平均"]),
  createSubjectDef("geography", "地理", ["地理"], ["地理成绩", "地理学科", "地理得分", "地理总评"], ["地理老师", "地理班主任", "地理备注", "地理排名", "地理得分率", "地理平均"]),
];

let xlsxRuntime = null;

export async function parseExcelFile(file) {
  const XLSX = await getXLSX();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const selectedSheetName = selectLargestSheet(workbook);
  const worksheet = workbook.Sheets[selectedSheetName];
  return buildDatasetFromWorksheet(worksheet, selectedSheetName, file.name);
}

export function getActiveRows(dataset) {
  return dataset ? dataset.rows.filter((row) => !row.excluded) : [];
}

export function getStudentProfile(dataset, studentId) {
  if (!dataset) return null;
  const targetRow = getActiveRows(dataset).find((row) => row.id === studentId);
  if (!targetRow) return null;

  const subjectRows = dataset.subjects
    .map((subject) => {
      const score = targetRow.scores[subject.key]?.score;
      if (!Number.isFinite(score)) return null;
      const summary = getSubjectSummary(dataset, subject.key);
      const rate = (score / subject.fullMark) * 100;
      return {
        subjectKey: subject.key,
        subjectLabel: subject.label,
        score,
        fullMark: subject.fullMark,
        rate,
        delta: score - summary.average,
        rank: summary.rows.find((row) => row.row.id === targetRow.id)?.rank || "--",
        averageRate: summary.averageRate,
        levelClass: rate >= 85 ? "good" : rate < 60 ? "bad" : "mid",
        levelLabel: rate >= 85 ? "优势" : rate < 60 ? "待提升" : "中等",
      };
    })
    .filter(Boolean);

  const totalScore = sum(subjectRows.map((row) => row.score));
  const totalFullMark = sum(subjectRows.map((row) => row.fullMark));
  const totalRate = totalFullMark ? (totalScore / totalFullMark) * 100 : 0;
  const totals = getActiveRows(dataset)
    .map((row) => ({
      rowId: row.id,
      total: sum(
        dataset.subjects.map((subject) => {
          const score = row.scores[subject.key]?.score;
          return Number.isFinite(score) ? score : 0;
        })
      ),
    }))
    .sort((a, b) => b.total - a.total);
  const balanceStd = standardDeviation(subjectRows.map((row) => row.rate));

  return {
    student: targetRow,
    subjectRows,
    totalScore,
    totalRate,
    totalRank: totals.findIndex((row) => row.rowId === targetRow.id) + 1,
    participantCount: totals.length,
    strongCount: subjectRows.filter((row) => row.rate >= 85).length,
    lowCount: subjectRows.filter((row) => row.rate < 60).length,
    balanceStd,
    balanceLabel: balanceStd <= 10 ? "均衡" : balanceStd <= 20 ? "一般" : "不均衡",
    subjectCount: subjectRows.length,
  };
}

export function getSubjectSummary(dataset, subjectKey) {
  if (!dataset) return null;
  const subject = dataset.subjects.find((item) => item.key === subjectKey);
  if (!subject) return null;

  const scoreRows = getActiveRows(dataset)
    .map((row) => {
      const score = row.scores[subject.key]?.score;
      if (!Number.isFinite(score)) return null;
      return { row, score, rate: (score / subject.fullMark) * 100 };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (!scoreRows.length) return null;

  const scores = scoreRows.map((item) => item.score);
  const average = mean(scores);
  const quartiles = calculateQuartiles(scores);
  const iqr = quartiles.q3 - quartiles.q1;
  const bands = DISTRIBUTION_BANDS.map((band) => {
    const bandRows = scoreRows.filter((item) => item.rate >= band.min && item.rate <= band.max);
    return { ...band, count: bandRows.length, ratio: scoreRows.length ? (bandRows.length / scoreRows.length) * 100 : 0 };
  });

  return {
    key: subject.key,
    label: subject.label,
    fullMark: subject.fullMark,
    rows: scoreRows.map((item, index) => {
      const band = bands.find((entry) => item.rate >= entry.min && item.rate <= entry.max) || bands[bands.length - 1];
      return {
        ...item,
        rank: index + 1,
        delta: item.score - average,
        student: buildStudentLabel(item.row),
        bandKey: band.key,
        bandLabel: item.rate >= 85 ? "优秀" : item.rate < 60 ? "待提升" : "中段",
        bandLevel: item.rate >= 85 ? "good" : item.rate < 60 ? "bad" : "mid",
      };
    }),
    average,
    averageRate: (average / subject.fullMark) * 100,
    max: { score: Math.max(...scores), student: buildStudentLabel(scoreRows[0].row) },
    min: { score: Math.min(...scores), student: buildStudentLabel(scoreRows[scoreRows.length - 1].row) },
    median: median(scores),
    stdDev: standardDeviation(scores),
    passRate: (scoreRows.filter((item) => item.rate >= 60).length / scoreRows.length) * 100,
    excellentRate: (scoreRows.filter((item) => item.rate >= 85).length / scoreRows.length) * 100,
    lowRate: (scoreRows.filter((item) => item.rate < 60).length / scoreRows.length) * 100,
    quartiles,
    outliers: scoreRows.filter((item) => item.score < quartiles.q1 - 1.5 * iqr || item.score > quartiles.q3 + 1.5 * iqr),
    bands,
  };
}

export function buildStudentLabel(row) {
  return row.code ? `${row.displayName} / ${row.code}` : row.displayName;
}

export function formatScore(value) {
  if (!Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? String(value) : roundTo(value, 2).toFixed(2);
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${roundTo(value, 1)}%`;
}

export function formatSigned(value) {
  if (!Number.isFinite(value)) return "--";
  const rounded = roundTo(value, 2);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

export function roundTo(value, precision) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function buildDatasetFromWorksheet(worksheet, sheetName, fileName) {
  const grid = worksheetToGrid(worksheet);
  if (!grid.length) {
    return { success: false, reasons: ["所选工作表中未读取到有效单元格。"] };
  }

  const headerStartIndex = findHeaderStartIndex(grid);
  const headerDepth = detectHeaderDepth(grid, headerStartIndex);
  const headers = buildHeaders(grid, headerStartIndex, headerDepth);
  const dataRows = buildDataRows(grid, headerStartIndex + headerDepth, headers.length);
  const allColumns = summarizeColumns(headers, dataRows);
  const filteredColumns = allColumns.filter(isPotentialDataColumn);
  const matchResult = matchColumns(filteredColumns, allColumns);

  if (!matchResult.success) {
    return { success: false, reasons: matchResult.reasons };
  }

  return {
    success: true,
    dataset: createDataset(matchResult, dataRows, {
      sheetName,
      fileName,
      headerStartIndex,
      headerDepth,
    }),
  };
}

function createDataset(matchResult, dataRows, meta) {
  const subjects = matchResult.subjectMatches.map((match) => ({
    key: match.definition.key,
    label: match.definition.label,
    columnIndex: match.index,
    header: match.header,
    fullMark: matchResult.inferredFullMarks[match.definition.key] || 100,
  }));

  const rows = dataRows.reduce((list, dataRow, rowIndex) => {
    const nameValue = matchResult.studentNameColumn ? dataRow.cells[matchResult.studentNameColumn.index] : "";
    const codeValue = matchResult.studentCodeColumn ? dataRow.cells[matchResult.studentCodeColumn.index] : "";
    const uniqueValue = matchResult.studentUniqueColumn ? dataRow.cells[matchResult.studentUniqueColumn.index] : "";
    const rawDisplayName = cleanText(nameValue) || cleanText(uniqueValue);
    const displayName = rawDisplayName || `未命名-${dataRow.rowNumber}`;
    const code = cleanText(codeValue);
    const scores = {};
    const issues = [];
    let hasAnyScore = false;

    subjects.forEach((subject) => {
      const rawValue = dataRow.cells[subject.columnIndex];
      const numeric = toNumber(rawValue);
      if (!cleanText(rawValue)) {
        scores[subject.key] = { raw: rawValue, score: null };
        issues.push({ subjectKey: subject.key, message: `${subject.label}成绩为空` });
        return;
      }
      if (Number.isNaN(numeric)) {
        scores[subject.key] = { raw: rawValue, score: null };
        issues.push({ subjectKey: subject.key, message: `${subject.label}成绩不是数值` });
        return;
      }
      hasAnyScore = true;
      scores[subject.key] = { raw: rawValue, score: numeric };
      if (numeric < 0) issues.push({ subjectKey: subject.key, message: `${subject.label}成绩为负数` });
      if (numeric > subject.fullMark) issues.push({ subjectKey: subject.key, message: `${subject.label}成绩超过推断满分 ${subject.fullMark}` });
    });

    if (!rawDisplayName && !code && !hasAnyScore) return list;

    list.push({
      id: `row-${rowIndex + 1}`,
      rowNumber: dataRow.rowNumber,
      displayName,
      code,
      uniqueValue,
      scores,
      issues,
      excluded: false,
    });
    return list;
  }, []);

  return {
    ...meta,
    rows,
    subjects,
    selectedStudentId: rows[0]?.id || "",
    selectedSubjectKey: subjects[0]?.key || "",
    matching: {
      studentNameHeader: matchResult.studentNameColumn?.header || "",
      studentCodeHeader: matchResult.studentCodeColumn?.header || "",
      studentUniqueHeader: matchResult.studentUniqueColumn?.header || "",
      subjectHeaders: subjects.map((subject) => ({
        key: subject.key,
        label: subject.label,
        header: subject.header,
        fullMark: subject.fullMark,
      })),
    },
  };
}

function matchColumns(filteredColumns, allColumns) {
  const reasons = [];
  const studentNameColumn = findBestIdentifierColumn(filteredColumns, ["姓名"], ["学生姓名"], ["家长", "班主任", "老师", "备注", "联系人"]);
  const studentCodeColumn = findBestIdentifierColumn(filteredColumns, ["学号"], ["考生号", "准考证号"], ["家长", "班主任", "老师", "备注", "联系人"]);
  const studentUniqueColumn =
    studentNameColumn ||
    studentCodeColumn ||
    findBestIdentifierColumn(filteredColumns, ["姓名", "学号"], ["学生姓名", "考生号", "准考证号"], ["家长", "班主任", "老师", "备注", "联系人"]);

  const subjectMatches = SUBJECT_DEFINITIONS.map((definition) => {
    const match = findBestSubjectColumn(filteredColumns, definition);
    return match ? { ...match, definition } : null;
  }).filter(Boolean);

  if (!studentUniqueColumn) reasons.push("未识别到满足唯一性与文本占比校验的学生姓名 / 学号字段。");
  if (!subjectMatches.length) reasons.push("未识别到至少 1 个满足数值校验规则的有效科目成绩列。");
  if (reasons.length) return { success: false, reasons };

  return {
    success: true,
    studentNameColumn,
    studentCodeColumn,
    studentUniqueColumn,
    subjectMatches,
    inferredFullMarks: inferSubjectFullMarks(subjectMatches, allColumns),
  };
}

function findBestIdentifierColumn(columns, coreWords, synonymWords, excludeWords) {
  return columns
    .map((column) => {
      const score = scoreHeader(column.headerNormalized, coreWords, synonymWords, excludeWords);
      if (!score) return null;
      if (!(column.textRatio >= 0.9 && column.uniqueRatio >= 0.85 && column.emptyRate < 0.1)) return null;
      return { ...column, matchScore: score };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore)[0] || null;
}

function findBestSubjectColumn(columns, definition) {
  return columns
    .map((column) => {
      const score = scoreHeader(column.headerNormalized, definition.core, definition.synonyms, definition.excludes);
      if (!score) return null;
      if (!(column.numericRatio >= 0.9 && column.emptyRate < 0.2)) return null;
      if (!column.numericValues.every((value) => value >= 0 && value <= 150)) return null;
      return { ...column, matchScore: score };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore)[0] || null;
}

function inferSubjectFullMarks(subjectMatches, allColumns) {
  const fullMarks = {};
  subjectMatches.forEach((subjectMatch) => {
    const subjectLabel = subjectMatch.definition.label;
    const candidate = allColumns.find((column) => {
      const header = column.headerNormalized;
      return (
        header.includes(normalizeHeader(subjectLabel)) &&
        /(满分|总分|卷面总分|分值|满分值)/.test(header) &&
        column.numericRatio >= 0.8 &&
        column.numericValues.length
      );
    });

    if (candidate) {
      fullMarks[subjectMatch.definition.key] = clampFullMark(mode(candidate.numericValues) || median(candidate.numericValues));
    } else {
      fullMarks[subjectMatch.definition.key] = inferStandardFullMark(Math.max(...subjectMatch.numericValues, 0));
    }
  });
  return fullMarks;
}

function scoreHeader(normalizedHeader, coreWords, synonymWords, excludeWords) {
  if (!normalizedHeader) return 0;
  if (excludeWords.some((word) => normalizedHeader.includes(normalizeHeader(word)))) return 0;
  if (coreWords.some((word) => normalizedHeader.includes(normalizeHeader(word)))) return 100;
  if (synonymWords.some((word) => normalizedHeader.includes(normalizeHeader(word)))) return 60;
  return 0;
}

function selectLargestSheet(workbook) {
  let bestName = workbook.SheetNames[0];
  let bestScore = -1;
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const cellKeys = Object.keys(worksheet || {}).filter((key) => !key.startsWith("!"));
    if (cellKeys.length > bestScore) {
      bestScore = cellKeys.length;
      bestName = sheetName;
    }
  });
  return bestName;
}

function worksheetToGrid(worksheet) {
  const ref = worksheet["!ref"];
  if (!ref) return [];
  const range = xlsxRuntime.utils.decode_range(ref);
  const rows = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      row.push(readWorksheetCell(worksheet, rowIndex, colIndex));
    }
    rows.push(row);
  }

  (worksheet["!merges"] || []).forEach((merge) => {
    const sourceValue = readWorksheetCell(worksheet, merge.s.r, merge.s.c);
    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex += 1) {
      for (let colIndex = merge.s.c; colIndex <= merge.e.c; colIndex += 1) {
        const row = rows[rowIndex - range.s.r];
        if (row) row[colIndex - range.s.c] = sourceValue;
      }
    }
  });

  return rows;
}

function readWorksheetCell(worksheet, rowIndex, colIndex) {
  const address = xlsxRuntime.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = worksheet[address];
  if (!cell) return "";
  return cell.w ?? cell.v ?? "";
}

function findHeaderStartIndex(grid) {
  const scanLimit = Math.min(grid.length, 20);
  for (let index = 0; index < scanLimit; index += 1) {
    const effectiveCount = (grid[index] || []).filter((value) => cleanText(value)).length;
    if (effectiveCount >= 3) return index;
  }
  return 0;
}

function detectHeaderDepth(grid, headerStartIndex) {
  for (let depth = 1; depth <= 3; depth += 1) {
    const nextRow = grid[headerStartIndex + depth];
    if (!nextRow) return depth;
    if (looksLikeDataRow(nextRow)) return depth;
  }
  return Math.min(3, Math.max(1, grid.length - headerStartIndex - 1));
}

function looksLikeDataRow(row) {
  const values = row.map(cleanText).filter(Boolean);
  if (!values.length) return false;
  const numericCount = values.filter((value) => !Number.isNaN(toNumber(value))).length;
  return numericCount / values.length >= 0.35;
}

function buildHeaders(grid, headerStartIndex, headerDepth) {
  const columnCount = Math.max(...grid.map((row) => row.length), 0);
  return Array.from({ length: columnCount }, (_, colIndex) => {
    const parts = [];
    for (let rowIndex = headerStartIndex; rowIndex < headerStartIndex + headerDepth; rowIndex += 1) {
      const text = cleanHeaderText(grid[rowIndex] ? grid[rowIndex][colIndex] : "");
      if (text && parts[parts.length - 1] !== text) parts.push(text);
    }
    return parts.join("_") || `未命名列${colIndex + 1}`;
  });
}

function buildDataRows(grid, dataStartIndex, columnCount) {
  return grid.slice(dataStartIndex).map((row, offset) => ({
    rowNumber: dataStartIndex + offset + 1,
    cells: Array.from({ length: columnCount }, (_, colIndex) => cleanText(row[colIndex])),
  }));
}

function summarizeColumns(headers, dataRows) {
  return headers.map((header, index) => {
    const values = dataRows.map((row) => row.cells[index] || "");
    const nonEmptyValues = values.filter(Boolean);
    const numericValues = nonEmptyValues.map(toNumber).filter((value) => !Number.isNaN(value));
    const textValues = nonEmptyValues.filter((value) => Number.isNaN(toNumber(value)));
    return {
      header,
      headerNormalized: normalizeHeader(header),
      index,
      values,
      nonEmptyValues,
      numericValues,
      emptyRate: values.length ? (values.length - nonEmptyValues.length) / values.length : 1,
      numericRatio: nonEmptyValues.length ? numericValues.length / nonEmptyValues.length : 0,
      textRatio: nonEmptyValues.length ? textValues.length / nonEmptyValues.length : 0,
      uniqueRatio: nonEmptyValues.length ? new Set(nonEmptyValues).size / nonEmptyValues.length : 0,
    };
  });
}

function isPotentialDataColumn(column) {
  if (column.emptyRate >= 0.5) return false;
  return column.numericRatio >= 0.5 || (column.textRatio >= 0.8 && column.uniqueRatio >= 0.7);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanHeaderText(value) {
  return cleanText(value).replace(/[：:]/g, "").replace(/\s+/g, "");
}

function normalizeHeader(value) {
  return cleanText(value).replace(/[：:\-_（）()\s]/g, "").toLowerCase();
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const text = cleanText(value).replace(/,/g, "");
  if (!text) return Number.NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function createSubjectDef(key, label, core, synonyms, excludes) {
  return { key, label, core, synonyms, excludes };
}

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(values) {
  if (!values.length) return null;
  const counts = new Map();
  values.forEach((value) => {
    const key = Math.round(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let best = null;
  let count = -1;
  counts.forEach((current, key) => {
    if (current > count) {
      best = key;
      count = current;
    }
  });
  return best;
}

function calculateQuartiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    q1: percentile(sorted, 25),
    median: percentile(sorted, 50),
    q3: percentile(sorted, 75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function percentile(sortedValues, percentileValue) {
  if (!sortedValues.length) return 0;
  const index = (percentileValue / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function inferStandardFullMark(maxScore) {
  const standards = [60, 70, 80, 90, 100, 120, 150];
  return standards.find((value) => maxScore <= value) || Math.ceil(maxScore / 10) * 10 || 100;
}

function clampFullMark(value) {
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 100;
}

async function getXLSX() {
  if (!xlsxRuntime) {
    xlsxRuntime = await import("xlsx");
  }
  return xlsxRuntime;
}

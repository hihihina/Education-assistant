const SUBJECT_NAMES = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "政治", "地理"];
const GRADE_PATTERNS = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "七年级", "八年级", "九年级", "高一", "高二", "高三", "初一", "初二", "初三"];
const BLUEPRINT_QUESTION_HEADERS = ["题号", "小题", "题目", "题次", "试题", "question", "item", "编号"];
const BLUEPRINT_KNOWLEDGE_HEADERS = ["知识点", "知识模块", "考点", "知识单元", "知识领域"];
const BLUEPRINT_ABILITY_HEADERS = ["能力维度", "能力", "核心素养", "能力要求", "素养"];
const BLUEPRINT_SCORE_HEADERS = ["分值", "满分", "题分", "本题分值", "题目分值", "score"];
const BLUEPRINT_DIFFICULTY_HEADERS = ["难度", "难易", "层级", "等级"];
const CLASS_HEADERS = ["班级", "班别", "行政班", "教学班"];
const EXCLUDED_QUESTION_HEADERS = ["总分", "总成绩", "班级", "班别", "姓名", "学生姓名", "学号", "考号", "知识点", "知识模块", "得分率", "平均分", "排名"];

let xlsxRuntime = null;

export async function parseClassQuestionBundle({ blueprintFile, detailFile }) {
  if (!blueprintFile || !detailFile) {
    return { success: false, reasons: ["班级小题分析必须同时上传双向细目表和班级小题细分数据。"] };
  }

  const blueprintResult = await parseBlueprintFile(blueprintFile);
  if (!blueprintResult.success) {
    return { success: false, reasons: prefixReasons("双向细目表：", blueprintResult.reasons) };
  }

  const detailContext = await readWorkbookContext(detailFile);
  if (!detailContext.success) {
    return { success: false, reasons: prefixReasons("班级小题数据：", detailContext.reasons) };
  }

  const detailResult = buildClassQuestionDataset(detailContext, blueprintResult.blueprint);
  if (!detailResult.success) {
    return { success: false, reasons: prefixReasons("班级小题数据：", detailResult.reasons) };
  }

  return {
    success: true,
    dataset: detailResult.dataset,
  };
}

export async function parseGradeOverviewBundle({ blueprintFile, detailFiles }) {
  if (!blueprintFile || !detailFiles?.length) {
    return { success: false, reasons: ["年级情况分析必须上传 1 份双向细目表和至少 1 份班级小题细分数据。"] };
  }

  const blueprintResult = await parseBlueprintFile(blueprintFile);
  if (!blueprintResult.success) {
    return { success: false, reasons: prefixReasons("双向细目表：", blueprintResult.reasons) };
  }

  const failures = [];
  const classDatasets = [];

  for (const file of detailFiles) {
    const detailContext = await readWorkbookContext(file);
    if (!detailContext.success) {
      failures.push(...prefixReasons(`${file.name}：`, detailContext.reasons));
      continue;
    }

    const detailResult = buildClassQuestionDataset(detailContext, blueprintResult.blueprint);
    if (!detailResult.success) {
      failures.push(...prefixReasons(`${file.name}：`, detailResult.reasons));
      continue;
    }

    classDatasets.push(detailResult.dataset);
  }

  if (failures.length) {
    return { success: false, reasons: failures };
  }

  if (!classDatasets.length) {
    return { success: false, reasons: ["没有成功识别任何班级小题数据文件。"] };
  }

  const subjectNames = [...new Set(classDatasets.map((item) => item.meta.subjectName).filter((item) => item && item !== "未识别科目"))];
  if (subjectNames.length > 1) {
    return {
      success: false,
      reasons: [`检测到多个科目名称：${subjectNames.join("、")}。请确保同一次年级分析上传的是同一科目的多个班级文件。`],
    };
  }

  return {
    success: true,
    dataset: buildGradeOverviewDataset(blueprintResult.blueprint, classDatasets, detailFiles.map((file) => file.name)),
  };
}

export async function parseBlueprintFile(file) {
  const context = await readWorkbookContext(file);
  if (!context.success) return context;

  const questionColumn = findColumnByKeywords(context.columns, BLUEPRINT_QUESTION_HEADERS);
  const knowledgeColumn = findColumnByKeywords(context.columns, BLUEPRINT_KNOWLEDGE_HEADERS);
  const abilityColumn = findColumnByKeywords(context.columns, BLUEPRINT_ABILITY_HEADERS);
  const scoreColumn = findColumnByKeywords(context.columns, BLUEPRINT_SCORE_HEADERS);
  const difficultyColumn = findColumnByKeywords(context.columns, BLUEPRINT_DIFFICULTY_HEADERS);

  const reasons = [];
  if (!questionColumn) reasons.push("未识别到题号 / 小题字段。");
  if (!knowledgeColumn) reasons.push("未识别到知识点字段。");
  if (reasons.length) return { success: false, reasons };

  const duplicateKeys = [];
  const items = [];
  const seenKeys = new Set();

  context.dataRows.forEach((row, index) => {
    const questionLabel = cleanText(row.cells[questionColumn.index]);
    const knowledgeText = cleanText(row.cells[knowledgeColumn.index]);
    if (!questionLabel && !knowledgeText) return;

    const questionKey = normalizeQuestionToken(questionLabel);
    if (!questionKey) return;

    if (!knowledgeText) {
      reasons.push(`第 ${index + 1} 条细目记录缺少知识点内容。`);
      return;
    }

    if (seenKeys.has(questionKey)) {
      duplicateKeys.push(questionLabel || questionKey);
      return;
    }

    seenKeys.add(questionKey);

    const rawScore = scoreColumn ? row.cells[scoreColumn.index] : "";
    const score = toNumber(rawScore);
    const knowledgePoints = splitKnowledgeText(knowledgeText);

    items.push({
      id: `question-${items.length + 1}`,
      questionKey,
      label: questionLabel || `小题 ${items.length + 1}`,
      knowledgePoints,
      ability: abilityColumn ? cleanText(row.cells[abilityColumn.index]) : "",
      difficulty: difficultyColumn ? cleanText(row.cells[difficultyColumn.index]) : "",
      fullScore: Number.isFinite(score) && score > 0 ? score : null,
      aliases: buildQuestionAliases(questionLabel),
    });
  });

  if (duplicateKeys.length) {
    reasons.push(`双向细目表中存在重复题号：${duplicateKeys.slice(0, 6).join("、")}。`);
  }

  if (items.length < 3) {
    reasons.push("双向细目表中可识别的小题数量不足，至少需要 3 道小题。");
  }

  if (reasons.length) {
    return { success: false, reasons };
  }

  const subjectName = extractSubjectName(file.name, context.sheetName);
  const knowledgeNames = [...new Set(items.flatMap((item) => item.knowledgePoints))];

  return {
    success: true,
    blueprint: {
      fileName: file.name,
      sheetName: context.sheetName,
      subjectName,
      items,
      knowledgeNames,
      totalFullScore: sum(items.map((item) => item.fullScore)),
    },
  };
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

function buildClassQuestionDataset(context, blueprint) {
  const studentNameColumn = findBestIdentifierColumn(context.columns, ["姓名"], ["学生姓名"], ["家长", "班主任", "老师", "备注", "联系人"]);
  const studentCodeColumn = findBestIdentifierColumn(context.columns, ["学号"], ["考号", "准考证号"], ["班主任", "老师", "备注", "联系人"]);
  const classColumn = findBestIdentifierColumn(context.columns, CLASS_HEADERS, ["班级名称"], ["班主任", "老师", "备注"]);
  const questionColumnMatches = matchQuestionColumns(context.columns, blueprint.items);

  const reasons = [];
  if (!studentNameColumn && !studentCodeColumn) {
    reasons.push("未识别到学生姓名或学号字段。");
  }

  const minimumCoverage = Math.max(3, Math.ceil(blueprint.items.length * 0.3));
  if (questionColumnMatches.length < minimumCoverage) {
    reasons.push(
      `仅匹配到 ${questionColumnMatches.length}/${blueprint.items.length} 道小题列。请检查班级数据中的题号命名是否与双向细目表一致。`
    );
  }

  if (reasons.length) {
    return { success: false, reasons };
  }

  const students = [];

  context.dataRows.forEach((row, index) => {
    const displayName = cleanText(studentNameColumn ? row.cells[studentNameColumn.index] : "");
    const code = cleanText(studentCodeColumn ? row.cells[studentCodeColumn.index] : "");
    const rowClassName = cleanText(classColumn ? row.cells[classColumn.index] : "");
    const questionScores = {};
    let validScoreCount = 0;

    questionColumnMatches.forEach((match) => {
      const rawValue = row.cells[match.column.index];
      const numericValue = toNumber(rawValue);
      questionScores[match.item.id] = Number.isFinite(numericValue) ? numericValue : null;
      if (Number.isFinite(numericValue)) validScoreCount += 1;
    });

    if (!displayName && !code && !rowClassName && !validScoreCount) return;

    students.push({
      id: `student-${index + 1}`,
      displayName: displayName || code || `学生 ${index + 1}`,
      code,
      className: rowClassName,
      questionScores,
    });
  });

  if (!students.length) {
    return { success: false, reasons: ["未识别到有效学生记录。"] };
  }

  const matchedItems = questionColumnMatches.map((match) => {
    const observedScores = students.map((student) => student.questionScores[match.item.id]).filter((value) => Number.isFinite(value));
    return {
      ...match.item,
      columnHeader: match.column.header,
      fullScore:
        Number.isFinite(match.item.fullScore) && match.item.fullScore > 0
          ? match.item.fullScore
          : inferQuestionFullScore(observedScores),
    };
  });

  const questions = buildQuestionStats(students, matchedItems);
  const rankedStudents = buildStudentStats(students, matchedItems);
  const knowledgePoints = buildKnowledgeStats(questions);
  const className = inferClassName(students, context.fileName);
  const subjectName = extractSubjectName(context.fileName, context.sheetName) || blueprint.subjectName || "未识别科目";
  const totalFullScore = sum(matchedItems.map((item) => item.fullScore));
  const averageScore = sum(questions.map((question) => question.averageScore));
  const averageRate = totalFullScore ? (averageScore / totalFullScore) * 100 : 0;
  const weakQuestions = questions.filter((question) => question.averageRate < 60);
  const weakKnowledge = knowledgePoints.filter((item) => item.averageRate < 60);

  return {
    success: true,
    dataset: {
      mode: "classQuestion",
      meta: {
        blueprintFileName: blueprint.fileName,
        detailFileName: context.fileName,
        sheetName: context.sheetName,
        className,
        subjectName,
        matchedQuestionCount: matchedItems.length,
        blueprintQuestionCount: blueprint.items.length,
        coverageRate: blueprint.items.length ? (matchedItems.length / blueprint.items.length) * 100 : 0,
      },
      metrics: {
        participantCount: rankedStudents.length,
        totalFullScore,
        averageScore,
        averageRate,
        weakQuestionCount: weakQuestions.length,
        weakKnowledgeCount: weakKnowledge.length,
      },
      blueprint: {
        subjectName: blueprint.subjectName,
        knowledgeNames: blueprint.knowledgeNames,
      },
      students: rankedStudents,
      questions,
      knowledgePoints,
      weakQuestions: questions.slice(0, 5),
      weakKnowledge,
    },
  };
}

function buildGradeOverviewDataset(blueprint, classDatasets, fileNames) {
  const subjectName =
    classDatasets.find((item) => item.meta.subjectName && item.meta.subjectName !== "未识别科目")?.meta.subjectName ||
    blueprint.subjectName ||
    "未识别科目";
  const gradeLabel = extractGradeLabel(fileNames);
  const totalStudents = sum(classDatasets.map((item) => item.metrics.participantCount));
  const totalAverageScore = sum(classDatasets.map((item) => item.metrics.averageScore * item.metrics.participantCount));
  const totalFullScore = sum(classDatasets.map((item) => item.metrics.totalFullScore * item.metrics.participantCount));
  const averageRate = totalFullScore ? (totalAverageScore / totalFullScore) * 100 : 0;

  const classRankings = [...classDatasets]
    .map((item) => ({
      className: item.meta.className,
      subjectName: item.meta.subjectName,
      participantCount: item.metrics.participantCount,
      averageRate: item.metrics.averageRate,
      averageScore: item.metrics.averageScore,
      weakKnowledgeLabel: item.knowledgePoints.slice(0, 3).map((knowledge) => knowledge.name).join("、") || "--",
      weakQuestionLabel: item.questions[0]?.label || "--",
      coverageRate: item.meta.coverageRate,
    }))
    .sort((left, right) => right.averageRate - left.averageRate)
    .map((item, index, list) => ({
      ...item,
      rank: index + 1,
      deltaToTop: list[0] ? list[0].averageRate - item.averageRate : 0,
    }));

  const knowledgePoints = buildGradeKnowledgeStats(classDatasets);
  const questionGaps = buildQuestionGapStats(classDatasets);
  const classNames = classRankings.map((item) => item.className);
  const heatmapKnowledge = knowledgePoints.slice(0, 12);
  const heatmap = buildHeatmapData(classNames, heatmapKnowledge, classDatasets);

  return {
    mode: "gradeOverview",
    meta: {
      blueprintFileName: blueprint.fileName,
      subjectName,
      gradeLabel,
      classCount: classDatasets.length,
      fileNames,
    },
    metrics: {
      classCount: classDatasets.length,
      totalStudents,
      averageRate,
      topClassName: classRankings[0]?.className || "--",
      weakestKnowledgeName: knowledgePoints[0]?.name || "--",
      subjectName,
    },
    classes: classDatasets,
    classRankings,
    knowledgePoints,
    questionGaps,
    heatmap,
  };
}

function buildQuestionStats(students, matchedItems) {
  const studentTotals = students
    .map((student) => ({
      id: student.id,
      totalScore: sum(matchedItems.map((item) => student.questionScores[item.id])),
    }))
    .sort((left, right) => right.totalScore - left.totalScore);

  const topGroupSize = Math.max(1, Math.round(students.length * 0.27));
  const topGroupIds = new Set(studentTotals.slice(0, topGroupSize).map((item) => item.id));
  const bottomGroupIds = new Set(studentTotals.slice(-topGroupSize).map((item) => item.id));

  return matchedItems
    .map((item) => {
      const scores = students.map((student) => student.questionScores[item.id]).filter((value) => Number.isFinite(value));
      const topScores = students
        .filter((student) => topGroupIds.has(student.id))
        .map((student) => student.questionScores[item.id])
        .filter((value) => Number.isFinite(value));
      const bottomScores = students
        .filter((student) => bottomGroupIds.has(student.id))
        .map((student) => student.questionScores[item.id])
        .filter((value) => Number.isFinite(value));
      const averageScore = mean(scores);
      const averageRate = item.fullScore ? (averageScore / item.fullScore) * 100 : 0;
      const lowRate = scores.length ? (scores.filter((value) => (value / item.fullScore) * 100 < 60).length / scores.length) * 100 : 0;
      const zeroRate = scores.length ? (scores.filter((value) => value === 0).length / scores.length) * 100 : 0;
      const fullRate = scores.length ? (scores.filter((value) => value >= item.fullScore).length / scores.length) * 100 : 0;
      const discrimination = item.fullScore ? ((mean(topScores) - mean(bottomScores)) / item.fullScore) * 100 : 0;

      return {
        id: item.id,
        questionKey: item.questionKey,
        label: item.label,
        knowledgePoints: item.knowledgePoints,
        knowledgeLabel: item.knowledgePoints.join("、"),
        ability: item.ability || "--",
        difficulty: item.difficulty || "--",
        fullScore: item.fullScore,
        averageScore,
        averageRate,
        lowRate,
        zeroRate,
        fullRate,
        discrimination,
        masteryLabel: averageRate < 60 ? "薄弱" : averageRate < 75 ? "待提升" : "较稳",
        masteryClass: averageRate < 60 ? "bad" : averageRate < 75 ? "mid" : "good",
      };
    })
    .sort((left, right) => left.averageRate - right.averageRate);
}

function buildStudentStats(students, matchedItems) {
  const totalFullScore = sum(matchedItems.map((item) => item.fullScore));

  return students
    .map((student) => {
      const totalScore = sum(matchedItems.map((item) => student.questionScores[item.id]));
      const weakQuestionCount = matchedItems.filter((item) => {
        const score = student.questionScores[item.id];
        return Number.isFinite(score) && item.fullScore && (score / item.fullScore) * 100 < 60;
      }).length;
      const zeroQuestionCount = matchedItems.filter((item) => student.questionScores[item.id] === 0).length;
      const missingQuestionCount = matchedItems.filter((item) => !Number.isFinite(student.questionScores[item.id])).length;

      return {
        ...student,
        totalScore,
        totalRate: totalFullScore ? (totalScore / totalFullScore) * 100 : 0,
        weakQuestionCount,
        zeroQuestionCount,
        missingQuestionCount,
      };
    })
    .sort((left, right) => right.totalScore - left.totalScore)
    .map((student, index) => ({
      ...student,
      rank: index + 1,
    }));
}

function buildKnowledgeStats(questions) {
  const bucket = new Map();

  questions.forEach((question) => {
    question.knowledgePoints.forEach((knowledge) => {
      if (!bucket.has(knowledge)) {
        bucket.set(knowledge, []);
      }
      bucket.get(knowledge).push(question);
    });
  });

  return [...bucket.entries()]
    .map(([name, relatedQuestions]) => {
      const totalFullScore = sum(relatedQuestions.map((question) => question.fullScore));
      const totalAverageScore = sum(relatedQuestions.map((question) => question.averageScore));
      const averageRate = totalFullScore ? (totalAverageScore / totalFullScore) * 100 : 0;

      return {
        name,
        questionCount: relatedQuestions.length,
        totalFullScore,
        averageScore: totalAverageScore,
        averageRate,
        lowQuestionCount: relatedQuestions.filter((question) => question.averageRate < 60).length,
        weakQuestions: [...relatedQuestions].sort((left, right) => left.averageRate - right.averageRate).slice(0, 3),
        weakQuestionLabel: [...relatedQuestions]
          .sort((left, right) => left.averageRate - right.averageRate)
          .slice(0, 3)
          .map((item) => item.label)
          .join("、"),
        masteryLabel: averageRate < 60 ? "薄弱" : averageRate < 75 ? "待提升" : "较稳",
        masteryClass: averageRate < 60 ? "bad" : averageRate < 75 ? "mid" : "good",
      };
    })
    .sort((left, right) => left.averageRate - right.averageRate);
}

function buildGradeKnowledgeStats(classDatasets) {
  const bucket = new Map();

  classDatasets.forEach((dataset) => {
    dataset.knowledgePoints.forEach((knowledge) => {
      if (!bucket.has(knowledge.name)) {
        bucket.set(knowledge.name, []);
      }
      bucket.get(knowledge.name).push({
        className: dataset.meta.className,
        participantCount: dataset.metrics.participantCount,
        averageScore: knowledge.averageScore,
        totalFullScore: knowledge.totalFullScore,
        averageRate: knowledge.averageRate,
      });
    });
  });

  return [...bucket.entries()]
    .map(([name, classRates]) => {
      const totalWeightedScore = sum(classRates.map((item) => item.averageScore * item.participantCount));
      const totalWeightedFullScore = sum(classRates.map((item) => item.totalFullScore * item.participantCount));
      const averageRate = totalWeightedFullScore ? (totalWeightedScore / totalWeightedFullScore) * 100 : 0;
      const sortedRates = [...classRates].sort((left, right) => left.averageRate - right.averageRate);
      return {
        name,
        averageRate,
        weakestClassName: sortedRates[0]?.className || "--",
        weakestClassRate: sortedRates[0]?.averageRate ?? 0,
        strongestClassName: sortedRates[sortedRates.length - 1]?.className || "--",
        strongestClassRate: sortedRates[sortedRates.length - 1]?.averageRate ?? 0,
        classRates,
      };
    })
    .sort((left, right) => left.averageRate - right.averageRate);
}

function buildQuestionGapStats(classDatasets) {
  const bucket = new Map();

  classDatasets.forEach((dataset) => {
    dataset.questions.forEach((question) => {
      if (!bucket.has(question.id)) {
        bucket.set(question.id, {
          id: question.id,
          label: question.label,
          knowledgeLabel: question.knowledgeLabel,
          classRates: [],
        });
      }

      bucket.get(question.id).classRates.push({
        className: dataset.meta.className,
        averageRate: question.averageRate,
      });
    });
  });

  return [...bucket.values()]
    .map((item) => {
      const sortedRates = [...item.classRates].sort((left, right) => left.averageRate - right.averageRate);
      const values = sortedRates.map((entry) => entry.averageRate);
      return {
        ...item,
        averageRate: mean(values),
        gapRate: values.length ? Math.max(...values) - Math.min(...values) : 0,
        weakestClassName: sortedRates[0]?.className || "--",
        weakestClassRate: sortedRates[0]?.averageRate ?? 0,
        strongestClassName: sortedRates[sortedRates.length - 1]?.className || "--",
        strongestClassRate: sortedRates[sortedRates.length - 1]?.averageRate ?? 0,
      };
    })
    .sort((left, right) => right.gapRate - left.gapRate);
}

function buildHeatmapData(classNames, knowledgePoints, classDatasets) {
  const values = [];

  classNames.forEach((className, classIndex) => {
    const dataset = classDatasets.find((item) => item.meta.className === className);
    knowledgePoints.forEach((knowledge, knowledgeIndex) => {
      const rate = dataset?.knowledgePoints.find((item) => item.name === knowledge.name)?.averageRate;
      if (Number.isFinite(rate)) {
        values.push([classIndex, knowledgeIndex, roundTo(rate, 1)]);
      }
    });
  });

  return {
    classNames,
    knowledgeNames: knowledgePoints.map((item) => item.name),
    values,
  };
}

async function readWorkbookContext(file) {
  const XLSX = await getXLSX();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = selectLargestSheet(workbook);
  const worksheet = workbook.Sheets[sheetName];
  const grid = worksheetToGrid(worksheet, XLSX);

  if (!grid.length) {
    return { success: false, reasons: ["文件中未读取到有效工作表内容。"] };
  }

  const headerStartIndex = findHeaderStartIndex(grid);
  const headerDepth = detectHeaderDepth(grid, headerStartIndex);
  const headers = buildHeaders(grid, headerStartIndex, headerDepth);
  const dataRows = buildDataRows(grid, headerStartIndex + headerDepth, headers.length);
  const columns = summarizeColumns(headers, dataRows);

  return {
    success: true,
    fileName: file.name,
    sheetName,
    headers,
    dataRows,
    columns,
  };
}

function matchQuestionColumns(columns, items) {
  const matches = [];
  const usedItems = new Set();

  columns.forEach((column) => {
    if (EXCLUDED_QUESTION_HEADERS.some((keyword) => column.headerNormalized.includes(normalizeHeader(keyword)))) return;
    const aliases = buildQuestionAliases(column.header);
    if (!aliases.length) return;

    const matchedItem =
      items.find((item) => !usedItems.has(item.id) && aliases.some((alias) => item.aliases.includes(alias))) || null;

    if (!matchedItem) return;

    usedItems.add(matchedItem.id);
    matches.push({ column, item: matchedItem });
  });

  return matches;
}

function findColumnByKeywords(columns, keywords) {
  return (
    columns
      .map((column) => {
        const score = keywords.reduce((best, keyword) => {
          const normalizedKeyword = normalizeHeader(keyword);
          if (column.headerNormalized.includes(normalizedKeyword)) return Math.max(best, normalizedKeyword.length);
          return best;
        }, 0);
        return score ? { ...column, matchScore: score } : null;
      })
      .filter(Boolean)
      .sort((left, right) => right.matchScore - left.matchScore)[0] || null
  );
}

function findBestIdentifierColumn(columns, coreWords, synonymWords, excludeWords) {
  return (
    columns
      .map((column) => {
        const score = scoreHeader(column.headerNormalized, coreWords, synonymWords, excludeWords);
        if (!score) return null;
        if (!(column.textRatio >= 0.5 && column.uniqueRatio >= 0.2 && column.emptyRate < 0.6)) return null;
        return { ...column, matchScore: score };
      })
      .filter(Boolean)
      .sort((left, right) => right.matchScore - left.matchScore)[0] || null
  );
}

function scoreHeader(normalizedHeader, coreWords, synonymWords, excludeWords) {
  if (!normalizedHeader) return 0;
  if (excludeWords.some((word) => normalizedHeader.includes(normalizeHeader(word)))) return 0;
  if (coreWords.some((word) => normalizedHeader.includes(normalizeHeader(word)))) return 100;
  if (synonymWords.some((word) => normalizedHeader.includes(normalizeHeader(word)))) return 70;
  return 0;
}

function buildQuestionAliases(value) {
  const raw = cleanText(value);
  if (!raw) return [];

  const aliases = new Set();
  const stripped = raw.replace(/[（(].*?[）)]/g, "");

  [raw, stripped].forEach((source) => {
    const direct = normalizeQuestionToken(source);
    if (direct) aliases.add(direct);

    const matches = source.match(/\d+(?:[.\-_]\d+)*/g) || [];
    matches.forEach((match) => {
      const normalized = normalizeQuestionToken(match);
      if (normalized) aliases.add(normalized);
    });
  });

  return [...aliases];
}

function normalizeQuestionToken(value) {
  const normalized = cleanText(value)
    .replace(/[（(].*?[）)]/g, "")
    .replace(/第/g, "")
    .replace(/小题|题目|题次|试题|试题编号|得分|分值|score|question|item/gi, "")
    .replace(/^q/i, "")
    .replace(/[：:\s]/g, "")
    .replace(/[－—–_]/g, ".")
    .replace(/-/g, ".")
    .replace(/[．]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");

  if (!normalized) return "";

  return normalized
    .split(".")
    .filter(Boolean)
    .map((segment) => {
      if (!/^\d+$/.test(segment)) return segment.toLowerCase();
      const valueNumber = Number(segment);
      return Number.isFinite(valueNumber) ? String(valueNumber) : segment;
    })
    .join(".");
}

function inferClassName(students, fileName) {
  const values = students.map((student) => student.className).filter(Boolean);
  const mostFrequent = modeText(values);
  return mostFrequent || extractClassName(fileName);
}

function extractSubjectName(fileName, sheetName = "") {
  const source = `${fileName} ${sheetName}`;
  return SUBJECT_NAMES.find((name) => source.includes(name)) || "未识别科目";
}

function extractClassName(fileName) {
  const base = stripFileExtension(fileName);
  const tokenMatch = base
    .split(/[\s_\-—]+/)
    .map((item) => item.trim())
    .find((item) => /班/.test(item));

  if (tokenMatch) return tokenMatch;

  const regexMatch = base.match(/([0-9一二三四五六七八九十]+班)/);
  if (regexMatch) return regexMatch[1];

  return base;
}

function extractGradeLabel(fileNames) {
  const combined = fileNames.join(" ");
  return GRADE_PATTERNS.find((item) => combined.includes(item)) || "当前上传年级";
}

function inferQuestionFullScore(scores) {
  const maximum = Math.max(...scores, 0);
  if (!maximum) return 1;
  if (maximum <= 1) return 1;
  if (maximum <= 2) return 2;
  if (maximum <= 3) return 3;
  if (maximum <= 4) return 4;
  if (maximum <= 5) return 5;
  if (maximum <= 10) return Math.ceil(maximum);
  return Math.ceil(maximum);
}

function prefixReasons(prefix, reasons) {
  return reasons.map((item) => `${prefix}${item}`);
}

function splitKnowledgeText(value) {
  return [...new Set(cleanText(value).split(/[、,，/；;|]/).map((item) => item.trim()).filter(Boolean))];
}

function stripFileExtension(value) {
  return String(value || "").replace(/\.[^.]+$/, "");
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanHeaderText(value) {
  return cleanText(value).replace(/[：:]/g, "").replace(/\s+/g, "");
}

function normalizeHeader(value) {
  return cleanText(value).replace(/[：:\-_（）()、\s]/g, "").toLowerCase();
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const text = cleanText(value).replace(/,/g, "");
  if (!text) return Number.NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
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

function worksheetToGrid(worksheet, XLSX) {
  const ref = worksheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      row.push(readWorksheetCell(worksheet, rowIndex, colIndex, XLSX));
    }
    rows.push(row);
  }

  (worksheet["!merges"] || []).forEach((merge) => {
    const sourceValue = readWorksheetCell(worksheet, merge.s.r, merge.s.c, XLSX);
    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex += 1) {
      for (let colIndex = merge.s.c; colIndex <= merge.e.c; colIndex += 1) {
        const row = rows[rowIndex - range.s.r];
        if (row) row[colIndex - range.s.c] = sourceValue;
      }
    }
  });

  return rows;
}

function readWorksheetCell(worksheet, rowIndex, colIndex, XLSX) {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
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

function mean(values) {
  return values.length ? sum(values) / values.length : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function modeText(values) {
  if (!values.length) return "";
  const counts = new Map();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  let bestValue = "";
  let bestCount = -1;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });
  return bestValue;
}

async function getXLSX() {
  if (!xlsxRuntime) {
    xlsxRuntime = await import("xlsx");
  }
  return xlsxRuntime;
}

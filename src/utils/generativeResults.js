const QUESTION_ARRAY_KEYS = ["questions", "question_list", "questionList", "items", "list", "题目", "题目列表", "试题"];

export function normalizeQuestionStudioResult(payload, requestOptions = {}) {
  const source = pickBestQuestionPayload(payload);
  const questions = normalizeQuestionItems(source, requestOptions);
  const rawResponse = serializeRawResponse(payload);
  const normalized = {
    title:
      readFirstText(source, ["title", "name", "paper_title", "paperTitle", "标题", "试题标题", "题目标题"]) ||
      `${requestOptions.grade || "通用"}-${requestOptions.subject || "学科"}-智能出题`,
    overview: readFirstText(source, ["overview", "summary", "description", "概述", "说明", "题组说明", "题目说明"]),
    difficulty_mix: normalizeDifficultyMix(source, questions),
    questions,
    raw_response: rawResponse,
    request_meta: buildRequestMeta(requestOptions),
    warnings: [],
  };

  if (!normalized.overview) {
    normalized.overview = buildQuestionOverview(normalized);
  }

  return normalized;
}

export function normalizePaperStudioResult(payload, requestOptions = {}) {
  const source = pickBestQuestionPayload(payload);
  const questions = normalizeQuestionItems(source, requestOptions, "paper");
  const rawResponse = serializeRawResponse(payload);
  const knowledgePoints = normalizeKnowledgeList(
    readFirstDefined(source, ["knowledge_points", "knowledgePoints", "知识点", "knowledge_list", "knowledgeList"]) ||
      requestOptions.knowledgePoints
  );
  const normalized = {
    title:
      readFirstText(source, ["title", "name", "paper_title", "paperTitle", "标题", "试卷标题"]) ||
      `${requestOptions.grade || "通用"}-${requestOptions.subject || "学科"}-智能出卷`,
    overview: readFirstText(source, ["overview", "summary", "description", "概述", "说明", "试卷说明"]),
    knowledge_points: knowledgePoints,
    reference_summary:
      readFirstText(source, ["reference_summary", "referenceSummary", "参考说明", "参考试卷说明"]) ||
      (Array.isArray(requestOptions.referencePapers) && requestOptions.referencePapers.length ? "已参考上传试卷的结构与风格" : "未使用参考试卷"),
    sections: normalizeSectionSummaries(source, questions, requestOptions),
    questions,
    raw_response: rawResponse,
    request_meta: buildRequestMeta(requestOptions),
    warnings: [],
  };

  if (!normalized.overview) {
    const knowledgeText = normalized.knowledge_points.length ? normalized.knowledge_points.join("、") : "核心知识点";
    normalized.overview = `本卷围绕${knowledgeText}组织题目，已按当前题型配置生成可直接预览的试卷结果。`;
  }

  return normalized;
}

export function normalizeSimilarQuestionStudioResult(payload, requestOptions = {}) {
  const source = pickBestQuestionPayload(payload);
  const questions = normalizeQuestionItems(source, requestOptions);
  const rawResponse = serializeRawResponse(payload);
  const sourceKnowledgePoints = normalizeKnowledgeList(
    readFirstDefined(source, ["source_knowledge_points", "sourceKnowledgePoints", "knowledge_points", "knowledgePoints", "知识点"]) ||
      requestOptions.knowledgePoints
  );
  const normalized = {
    title:
      readFirstText(source, ["title", "name", "paper_title", "paperTitle", "标题", "题组标题"]) ||
      `${requestOptions.grade || "通用"}-${requestOptions.subject || "学科"}-题目变式`,
    overview: readFirstText(source, ["overview", "summary", "description", "概述", "说明", "变式说明"]),
    source_knowledge_points: sourceKnowledgePoints,
    variation_strategy:
      readFirstText(source, ["variation_strategy", "variationStrategy", "strategy", "变式思路", "生成策略"]) ||
      "围绕原题核心知识点进行了同结构变式生成",
    questions,
    raw_response: rawResponse,
    request_meta: buildRequestMeta(requestOptions),
    warnings: [],
  };

  if (!normalized.overview) {
    normalized.overview = `围绕${sourceKnowledgePoints.join("、") || "原题核心知识点"}生成了可直接练习的变式题。`;
  }

  return normalized;
}

function buildRequestMeta(requestOptions) {
  return {
    grade: requestOptions.grade || "",
    subject: requestOptions.subject || "",
    requestedCount: Number(requestOptions.count || 0),
    difficultyMode: requestOptions.difficultyMode || "default",
    difficultyCoefficient: requestOptions.difficultyCoefficient ?? null,
    questionTypes: Array.isArray(requestOptions.questionTypes) ? [...requestOptions.questionTypes] : [],
    knowledgePoints: Array.isArray(requestOptions.knowledgePoints) ? [...requestOptions.knowledgePoints] : [],
    sectionConfigs: Array.isArray(requestOptions.sectionConfigs) ? requestOptions.sectionConfigs.map((item) => ({ ...item })) : [],
  };
}

function serializeRawResponse(payload) {
  if (typeof payload === "string") {
    return payload.trim();
  }

  if (payload === null || typeof payload === "undefined") {
    return "";
  }

  try {
    return ["```json", JSON.stringify(payload, null, 2), "```"].join("\n");
  } catch (error) {
    return String(payload);
  }
}

function buildQuestionWarnings(questions, requestOptions) {
  const warnings = [];
  const requestedCount = Number(requestOptions.count || 0);

  if (!questions.length) {
    warnings.push("未识别出可展示的题目列表");
  } else if (requestedCount && questions.length !== requestedCount) {
    warnings.push(`已识别 ${questions.length} 道题，与设定的 ${requestedCount} 道不完全一致`);
  }

  return warnings;
}

function buildQuestionOverview(normalized) {
  const request = normalized.request_meta || {};
  const typeSummary = request.questionTypes?.length ? request.questionTypes.join("、") : "混合题型";
  const countText = normalized.questions.length || request.requestedCount || 0;

  if (request.difficultyMode === "coefficient" && request.difficultyCoefficient) {
    return `共整理出 ${countText} 道练习题，题型范围为${typeSummary}，整体按难度系数 ${request.difficultyCoefficient}/10 组织。`;
  }

  return `共整理出 ${countText} 道练习题，题型范围为${typeSummary}，整体保持默认梯度与难易结合。`;
}

function pickBestQuestionPayload(rawPayload) {
  if (typeof rawPayload === "string") {
    return { content: rawPayload };
  }

  if (Array.isArray(rawPayload)) {
    return { questions: rawPayload };
  }

  const candidates = collectObjectCandidates(rawPayload);
  const scoredCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: scoreQuestionPayloadCandidate(candidate),
    }))
    .sort((left, right) => right.score - left.score);

  return scoredCandidates[0]?.candidate || {};
}

function collectObjectCandidates(value, depth = 0, seen = new Set()) {
  if (depth > 4 || value === null || typeof value === "undefined") {
    return [];
  }

  if (Array.isArray(value)) {
    const candidates = [];
    value.forEach((item) => {
      candidates.push(...collectObjectCandidates(item, depth + 1, seen));
    });
    return candidates;
  }

  if (!isPlainObject(value) || seen.has(value)) {
    return [];
  }

  seen.add(value);
  const candidates = [value];

  Object.values(value).forEach((item) => {
    candidates.push(...collectObjectCandidates(item, depth + 1, seen));
  });

  return candidates;
}

function scoreQuestionPayloadCandidate(candidate) {
  let score = 0;

  if (Array.isArray(readFirstDefined(candidate, QUESTION_ARRAY_KEYS))) {
    score += 10;
  }

  if (readFirstText(candidate, ["title", "name", "paper_title", "paperTitle", "标题", "试题标题", "试卷标题", "题组标题"])) {
    score += 3;
  }

  if (readFirstText(candidate, ["overview", "summary", "description", "概述", "说明"])) {
    score += 2;
  }

  if (readFirstDefined(candidate, ["difficulty_mix", "difficultyMix", "难度分布", "难度配置"])) {
    score += 1;
  }

  return score;
}

function normalizeQuestionItems(source, requestOptions, mode = "question") {
  const list = extractQuestionCandidates(source);

  return list
    .map((item, index) => normalizeQuestionItem(item, index, list.length, requestOptions, mode))
    .filter((item) => item.stem || item.answer || item.analysis);
}

function extractQuestionCandidates(source) {
  const directCandidates = normalizeQuestionCollection(readFirstDefined(source, QUESTION_ARRAY_KEYS));
  if (directCandidates.length) {
    return directCandidates;
  }

  const nestedCandidates = findNestedQuestionCandidates(source);
  if (nestedCandidates.length) {
    return nestedCandidates;
  }

  const textCandidates = buildQuestionCandidatesFromText(collectTextBlocks(source));
  if (textCandidates.length) {
    return textCandidates;
  }

  if (looksLikeQuestionObject(source)) {
    return [source];
  }

  return [];

  const fallbackText = collectTextBlocks(source)[0];
  if (fallbackText) {
    return [
      {
        stem: fallbackText,
        answer: "AI 已返回文本内容，但未按标准题目结构组织",
        analysis: "系统已尽量保留原始内容，建议结合补充要求重新生成以获得更完整的结构化题目。",
      },
    ];
  }

  return [];
}

function normalizeQuestionCollection(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isPlainObject(value)) {
    return [];
  }

  if (looksLikeQuestionObject(value)) {
    return [value];
  }

  const list = [];

  Object.entries(value).forEach(([key, item]) => {
    if (Array.isArray(item)) {
      list.push(...normalizeQuestionCollection(item));
      return;
    }

    if (isPlainObject(item)) {
      if (looksLikeQuestionObject(item) || looksLikeQuestionKey(key)) {
        list.push({ id: item.id || key, ...item });
      }
      return;
    }

    if (looksLikeQuestionKey(key) && typeof item === "string" && item.trim()) {
      list.push({ id: key, stem: item.trim() });
    }
  });

  return list;
}

function findNestedQuestionCandidates(source, depth = 0, visited = new Set()) {
  if (depth > 4 || source === null || typeof source === "undefined") {
    return [];
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findNestedQuestionCandidates(item, depth + 1, visited);
      if (found.length) {
        return found;
      }
    }
    return [];
  }

  if (!isPlainObject(source) || visited.has(source)) {
    return [];
  }

  visited.add(source);

  for (const key of QUESTION_ARRAY_KEYS) {
    const found = normalizeQuestionCollection(source[key]);
    if (found.length) {
      return found;
    }
  }

  for (const value of Object.values(source)) {
    const found = findNestedQuestionCandidates(value, depth + 1, visited);
    if (found.length) {
      return found;
    }
  }

  return [];
}

function buildQuestionCandidatesFromText(textBlocks) {
  for (const text of textBlocks) {
    const candidates = parseQuestionsFromText(text);
    if (candidates.length) {
      return candidates;
    }
  }

  return [];
}

function collectTextBlocks(source, depth = 0, visited = new Set(), result = []) {
  if (depth > 4 || source === null || typeof source === "undefined") {
    return result;
  }

  if (typeof source === "string") {
    const normalized = source.trim();
    if (normalized.length >= 12) {
      result.push(normalized);
    }
    return result;
  }

  if (Array.isArray(source)) {
    source.forEach((item) => collectTextBlocks(item, depth + 1, visited, result));
    return result;
  }

  if (!isPlainObject(source) || visited.has(source)) {
    return result;
  }

  visited.add(source);
  Object.values(source).forEach((item) => collectTextBlocks(item, depth + 1, visited, result));
  return result;
}

function parseQuestionsFromText(text) {
  const normalizedText = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalizedText) {
    return [];
  }

  const regex = /(?:^|\n)\s*(第\s*\d+\s*题|Q\s*\d+|\d+\s*[\.、])\s*/g;
  const matches = [...normalizedText.matchAll(regex)];

  if (!matches.length) {
    const singleQuestion = buildQuestionFromTextBlock(normalizedText);
    return singleQuestion ? [singleQuestion] : [];
  }

  const questions = [];

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalizedText.length;
    const block = normalizedText.slice(start, end).trim();
    const question = buildQuestionFromTextBlock(block);
    if (question) {
      question.id = normalizeQuestionKey(match[1]) || `Q${index + 1}`;
      questions.push(question);
    }
  });

  return questions;
}

function buildQuestionFromTextBlock(block) {
  const text = String(block || "").trim();
  if (!text) {
    return null;
  }

  const answerMatch = text.match(/(?:^|\n)(?:答案|解答|参考答案|Answer)\s*[：:]\s*([\s\S]*?)(?=(?:\n(?:解析|分析|详解|Explanation)\s*[：:])|$)/i);
  const analysisMatch = text.match(/(?:^|\n)(?:解析|分析|详解|Explanation)\s*[：:]\s*([\s\S]*)$/i);
  const stemEndCandidates = [answerMatch?.index, analysisMatch?.index].filter((value) => typeof value === "number");
  const stemEndIndex = stemEndCandidates.length ? Math.min(...stemEndCandidates) : text.length;
  const stemSource = text.slice(0, stemEndIndex).trim();
  const options = extractOptionsFromStem(stemSource);
  const cleanedStem = removeOptionLines(stemSource).trim();

  return {
    stem: cleanedStem || stemSource,
    options,
    answer: answerMatch?.[1]?.trim() || "",
    analysis: analysisMatch?.[1]?.trim() || "",
  };
}

function extractOptionsFromStem(stem) {
  const lines = String(stem || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const options = lines.filter((line) => /^(?:[A-H][\.．、]|[(（]?[A-H][)）])\s*/.test(line));
  return options;
}

function removeOptionLines(stem) {
  return String(stem || "")
    .split("\n")
    .filter((line) => !/^\s*(?:[A-H][\.．、]|[(（]?[A-H][)）])\s*/.test(line))
    .join("\n");
}

function looksLikeQuestionObject(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (!keys.length) {
    return false;
  }

  const questionLikeKeys = ["stem", "question", "prompt", "body", "content", "题干", "题目", "题面", "问题"];
  const answerLikeKeys = ["answer", "solution", "analysis", "explanation", "答案", "解析"];

  return keys.some((key) => questionLikeKeys.includes(key)) || keys.some((key) => answerLikeKeys.includes(key));
}

function looksLikeQuestionKey(value) {
  return /^(?:q(?:uestion)?\s*\d+|\d+|第\s*\d+\s*题)$/i.test(String(value || "").trim());
}

function normalizeQuestionKey(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d+)/);
  return match ? `Q${match[1]}` : text;
}

function normalizeQuestionItem(rawItem, index, total, requestOptions, mode) {
  const item = isPlainObject(rawItem) ? rawItem : { stem: rawItem };
  const options = normalizeOptions(readFirstDefined(item, ["options", "choices", "option_list", "optionList", "选项"]));
  const difficultyValue = readFirstDefined(item, ["difficulty", "level", "difficulty_level", "难度", "难度等级"]);
  const typeText =
    readFirstText(item, ["type", "question_type", "questionType", "section_type", "题型", "题目类型"]) ||
    inferQuestionType(options);

  return {
    id: readFirstText(item, ["id", "question_id", "questionId", "编号", "题号"]) || `Q${index + 1}`,
    difficulty: normalizeDifficultyValue(difficultyValue) || inferDifficultyFromRequest(index, total, requestOptions),
    type: typeText,
    section_type: mode === "paper" ? typeText : undefined,
    stem:
      readFirstText(item, ["stem", "question", "prompt", "body", "content", "题干", "题目", "题面", "问题"]) ||
      "",
    options,
    answer: normalizeRichText(readFirstDefined(item, ["answer", "solution", "correct_answer", "答案", "参考答案"])),
    analysis: normalizeRichText(readFirstDefined(item, ["analysis", "explanation", "解析", "详解", "解题过程"])),
    score: normalizeScoreValue(readFirstDefined(item, ["score", "points", "分值", "分数"])),
  };
}

function normalizeDifficultyMix(source, questions) {
  const rawMix = readFirstDefined(source, ["difficulty_mix", "difficultyMix", "难度分布", "难度配置"]);
  const mixFromQuestions = questions.reduce(
    (accumulator, item) => {
      accumulator[item.difficulty] += 1;
      return accumulator;
    },
    { easy: 0, medium: 0, hard: 0 }
  );

  if (!isPlainObject(rawMix)) {
    return mixFromQuestions;
  }

  return {
    easy: normalizeCountValue(rawMix.easy ?? rawMix.简单 ?? rawMix.basic, mixFromQuestions.easy),
    medium: normalizeCountValue(rawMix.medium ?? rawMix.中等 ?? rawMix.normal, mixFromQuestions.medium),
    hard: normalizeCountValue(rawMix.hard ?? rawMix.困难 ?? rawMix.challenge, mixFromQuestions.hard),
  };
}

function normalizeSectionSummaries(source, questions, requestOptions) {
  const rawSections = readFirstDefined(source, ["sections", "section_list", "sectionList", "题型分布", "分区"]);
  const derivedMap = new Map();

  questions.forEach((question) => {
    const key = question.section_type || question.type || "题目";
    const next = derivedMap.get(key) || { type: key, count: 0, total_score: 0 };
    next.count += 1;
    next.total_score += normalizeScoreValue(question.score);
    derivedMap.set(key, next);
  });

  if (!Array.isArray(rawSections)) {
    if (derivedMap.size) {
      return [...derivedMap.values()];
    }

    if (Array.isArray(requestOptions.sectionConfigs)) {
      return requestOptions.sectionConfigs
        .map((item) => ({
          type: String(item?.type || "").trim(),
          count: normalizeCountValue(item?.count),
          total_score: normalizeCountValue(item?.count) * 5,
        }))
        .filter((item) => item.type && item.count > 0);
    }

    return [];
  }

  const normalizedSections = rawSections
    .map((item) => {
      const row = isPlainObject(item) ? item : { type: item };
      const type = readFirstText(row, ["type", "section_type", "sectionType", "题型", "分区"]) || "题目";
      const derived = derivedMap.get(type);
      return {
        type,
        count: normalizeCountValue(readFirstDefined(row, ["count", "question_count", "题数"]), derived?.count ?? 0),
        total_score: normalizeCountValue(
          readFirstDefined(row, ["total_score", "totalScore", "score", "总分"]),
          derived?.total_score ?? 0
        ),
      };
    })
    .filter((item) => item.type);

  return normalizedSections.length ? normalizedSections : [...derivedMap.values()];
}

function normalizeKnowledgeList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeRichText(item)).filter(Boolean))];
  }

  const text = normalizeRichText(value);
  if (!text) {
    return [];
  }

  return [...new Set(text.split(/\n|,|，|、|；|;/).map((item) => item.trim()).filter(Boolean))];
}

function normalizeOptions(rawOptions) {
  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((item) => normalizeRichText(item))
      .filter(Boolean);
  }

  if (isPlainObject(rawOptions)) {
    return Object.entries(rawOptions)
      .map(([key, value]) => `${key}. ${normalizeRichText(value)}`.trim())
      .filter((item) => item !== ".");
  }

  const text = normalizeRichText(rawOptions);
  if (!text) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRichText(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeRichText(item))
      .filter(Boolean)
      .join("\n");
  }

  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${normalizeRichText(item)}`.trim())
      .filter(Boolean)
      .join("\n");
  }

  return String(value ?? "").trim();
}

function normalizeScoreValue(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }
  return 5;
}

function normalizeCountValue(value, fallbackValue = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? Math.trunc(numericValue) : fallbackValue;
}

function normalizeDifficultyValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  if (["easy", "简单", "基础", "偏基础", "容易", "basic"].includes(raw)) return "easy";
  if (["medium", "中等", "适中", "中档", "普通", "moderate"].includes(raw)) return "medium";
  if (["hard", "困难", "挑战", "提升", "偏难", "challenging"].includes(raw)) return "hard";

  const numericValue = Number(raw);
  if (Number.isFinite(numericValue)) {
    if (numericValue <= 3) return "easy";
    if (numericValue <= 6) return "medium";
    return "hard";
  }

  return "";
}

function inferDifficultyFromRequest(index, total, requestOptions) {
  if (requestOptions.difficultyMode === "coefficient") {
    const coefficient = Number(requestOptions.difficultyCoefficient || 6);
    if (coefficient <= 3) {
      return index >= total - Math.max(1, Math.floor(total * 0.2)) ? "medium" : "easy";
    }
    if (coefficient <= 6) {
      return index < Math.ceil(total * 0.35) ? "easy" : "medium";
    }
    if (coefficient <= 8) {
      return index < Math.ceil(total * 0.35) ? "medium" : "hard";
    }
    return index < Math.max(1, Math.floor(total * 0.2)) ? "medium" : "hard";
  }

  if (total <= 1) return "medium";

  const ratio = index / Math.max(total - 1, 1);
  if (ratio < 0.34) return "easy";
  if (ratio < 0.75) return "medium";
  return "hard";
}

function inferQuestionType(options) {
  return options.length ? "选择题" : "解答题";
}

function readFirstDefined(source, keys) {
  if (!isPlainObject(source)) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && typeof source[key] !== "undefined") {
      return source[key];
    }
  }

  return undefined;
}

function readFirstText(source, keys) {
  const value = readFirstDefined(source, keys);
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

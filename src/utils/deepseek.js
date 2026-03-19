const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DETAILED_ANALYSIS_REQUIREMENT = `
解析要求：
1. 解析必须详细，不能只给一句结论。
2. 请按步骤展开，适合学生独立复盘，每一步说明“为什么这样做”。
3. 理科题目涉及公式、方程、推导时，请使用规范 Markdown 与 LaTeX 表达公式，例如 $x^2+2x+1$ 或 $$\\frac{a}{b}$$。
4. 如果题目有多种做法，可以优先给主方法，再补一句可选思路。
5. 解析内容要能直接单独展示，避免只写“略”“同上”“代入即可”。
`;
const STRUCTURED_JSON_REQUIREMENT = `
格式要求：
1. 只输出 JSON 对象本身，不要输出任何 JSON 之外的说明文字。
2. 不要使用 \`\`\`json 代码块包裹结果。
3. JSON 中所有键名和字符串都必须使用英文双引号。
4. 字符串内部如果需要换行，请写成 \\n，不要直接插入真实换行。
5. 如需输出 LaTeX、公式命令或其他反斜杠内容，必须将反斜杠转义为 \\\\，例如 \\\\frac{a}{b}、\\\\sqrt{x}。
6. 不要保留尾随逗号。
`;

export async function requestCopilotAnswer({ apiKey, messages }) {
  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content:
          "你是 edua 智能助手，一名偏教育与学习场景的中文 AI 助手。你可以回答学习规划、知识点解释、文本题目分析、成绩解读建议、表格数据解读和通用学习效率问题。始终使用中文，不支持图片分析；如果用户附带了从 Word 文档或 Excel 表格中提取的内容，请优先围绕该文件做总结、分析、批注建议、结构梳理和问答辅导。当回答需要分标题、列表、表格、步骤或代码块时，请使用规范 Markdown 输出，避免使用伪表格、随意缩进和纯文本对齐。",
      },
      ...messages,
    ],
    responseFormat: null,
    maxTokens: 2000,
    temperature: 0.6,
  });
}

export async function requestQuestionSet({
  apiKey,
  grade,
  subject,
  prompt,
  count,
  questionTypes,
  difficultyMode,
  difficultyCoefficient,
}) {
  const normalizedTypes = normalizeQuestionTypes(questionTypes);
  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content: `
你是 edua 智能出题助手。请根据给定年级、科目与用户要求生成一套难易结合的练习题。
你必须输出合法 json，格式如下：
{
  "title": "试题标题",
  "overview": "这套题覆盖的能力点与难度分布",
  "difficulty_mix": {
    "easy": 数量,
    "medium": 数量,
    "hard": 数量
  },
  "questions": [
    {
      "id": "Q1",
      "difficulty": "easy|medium|hard",
      "type": "题型",
      "stem": "题干",
      "options": ["A", "B"],
      "answer": "答案",
      "analysis": "解析",
      "score": 5
    }
  ]
}
要求：
1. 必须输出合法 json。
2. 题目总数严格等于用户要求数量。
3. 当难度模式为“默认梯度”时，难度必须混合，建议 easy:medium:hard 约为 3:4:2；当题量较少时也要保证至少出现两种难度。
4. 当难度模式为“难度系数”时，请按 1 到 10 的难度系数控制整套题的整体难度：1 到 3 偏基础，4 到 6 基础到中等，7 到 8 偏提升，9 到 10 偏挑战。此时可以保留少量梯度，但整体难度必须服从难度系数。
5. 题目要符合对应年级和学科认知水平。
6. 客观题请提供清晰的 options；主观题 options 为空数组。
7. 解析要详细且有教学价值，适合单独展示。
8. 如果用户指定了题型，请尽量严格遵守题型范围；如果没有指定，则可混合选择题、填空题和解答题。
${STRUCTURED_JSON_REQUIREMENT}
${DETAILED_ANALYSIS_REQUIREMENT}
`,
      },
      {
        role: "user",
        content: `年级：${grade}\n科目：${subject}\n题量：${count}\n难度模式：${difficultyMode === "coefficient" ? "按难度系数出题" : "默认梯度"
          }\n难度系数：${difficultyMode === "coefficient" ? `${difficultyCoefficient}/10` : "默认梯度，不单独指定"}\n题型范围：${normalizedTypes.length ? normalizedTypes.join("、") : "未指定，允许混合题型"
          }\n补充要求：${prompt || "围绕核心知识点进行综合训练，难度要有梯度。"
          }\n请生成一套练习题。`,
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 3600,
    temperature: 0.5,
  });
}

export async function requestAnalysisInsight({ apiKey, analysisType, summary }) {
  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content:
          "你是 edua 的教育数据分析助手，擅长根据考试结果输出班级或年级层面的教学诊断。请仅根据用户提供的数据摘要分析，不要虚构不存在的数值。请使用规范 Markdown 输出，并按“整体判断、核心问题、教学建议、后续动作”四部分组织内容；每部分控制在 2 到 4 条，语言直接、可执行、偏教学场景。",
      },
      {
        role: "user",
        content: `分析场景：${analysisType}\n\n数据摘要：\n${summary}\n\n请输出面向教师的 AI 智能分析。`,
      },
    ],
    responseFormat: null,
    maxTokens: 1500,
    temperature: 0.5,
  });
}

export async function requestKnowledgeExtraction({ apiKey, grade, subject, questionText }) {
  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content: `
你是 edua 的题目知识点提取助手。请根据用户提供的原题，提取题型、核心知识点和能力要求。
你必须输出合法 json，格式如下：
{
  "question_type": "题型",
  "knowledge_points": ["知识点1", "知识点2"],
  "ability_points": ["能力点1", "能力点2"],
  "difficulty_hint": "基础|中等|提升",
  "summary": "一句话概括原题考查重点"
}
要求：
1. 必须输出合法 json。
2. knowledge_points 保持 2 到 6 个，尽量具体。
3. 如果题干信息不足，也要给出尽可能稳妥的提取结果，不要留空数组。
${STRUCTURED_JSON_REQUIREMENT}
`,
      },
      {
        role: "user",
        content: `年级：${grade}\n科目：${subject}\n原题：\n${questionText}\n\n请提取知识点。`,
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 900,
    temperature: 0.3,
  });
}

export async function requestQuestionPreprocess({ apiKey, grade, subject, questionText }) {
  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content: `
你是 edua 的题目预处理助手。请根据用户提供的题目文本，进行轻量且保守的规范化处理，尤其要把常见的纯文本数学公式整理成适合 Markdown + LaTeX 展示的形式。
你必须输出合法 json，格式如下：
{
  "normalized_question": "规范化后的题目正文",
  "formula_fixes": ["公式或符号处理说明"],
  "normalization_notes": ["版式或结构处理说明"]
}
要求：1. 必须输出合法 json。2. 不要改变题意、条件、数值、问法和答案指向，只做表达与排版层面的规范化。3. 数学、物理、化学等理科题目中，若出现分式、根式、指数、上下标、方程、不等式、几何符号等，请尽量整理为规范的 Markdown + LaTeX 写法。4. 保留题号、选项、已知条件、题干层次与换行结构。5. 如果原题本身已经规范，也要返回接近原文的规范化版本，不要留空。6. formula_fixes 与 normalization_notes 各返回 1 到 4 条，尽量简洁。
${STRUCTURED_JSON_REQUIREMENT}
`,
      },
      {
        role: "user",
        content: `年级：${grade}\n科目：${subject}\n原题：\n${questionText}\n\n请先完成题目预处理，再返回规范化后的题面。`,
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 1400,
    temperature: 0.2,
  });
}

export async function requestSimilarQuestionSet({
  apiKey,
  grade,
  subject,
  originalQuestion,
  knowledgePoints,
  prompt,
  count,
  questionTypes,
  difficultyMode,
  difficultyCoefficient,
}) {
  const normalizedTypes = normalizeQuestionTypes(questionTypes);
  const normalizedKnowledge = Array.isArray(knowledgePoints) ? knowledgePoints.filter(Boolean) : [];

  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content: `
你是 edua 智能出题助手，负责围绕一道原题生成同知识结构的变式训练题。
你必须输出合法 json，格式如下：
{
  "title": "题组标题",
  "overview": "这组变式题与原题的关联说明",
  "source_knowledge_points": ["知识点1", "知识点2"],
  "variation_strategy": "本次变式思路",
  "questions": [
    {
      "id": "Q1",
      "difficulty": "easy|medium|hard",
      "type": "题型",
      "stem": "题干",
      "options": ["A", "B"],
      "answer": "答案",
      "analysis": "解析",
      "score": 5
    }
  ]
}
要求：
1. 必须输出合法 json。
2. 题目总数严格等于用户要求数量。
3. 所有题目必须围绕用户确认后的知识点生成，且与原题保持知识结构关联，但题面不能只是机械改数字。
4. 当难度模式为“默认梯度”时，请保证 easy、medium、hard 至少覆盖两种；当难度模式为“难度系数”时，要服从 1 到 10 的整体难度控制。
5. 如果用户指定了题型，请尽量严格遵守题型范围；客观题提供清晰 options，主观题 options 为空数组。
6. 解析要详细、规范，适合教师或学生直接查看。
${STRUCTURED_JSON_REQUIREMENT}
${DETAILED_ANALYSIS_REQUIREMENT}
`,
      },
      {
        role: "user",
        content: `年级：${grade}\n科目：${subject}\n原题：\n${originalQuestion}\n\n确认知识点：${normalizedKnowledge.length ? normalizedKnowledge.join("、") : "未填写"
          }\n题量：${count}\n题型范围：${normalizedTypes.length ? normalizedTypes.join("、") : "未指定，允许混合题型"
          }\n难度模式：${difficultyMode === "coefficient" ? "按难度系数出题" : "默认梯度"}\n难度系数：${difficultyMode === "coefficient" ? `${difficultyCoefficient}/10` : "默认梯度，不单独指定"
          }\n补充要求：${prompt || "围绕确认后的知识点生成几道结构相近但表述不同的训练题。"}\n\n请生成变式题。`,
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 3800,
    temperature: 0.5,
  });
}

export async function requestPaperSet({
  apiKey,
  grade,
  subject,
  knowledgePoints,
  sectionConfigs,
  prompt,
  referencePapers,
}) {
  const normalizedKnowledge = Array.isArray(knowledgePoints)
    ? [...new Set(knowledgePoints.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
  const normalizedSections = Array.isArray(sectionConfigs)
    ? sectionConfigs
      .map((item) => ({
        type: String(item?.type || "").trim(),
        count: Number(item?.count || 0),
      }))
      .filter((item) => item.type && Number.isInteger(item.count) && item.count > 0)
    : [];

  return callDeepSeek({
    apiKey,
    messages: [
      {
        role: "system",
        content: `
你是 edua 智能出卷助手。请根据年级、科目、知识点范围、题型数量要求以及可选参考试卷，生成一份结构完整的试卷。
你必须输出合法 json，格式如下：
{
  "title": "试卷标题",
  "overview": "本卷覆盖范围、命题思路与使用建议",
  "knowledge_points": ["知识点1", "知识点2"],
  "reference_summary": "如有参考试卷，请概括借鉴了哪些风格或结构；没有则说明未使用",
  "sections": [
    {
      "type": "题型",
      "count": 题数,
      "total_score": 总分
    }
  ],
  "questions": [
    {
      "id": "Q1",
      "section_type": "题型",
      "difficulty": "easy|medium|hard",
      "stem": "题干",
      "options": ["A", "B"],
      "answer": "答案",
      "analysis": "解析",
      "score": 5
    }
  ]
}
要求：
1. 必须输出合法 json。
2. questions 总数必须严格等于各题型数量之和，且 section_type 要与 sections 对应。
3. 必须围绕用户给出的知识点命题，覆盖要均衡，不要只集中在单一知识点。
4. 如果提供了参考试卷，请借鉴其题型搭配、措辞风格、难度层次和版式思路，但不要直接照抄原题。
5. 客观题请提供清晰 options；主观题 options 为空数组。
6. 解析必须详细、分步骤、适合单独展示；理科题请尽量用 Markdown + LaTeX 写公式。
7. 试卷整体难度要适中，并保留基础题、提升题和少量综合题的层次。
${STRUCTURED_JSON_REQUIREMENT}
${DETAILED_ANALYSIS_REQUIREMENT}
`,
      },
      {
        role: "user",
        content: `年级：${grade}
科目：${subject}
知识点：${normalizedKnowledge.length ? normalizedKnowledge.join("、") : "未指定"}
题型与数量：${normalizedSections.length ? normalizedSections.map((item) => `${item.type} ${item.count} 题`).join("；") : "未指定"}
补充要求：${prompt || "请生成一份结构清晰、知识点覆盖均衡的试卷。"}

参考试卷：
${buildReferencePaperPrompt(referencePapers)}

请生成一份试卷。`,
      },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 8000,
    temperature: 0.45,
  });
}

async function callDeepSeek({
  apiKey,
  messages,
  responseFormat,
  maxTokens,
  temperature,
}) {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.choices?.length) {
    throw new Error("接口未返回有效回答。");
  }

  return data;
}

export function parseJsonContent(content) {
  const candidates = buildJsonCandidates(content);

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  const preview = typeof content === "string" ? content.slice(0, 600) : content;
  console.warn("[edua] 未能解析结构化 AI 输出", preview);
  return null;
}

function normalizeQuestionTypes(questionTypes) {
  return Array.isArray(questionTypes)
    ? [...new Set(questionTypes.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
}

function buildReferencePaperPrompt(referencePapers) {
  if (!Array.isArray(referencePapers) || !referencePapers.length) {
    return "未提供参考试卷。";
  }

  const MAX_REFERENCE_CHARS = 28000;
  let usedLength = 0;
  const sections = [];

  referencePapers.forEach((item, index) => {
    if (!item?.text) return;
    const available = MAX_REFERENCE_CHARS - usedLength;
    if (available <= 0) return;

    const sourceText = String(item.text).trim();
    const nextText = sourceText.length > available ? `${sourceText.slice(0, available)}\n[后续内容已截断]` : sourceText;
    usedLength += nextText.length;
    sections.push(`参考试卷 ${index + 1}：${item.fileName || "未命名文档"}\n${nextText}`);
  });

  return sections.length ? sections.join("\n\n") : "未提供参考试卷。";
}

function tryParseJsonCandidate(candidate) {
  const variants = buildParseVariants(candidate);

  for (const variant of variants) {
    try {
      const parsed = JSON.parse(variant);
      if (typeof parsed === "string") {
        const nestedParsed = parseJsonContent(parsed);
        return nestedParsed ?? parsed;
      }
      return parsed;
    } catch (error) {
      continue;
    }
  }

  return null;
}

function buildJsonCandidates(content) {
  if (content === null || typeof content === "undefined") {
    return [];
  }

  if (typeof content !== "string") {
    return [JSON.stringify(content)];
  }

  const normalized = stripBom(String(content)).trim();
  if (!normalized) {
    return [];
  }

  const candidates = new Set([normalized]);

  const fenceMatches = normalized.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fenceMatches) {
    if (match[1]?.trim()) {
      candidates.add(match[1].trim());
    }
  }

  extractBalancedJsonSegments(normalized).forEach((segment) => candidates.add(segment));

  return [...candidates];
}

function buildParseVariants(candidate) {
  const trimmed = stripBom(String(candidate || "")).trim();
  if (!trimmed) {
    return [];
  }

  const deFenced = stripCodeFence(trimmed);
  const normalizedQuotes = normalizeSmartQuotes(deFenced);
  const sanitized = sanitizeJsonLikeString(normalizedQuotes);
  const withoutTrailingCommas = removeTrailingCommas(sanitized);

  return [...new Set([trimmed, deFenced, normalizedQuotes, sanitized, withoutTrailingCommas.trim()].filter(Boolean))];
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function stripCodeFence(value) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeSmartQuotes(value) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function removeTrailingCommas(value) {
  return value.replace(/,\s*(?=[}\]])/g, "");
}

function extractBalancedJsonSegments(source) {
  const segments = [];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "{" && source[index] !== "[") {
      continue;
    }

    const endIndex = findBalancedJsonEnd(source, index);
    if (endIndex !== -1) {
      segments.push(source.slice(index, endIndex + 1).trim());
    }
  }

  return segments;
}

function findBalancedJsonEnd(source, startIndex) {
  const stack = [source[startIndex]];
  let inString = false;
  let escaping = false;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const opening = stack.pop();
      if (!isMatchingJsonPair(opening, char)) {
        return -1;
      }

      if (!stack.length) {
        return index;
      }
    }
  }

  return -1;
}

function isMatchingJsonPair(opening, closing) {
  return (opening === "{" && closing === "}") || (opening === "[" && closing === "]");
}

function sanitizeJsonLikeString(value) {
  let result = "";
  let inString = false;
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (!inString) {
      result += char;
      if (char === '"') {
        inString = true;
      }
      continue;
    }

    if (escaping) {
      result += char;
      escaping = false;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = false;
      continue;
    }

    if (char === "\\") {
      const nextChar = value[index + 1];
      const nextNextChar = value[index + 2];

      if (nextChar === '"' || nextChar === "\\" || nextChar === "/") {
        result += char;
        escaping = true;
        continue;
      }

      if (nextChar === "u" && /^[0-9a-fA-F]{4}$/.test(value.slice(index + 2, index + 6))) {
        result += char;
        escaping = true;
        continue;
      }

      if ("bfnrt".includes(nextChar || "")) {
        if (/[A-Za-z]/.test(nextNextChar || "")) {
          result += "\\\\";
          continue;
        }

        result += char;
        escaping = true;
        continue;
      }

      result += "\\\\";
      continue;
    }

    if (char === "\r") {
      result += "\\n";
      if (value[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "\n") {
      result += "\\n";
      continue;
    }

    if (char === "\t") {
      result += "\\t";
      continue;
    }

    result += char;
  }

  return result;
}

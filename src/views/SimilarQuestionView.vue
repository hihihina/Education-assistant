<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import EmptyState from "../components/EmptyState.vue";
import LatexPreview from "../components/LatexPreview.vue";
import RichContent from "../components/RichContent.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import {
  parseJsonContent,
  requestKnowledgeExtraction,
  requestQuestionPreprocess,
  requestSimilarQuestionSet,
} from "../utils/deepseek";
import { exportElementToPdf, exportElementToWord } from "../utils/export";
import { normalizeSimilarQuestionStudioResult } from "../utils/generativeResults";

const route = useRoute();
const router = useRouter();
const store = useEduScopeStore();

const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;
const MIN_DIFFICULTY_COEFFICIENT = 1;
const MAX_DIFFICULTY_COEFFICIENT = 10;

const grade = ref("初一");
const subject = ref("数学");
const originalQuestion = ref("");
const prompt = ref("");
const count = ref(4);
const difficultyMode = ref("default");
const difficultyCoefficient = ref(6);
const selectedQuestionTypes = ref([]);
const preprocessedQuestion = ref("");
const preprocessResult = ref(null);
const preprocessing = ref(false);
const resultExportRef = ref(null);

const gradeOptions = ["小学三年级", "小学四年级", "小学五年级", "小学六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
const subjectOptions = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "政治", "地理"];
const questionTypeOptions = ["选择题", "填空题", "判断题", "简答题", "计算题", "应用题", "实验探究题", "综合大题"];

const extraction = computed(() => store.ai.similarQuestionStudio.extraction);
const paper = computed(() => store.ai.similarQuestionStudio.lastPaper);
const isExtracting = computed(() => store.ai.similarQuestionStudio.extracting);
const isBusy = computed(() => store.ai.similarQuestionStudio.requestInFlight);
const isResultRoute = computed(() => route.name === "question-variant-result");
const hasRenderablePaper = computed(() => Array.isArray(paper.value?.questions) && paper.value.questions.length > 0);
const requestMeta = computed(() => paper.value?.request_meta || null);
const resolvedPaperTitle = computed(() => {
  const title = String(paper.value?.title || "").trim();
  if (title) return title;
  const requestGrade = requestMeta.value?.grade || grade.value;
  const requestSubject = requestMeta.value?.subject || subject.value;
  return `${requestGrade}-${requestSubject}-题目变式结果`;
});
const resolvedPaperOverview = computed(() => {
  const overview = String(paper.value?.overview || "").trim();
  if (overview) return overview;
  const knowledgeText = confirmedKnowledgePoints.value.join("、") || "原题核心知识点";
  return `围绕${knowledgeText}生成了一组可直接练习的变式题。`;
});
const processedPreview = computed(() => preprocessedQuestion.value.trim());
const sourcePreview = computed(() => processedPreview.value || originalQuestion.value.trim());
const preprocessFormulaFixes = computed(() => normalizeStringList(preprocessResult.value?.formula_fixes));
const preprocessNotes = computed(() => normalizeStringList(preprocessResult.value?.normalization_notes));
const confirmedKnowledgePoints = computed(() => {
  if (store.ai.similarQuestionStudio.knowledgeDraft.length) {
    return store.ai.similarQuestionStudio.knowledgeDraft;
  }
  return Array.isArray(paper.value?.source_knowledge_points) ? paper.value.source_knowledge_points : [];
});
const knowledgeDraftText = computed({
  get: () => store.ai.similarQuestionStudio.knowledgeDraft.join("\n"),
  set: (value) => {
    store.ai.similarQuestionStudio.knowledgeDraft = value
      .split(/\n|,|，/)
      .map((item) => item.trim())
      .filter(Boolean);
  },
});
const difficultyDescription = computed(() => {
  if (difficultyMode.value === "coefficient") {
    if (difficultyCoefficient.value <= 3) return "当前按偏基础难度生成变式题";
    if (difficultyCoefficient.value <= 6) return "当前按基础到中等难度生成变式题";
    if (difficultyCoefficient.value <= 8) return "当前按偏提升难度生成变式题";
    return "当前按偏挑战难度生成变式题";
  }
  return "当前按简单 / 中等 / 困难的默认梯度生成变式题";
});
const questionTypeSummary = computed(() =>
  selectedQuestionTypes.value.length ? `当前限定题型：${selectedQuestionTypes.value.join("、")}` : "当前未限制题型，系统会自动混合变式题型"
);

watch(originalQuestion, (value, oldValue) => {
  if (value === oldValue) return;
  preprocessedQuestion.value = "";
  preprocessResult.value = null;
  clearDerivedResults(value.trim() ? "待预处理" : getDefaultStudioStatus());
});

function getDefaultStudioStatus() {
  return store.ai.apiKey ? "待生成" : "待配置";
}

function normalizeStringList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function normalizeCountInput() {
  const numericValue = Number(count.value);
  if (!Number.isFinite(numericValue)) {
    count.value = 4;
    return;
  }

  count.value = Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, Math.trunc(numericValue)));
}

function normalizeDifficultyCoefficient() {
  const numericValue = Number(difficultyCoefficient.value);
  if (!Number.isFinite(numericValue)) {
    difficultyCoefficient.value = 6;
    return;
  }

  difficultyCoefficient.value = Math.min(
    MAX_DIFFICULTY_COEFFICIENT,
    Math.max(MIN_DIFFICULTY_COEFFICIENT, Math.trunc(numericValue))
  );
}

function clearDerivedResults(status = getDefaultStudioStatus()) {
  store.ai.similarQuestionStudio.extraction = null;
  store.ai.similarQuestionStudio.knowledgeDraft = [];
  store.ai.similarQuestionStudio.lastPaper = null;
  store.ai.similarQuestionStudio.status = status;
}

async function preprocessQuestion({ notify = true } = {}) {
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key");
    router.push("/ai?redirect=/question-variant");
    return null;
  }

  if (!originalQuestion.value.trim()) {
    store.showToast("请先输入一道原题");
    return null;
  }

  preprocessing.value = true;
  store.ai.similarQuestionStudio.status = "题目预处理中";

  try {
    const response = await requestQuestionPreprocess({
      apiKey: store.ai.apiKey,
      grade: grade.value,
      subject: subject.value,
      questionText: originalQuestion.value.trim(),
    });
    const content = response.choices?.[0]?.message?.content || "";
    const parsed = parseJsonContent(content);
    const normalizedQuestion = String(parsed?.normalized_question || "").trim();

    if (!normalizedQuestion) {
      throw new Error("未能解析出预处理后的题面");
    }

    store.ai.usage = response.usage || null;
    preprocessedQuestion.value = normalizedQuestion;
    preprocessResult.value = parsed;
    clearDerivedResults("预处理完成");

    if (notify) {
      store.showToast("题目预处理完成，已切换为处理后预览");
    }

    return normalizedQuestion;
  } catch (error) {
    store.ai.similarQuestionStudio.status = "预处理失败";
    store.showToast(`题目预处理失败：${error.message || "请检查网络或 API Key"}`);
    return null;
  } finally {
    preprocessing.value = false;
  }
}

async function ensurePreprocessedQuestion() {
  if (preprocessedQuestion.value.trim()) {
    return preprocessedQuestion.value.trim();
  }

  return preprocessQuestion({ notify: false });
}

async function extractKnowledge() {
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key");
    router.push("/ai?redirect=/question-variant");
    return;
  }

  if (!originalQuestion.value.trim()) {
    store.showToast("请先输入一道原题");
    return;
  }

  const questionText = await ensurePreprocessedQuestion();
  if (!questionText) {
    return;
  }

  store.ai.similarQuestionStudio.extracting = true;
  store.ai.similarQuestionStudio.status = "知识点提取中";

  try {
    const response = await requestKnowledgeExtraction({
      apiKey: store.ai.apiKey,
      grade: grade.value,
      subject: subject.value,
      questionText,
    });
    const content = response.choices?.[0]?.message?.content || "";
    const parsed = parseJsonContent(content);
    if (!parsed) throw new Error("未能解析出知识点提取结果");

    store.ai.usage = response.usage || null;
    store.ai.similarQuestionStudio.extraction = parsed;
    store.ai.similarQuestionStudio.knowledgeDraft = Array.isArray(parsed.knowledge_points) ? parsed.knowledge_points : [];
    store.ai.similarQuestionStudio.lastPaper = null;
    store.ai.similarQuestionStudio.status = "知识点已提取";
    store.showToast("原题知识点已提取，可继续修改后生成变式题");
  } catch (error) {
    store.ai.similarQuestionStudio.status = "提取失败";
    store.showToast(`知识点提取失败：${error.message || "请检查网络或 API Key"}`);
  } finally {
    store.ai.similarQuestionStudio.extracting = false;
  }
}

async function generateVariantPaper() {
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key");
    router.push("/ai?redirect=/question-variant");
    return;
  }

  if (!originalQuestion.value.trim()) {
    store.showToast("请先输入一道原题");
    return;
  }

  const questionText = await ensurePreprocessedQuestion();
  if (!questionText) {
    return;
  }

  const normalizedCount = Number(count.value);
  if (!Number.isInteger(normalizedCount) || normalizedCount < MIN_QUESTION_COUNT || normalizedCount > MAX_QUESTION_COUNT) {
    store.showToast(`题量请输入 ${MIN_QUESTION_COUNT} 到 ${MAX_QUESTION_COUNT} 之间的整数`);
    return;
  }

  normalizeDifficultyCoefficient();
  if (!store.ai.similarQuestionStudio.knowledgeDraft.length) {
    store.showToast("请先提取并确认知识点");
    return;
  }

  store.ai.similarQuestionStudio.requestInFlight = true;
  store.ai.similarQuestionStudio.status = "变式题生成中";

  try {
    const response = await requestSimilarQuestionSet({
      apiKey: store.ai.apiKey,
      grade: grade.value,
      subject: subject.value,
      originalQuestion: questionText,
      knowledgePoints: store.ai.similarQuestionStudio.knowledgeDraft,
      prompt: prompt.value,
      count: normalizedCount,
      questionTypes: selectedQuestionTypes.value,
      difficultyMode: difficultyMode.value,
      difficultyCoefficient: difficultyMode.value === "coefficient" ? Number(difficultyCoefficient.value) : null,
    });
    const content = response.choices?.[0]?.message?.content || "";
    const parsed = parseJsonContent(content);
    const normalizedPaper = normalizeSimilarQuestionStudioResult(parsed ?? content, {
      grade: grade.value,
      subject: subject.value,
      originalQuestion: questionText,
      knowledgePoints: store.ai.similarQuestionStudio.knowledgeDraft,
      prompt: prompt.value,
      count: normalizedCount,
      questionTypes: selectedQuestionTypes.value,
      difficultyMode: difficultyMode.value,
      difficultyCoefficient: difficultyMode.value === "coefficient" ? Number(difficultyCoefficient.value) : null,
    });

    store.ai.usage = response.usage || null;
    store.ai.similarQuestionStudio.lastPaper = normalizedPaper;
    store.ai.similarQuestionStudio.status = "生成完成";
    store.showToast(
      normalizedPaper.warnings?.length ? `题目变式已生成，已自动修复 ${normalizedPaper.warnings.length} 处结果字段` : "题目变式已生成"
    );
    router.push("/question-variant/result");
  } catch (error) {
    store.ai.similarQuestionStudio.status = "生成失败";
    store.showToast(`题目变式生成失败：${error.message || "请检查网络或 API Key"}`);
  } finally {
    store.ai.similarQuestionStudio.requestInFlight = false;
  }
}

async function copyPaper() {
  if (!paper.value) {
    store.showToast("当前没有可复制的变式题结果");
    return;
  }

  const lines = [
    resolvedPaperTitle.value,
    resolvedPaperOverview.value,
    `知识点：${(paper.value.source_knowledge_points || []).join("、")}`,
    paper.value.variation_strategy ? `变式说明：${paper.value.variation_strategy}` : "",
    "",
    ...(paper.value.questions || []).flatMap((question, index) => [
      `${index + 1}. [${question.difficulty}] ${question.stem}`,
      question.options?.length ? question.options.map((option) => `- ${option}`).join("\n") : "",
      `答案：${question.answer}`,
      `解析：${question.analysis}`,
      "",
    ]),
  ].filter(Boolean);

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    store.showToast("变式题内容已复制");
  } catch (error) {
    store.showToast("当前环境不支持自动复制，请手动复制变式题内容");
  }
}

async function exportPdf() {
  if (!paper.value || !resultExportRef.value) {
    store.showToast("当前没有可导出的变式题结果");
    return;
  }

  store.showToast("正在导出 PDF");
  await exportElementToPdf(resultExportRef.value, getExportTitle());
}

async function exportWord() {
  if (!paper.value || !resultExportRef.value) {
    store.showToast("当前没有可导出的变式题结果");
    return;
  }

  await exportElementToWord(resultExportRef.value, getExportTitle());
  store.showToast("Word 文档已开始导出");
}

function getExportTitle() {
  return resolvedPaperTitle.value;
}

function toggleQuestionType(type) {
  if (selectedQuestionTypes.value.includes(type)) {
    selectedQuestionTypes.value = selectedQuestionTypes.value.filter((item) => item !== type);
    return;
  }
  selectedQuestionTypes.value = [...selectedQuestionTypes.value, type];
}

function clearQuestionTypes() {
  selectedQuestionTypes.value = [];
}

function clearWorkspace() {
  grade.value = "初一";
  subject.value = "数学";
  originalQuestion.value = "";
  prompt.value = "";
  count.value = 4;
  difficultyMode.value = "default";
  difficultyCoefficient.value = 6;
  selectedQuestionTypes.value = [];
  preprocessedQuestion.value = "";
  preprocessResult.value = null;
  store.resetSimilarQuestionStudio();
  store.showToast("题目变式参数已清空");
}

function clearResult() {
  store.resetSimilarQuestionStudio();
  store.showToast("变式题结果已清空");
}

function goToAiWorkspace() {
  router.push("/ai");
}

function goToSetup() {
  router.push("/question-variant");
}
</script>

<template>
  <section class="studio-page">
    <header class="page-head">
      <div>
        <p class="page-head__eyebrow">{{ isResultRoute ? "题目变式结果" : "题目变式" }}</p>
        <h2 v-if="!isResultRoute">先完成原题预处理和知识点确认，再跳转到独立结果页查看生成内容</h2>
        <h2 v-else>本次题目变式结果已生成，可返回修改要求或直接导出文档</h2>
        <p class="page-head__lead">
          {{
            isResultRoute
              ? "结果页会保留处理后的原题、确认知识点和生成结果，支持复制、PDF 导出和 Word 导出"
              : "设置页专门负责原题输入、AI 预处理、知识点提取和生成要求填写，结果不再和设置混在一起"
          }}
        </p>
      </div>
      <div class="page-head__actions">
        <button v-if="isResultRoute" class="page-btn page-btn--ghost" type="button" @click="goToSetup">返回修改要求</button>
        <button v-else class="page-btn page-btn--ghost" type="button" @click="clearWorkspace">清空参数</button>
        <button class="page-btn page-btn--primary" type="button" @click="goToAiWorkspace">AI 配置</button>
      </div>
    </header>

    <template v-if="!isResultRoute">
      <div class="setup-shell">
        <SurfacePanel title="原题与知识点" eyebrow="Variant Setup">
          <div class="setup-form">
            <div class="field-grid">
              <label class="field">
                <span>年级</span>
                <select v-model="grade">
                  <option v-for="item in gradeOptions" :key="item" :value="item">{{ item }}</option>
                </select>
              </label>
              <label class="field">
                <span>科目</span>
                <select v-model="subject">
                  <option v-for="item in subjectOptions" :key="item" :value="item">{{ item }}</option>
                </select>
              </label>
            </div>

            <label class="field field--question">
              <span>原题输入</span>
              <textarea
                v-model="originalQuestion"
                rows="8"
                placeholder="输入一道原题，支持题干、选项、已知条件等完整信息。公式可以用普通文本输入，系统会先做 AI 预处理。"
              ></textarea>
              <small>也支持直接输入 LaTeX，例如 `$x^2+2x+1$` 或 `$$\\frac{a}{b}$$`</small>
            </label>

            <div class="field field--preview">
              <div class="field-head">
                <span>AI 预处理后预览</span>
                <button class="text-btn" type="button" :disabled="preprocessing" @click="preprocessQuestion()">
                  {{ preprocessing ? "题目预处理中..." : processedPreview ? "重新预处理题目" : "AI 预处理题目" }}
                </button>
              </div>
              <LatexPreview
                :content="processedPreview"
                empty-text="点击上方按钮后，这里会展示 AI 规范化后的题面与公式预览"
              />
              <small>后续知识点提取和变式题生成会优先基于这份处理后的题面</small>
            </div>

            <div v-if="preprocessFormulaFixes.length || preprocessNotes.length" class="summary-card summary-card--preprocess summary-card--full">
              <div v-if="preprocessFormulaFixes.length" class="summary-card__stack">
                <span>公式处理</span>
                <div class="tag-list">
                  <span v-for="item in preprocessFormulaFixes" :key="item" class="tag-chip">{{ item }}</span>
                </div>
              </div>
              <div v-if="preprocessNotes.length" class="summary-card__stack">
                <span>版式处理</span>
                <div class="tag-list">
                  <span v-for="item in preprocessNotes" :key="item" class="tag-chip">{{ item }}</span>
                </div>
              </div>
            </div>

            <div class="setup-actions setup-actions--full">
              <button class="page-btn page-btn--ghost" type="button" :disabled="isExtracting || preprocessing" @click="extractKnowledge">
                {{ preprocessing ? "题目预处理中..." : isExtracting ? "提取中..." : "提取知识点" }}
              </button>
            </div>

            <div v-if="extraction" class="summary-card summary-card--analysis">
              <div class="summary-card__row">
                <span>识别题型</span>
                <strong>{{ extraction.question_type || "--" }}</strong>
              </div>
              <div class="summary-card__row">
                <span>难度判断</span>
                <strong>{{ extraction.difficulty_hint || "--" }}</strong>
              </div>
              <div class="summary-card__stack">
                <span>能力要求</span>
                <div class="tag-list">
                  <span v-for="item in extraction.ability_points || []" :key="item" class="tag-chip">{{ item }}</span>
                </div>
              </div>
              <p>{{ extraction.summary }}</p>
            </div>

            <label class="field field--knowledge">
              <span>确认知识点</span>
              <textarea
                v-model="knowledgeDraftText"
                rows="6"
                placeholder="每行一个知识点，也支持用中文逗号分隔"
              ></textarea>
              <small>提取后可手动补充、删除或修改知识点，再用于生成变式题</small>
            </label>

            <label class="field">
              <span>题量</span>
              <input
                v-model.number="count"
                type="number"
                :min="MIN_QUESTION_COUNT"
                :max="MAX_QUESTION_COUNT"
                step="1"
                placeholder="请输入题量"
                @blur="normalizeCountInput"
              />
              <small>当前支持生成 {{ MIN_QUESTION_COUNT }} 到 {{ MAX_QUESTION_COUNT }} 道变式题</small>
            </label>

            <div class="field field--types">
              <span>题型选择</span>
              <div class="type-chip-list">
                <button
                  v-for="item in questionTypeOptions"
                  :key="item"
                  class="type-chip"
                  :class="{ 'type-chip--active': selectedQuestionTypes.includes(item) }"
                  type="button"
                  @click="toggleQuestionType(item)"
                >
                  {{ item }}
                </button>
              </div>
              <div class="field-toolbar">
                <small>{{ questionTypeSummary }}</small>
                <button class="text-btn" type="button" @click="clearQuestionTypes">不限题型</button>
              </div>
            </div>

            <div class="field field--difficulty">
              <span>难度设置</span>
              <div class="difficulty-mode-grid">
                <label class="difficulty-mode-card" :class="{ 'difficulty-mode-card--active': difficultyMode === 'default' }">
                  <input v-model="difficultyMode" type="radio" value="default" />
                  <strong>默认梯度</strong>
                  <p>按简单、中等、困难的梯度生成变式题</p>
                </label>
                <label
                  class="difficulty-mode-card"
                  :class="{ 'difficulty-mode-card--active': difficultyMode === 'coefficient' }"
                >
                  <input v-model="difficultyMode" type="radio" value="coefficient" />
                  <strong>难度系数</strong>
                  <p>按系数控制整组变式题的整体难度</p>
                </label>
              </div>
              <div v-if="difficultyMode === 'coefficient'" class="difficulty-factor">
                <input
                  v-model.number="difficultyCoefficient"
                  type="number"
                  :min="MIN_DIFFICULTY_COEFFICIENT"
                  :max="MAX_DIFFICULTY_COEFFICIENT"
                  step="1"
                  placeholder="请输入难度系数"
                  @blur="normalizeDifficultyCoefficient"
                />
                <small>
                  当前支持 {{ MIN_DIFFICULTY_COEFFICIENT }} 到 {{ MAX_DIFFICULTY_COEFFICIENT }}。数值越高，题目越偏提升与挑战。
                </small>
              </div>
            </div>

            <label class="field field--prompt">
              <span>补充要求</span>
              <textarea
                v-model="prompt"
                rows="6"
                placeholder="例如：保留应用题情境；加入 1 道提升题；更适合作业训练。"
              ></textarea>
            </label>

            <div class="status-card">
              <strong>{{ store.ai.similarQuestionStudio.status }}</strong>
              <p>{{ difficultyDescription }}</p>
            </div>

            <div class="setup-actions">
              <button
                class="page-btn page-btn--primary"
                type="button"
                :disabled="isBusy || preprocessing || isExtracting"
                @click="generateVariantPaper"
              >
                {{ preprocessing ? "题目预处理中..." : isBusy ? "生成中..." : "生成变式题并查看结果" }}
              </button>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </template>

    <template v-else>
      <div v-if="!hasRenderablePaper" class="result-empty">
        <EmptyState
          :title="paper ? '本次变式结果不完整' : '还没有生成变式题结果'"
          :description="
            paper
              ? 'AI 已返回内容，但变式题列表或关键字段不完整。请返回重新生成，系统会优先自动修复后再展示。'
              : '请先返回参数页填写要求，生成后再到结果页查看。'
          "
        >
          <button class="page-btn page-btn--primary" type="button" @click="goToSetup">返回参数页</button>
        </EmptyState>
      </div>

      <template v-else>
        <div class="result-toolbar">
          <button class="page-btn page-btn--ghost" type="button" @click="copyPaper">复制内容</button>
          <button class="page-btn page-btn--ghost" type="button" @click="exportPdf">导出 PDF</button>
          <button class="page-btn page-btn--ghost" type="button" @click="exportWord">导出 Word</button>
          <button class="page-btn page-btn--ghost" type="button" @click="clearResult">清空结果</button>
        </div>

        <div ref="resultExportRef" class="export-stage">
          <SurfacePanel title="原题与知识点" eyebrow="Source Context">
            <div class="result-summary-grid">
              <div class="summary-box">
                <strong>处理后的原题</strong>
                <LatexPreview :content="sourcePreview" empty-text="暂无原题内容" />
              </div>
              <div class="summary-box summary-box--side">
                <div class="mix-card">
                  <span>变式说明</span>
                  <strong>{{ paper.variation_strategy || "围绕原题核心知识点生成" }}</strong>
                </div>
                <div class="summary-box__stack">
                  <strong>确认知识点</strong>
                  <div class="tag-list">
                    <span v-for="item in confirmedKnowledgePoints" :key="item" class="tag-chip">{{ item }}</span>
                  </div>
                </div>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel title="变式题结果" eyebrow="Generated Variants">
            <div class="paper-hero">
              <div>
                <h3>{{ resolvedPaperTitle }}</h3>
                <p>{{ resolvedPaperOverview }}</p>
              </div>
            </div>

            <div class="paper-list">
              <article v-for="(question, index) in paper.questions || []" :key="question.id || index" class="paper-item">
                <div class="paper-item__head">
                  <span class="paper-item__index">第 {{ index + 1 }} 题</span>
                  <span class="paper-item__difficulty" :class="`paper-item__difficulty--${question.difficulty}`">
                    {{ question.difficulty }}
                  </span>
                  <span class="paper-item__type">{{ question.type }}</span>
                  <span class="paper-item__score">{{ question.score }} 分</span>
                </div>

                <RichContent class="paper-item__stem" :content="question.stem" />

                <div v-if="question.options?.length" class="option-grid">
                  <article v-for="(option, optionIndex) in question.options" :key="optionIndex" class="option-card">
                    <RichContent :content="option" />
                  </article>
                </div>

                <div class="paper-item__detail-stack">
                  <section class="paper-item__detail-box">
                    <strong>答案</strong>
                    <RichContent :content="question.answer" />
                  </section>
                  <section class="paper-item__detail-box paper-item__detail-box--analysis">
                    <strong>解析</strong>
                    <RichContent :content="question.analysis" />
                  </section>
                </div>
              </article>
            </div>
          </SurfacePanel>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.studio-page {
  display: grid;
  gap: 22px;
  align-content: start;
}

.page-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
}

.page-head__eyebrow,
.paper-item__index,
.paper-item__type,
.paper-item__score {
  margin: 0;
  font-size: var(--font-size-meta);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.page-head__eyebrow {
  color: var(--copper);
}

.page-head h2 {
  margin: 12px 0 0;
  font-size: clamp(1.9rem, 3vw, 3rem);
  line-height: 1.12;
}

.page-head__lead,
.field span,
.field small,
.paper-hero p,
.difficulty-mode-card p,
.status-card p,
.mix-card span,
.field-toolbar small,
.summary-card p,
.summary-card__row span,
.summary-card__stack span {
  color: var(--ink-soft);
}

.page-head__lead {
  margin: 14px 0 0;
}

.page-head__actions,
.result-toolbar,
.setup-actions,
.summary-card__row,
.field-head,
.field-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.field-head,
.field-toolbar {
  align-items: center;
  justify-content: space-between;
}

.summary-card__row {
  justify-content: space-between;
}

.page-btn,
.type-chip {
  transition: 180ms ease;
}

.page-btn {
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

.page-btn--primary {
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: var(--paper-strong);
}

.page-btn--ghost {
  background: var(--ghost-bg);
}

.setup-shell {
  width: 100%;
}

.setup-form,
.paper-list,
.paper-item__detail-stack,
.type-chip-list,
.tag-list,
.summary-card,
.summary-card__stack,
.export-stage {
  display: grid;
  gap: 16px;
}

.field,
.field-grid,
.result-summary-grid,
.summary-box,
.summary-box__stack {
  display: grid;
  gap: 12px;
}

.setup-form {
  grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
  gap: 18px;
  align-items: start;
}

.field-grid,
.summary-card--full,
.setup-actions--full,
.field--types,
.field--difficulty,
.field--prompt {
  grid-column: 1 / -1;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 14px 16px;
  border-radius: 16px;
}

.field,
.summary-card,
.status-card,
.mix-card,
.summary-box {
  min-width: 0;
}

.field {
  padding: 14px;
  border: 1px solid rgba(10, 36, 99, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
}

.field--preview {
  position: sticky;
  top: 14px;
  align-self: start;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 247, 251, 0.9));
}

.field-grid,
.difficulty-mode-grid,
.result-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.type-chip-list {
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}

.type-chip,
.difficulty-mode-card,
.paper-item__detail-box,
.option-card,
.summary-card,
.status-card,
.mix-card,
.summary-box {
  border: 1px solid var(--line);
}

.type-chip {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(249, 250, 251, 0.92);
}

.type-chip--active {
  border-color: rgba(10, 36, 99, 0.26);
  background: rgba(10, 36, 99, 0.12);
  color: var(--copper);
}

.text-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--copper);
  font-weight: 700;
}

.text-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.difficulty-mode-card {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.92);
  cursor: pointer;
}

.difficulty-mode-card input {
  display: none;
}

.difficulty-mode-card strong,
.paper-item__detail-box strong,
.summary-card strong,
.status-card strong,
.mix-card strong,
.summary-box strong {
  display: block;
}

.difficulty-mode-card p,
.summary-card p {
  margin: 0;
  line-height: 1.6;
}

.difficulty-mode-card--active {
  border-color: rgba(10, 36, 99, 0.22);
  box-shadow: inset 0 0 0 1px rgba(10, 36, 99, 0.1);
}

.difficulty-factor {
  display: grid;
  gap: 10px;
}

.summary-card,
.status-card,
.mix-card,
.summary-box {
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 247, 251, 0.9));
}

.summary-card--preprocess {
  background: rgba(239, 247, 255, 0.9);
}

.setup-actions {
  justify-content: flex-end;
}

.setup-actions--full {
  justify-content: flex-start;
}

.status-card {
  border-color: rgba(10, 36, 99, 0.2);
}

.summary-box--side {
  align-content: start;
}

.tag-list {
  grid-template-columns: repeat(auto-fit, minmax(120px, max-content));
  gap: 10px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(10, 36, 99, 0.08);
  color: var(--copper);
  font-weight: 700;
}

.result-empty {
  display: grid;
}

.result-toolbar {
  justify-content: flex-end;
}

.paper-list {
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
}

.paper-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 10px;
}

.paper-hero h3 {
  margin: 0;
}

.paper-hero p {
  margin: 10px 0 0;
}

.mix-card strong,
.status-card p {
  margin-top: 8px;
}

.paper-item {
  height: 100%;
  padding: 20px;
  border-radius: 22px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
}

.paper-item__head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.paper-item__index,
.paper-item__type,
.paper-item__score,
.paper-item__difficulty {
  display: inline-flex;
  align-items: center;
  padding: 7px 11px;
  border-radius: 999px;
}

.paper-item__index,
.paper-item__type,
.paper-item__score {
  background: rgba(10, 36, 99, 0.08);
  color: var(--ink-soft);
}

.paper-item__difficulty--easy {
  background: rgba(39, 165, 111, 0.14);
  color: var(--success);
}

.paper-item__difficulty--medium {
  background: rgba(10, 36, 99, 0.12);
  color: var(--copper);
}

.paper-item__difficulty--hard {
  background: rgba(227, 93, 103, 0.14);
  color: var(--danger);
}

.paper-item__stem {
  margin-top: 16px;
  font-size: 1.08rem;
  line-height: 1.65;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.option-card {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(249, 250, 251, 0.86);
}

.paper-item__detail-stack {
  margin-top: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.paper-item__detail-box {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.86);
}

.paper-item__detail-box--analysis {
  background: rgba(243, 244, 246, 0.72);
}

.field,
.type-chip,
.difficulty-mode-card,
.summary-card,
.status-card,
.mix-card,
.summary-box,
.paper-item,
.option-card,
.paper-item__detail-box {
  position: relative;
  overflow: hidden;
  border-color: var(--card-border);
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 220ms ease;
}

.type-chip--active {
  border-color: var(--primary-26);
  background: linear-gradient(148deg, var(--primary-12), var(--accent-12));
  box-shadow: inset 0 0 0 1px var(--primary-10);
  color: var(--copper);
}

.difficulty-mode-card--active {
  border-color: var(--primary-24);
  box-shadow: inset 0 0 0 1px var(--primary-12), var(--card-shadow);
}

.summary-card--preprocess,
.paper-item__detail-box--analysis {
  background: linear-gradient(156deg, var(--accent-08), var(--surface-96) 64%);
}

.field:hover,
.type-chip:hover,
.difficulty-mode-card:hover,
.paper-item:hover {
  transform: translateY(-2px);
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
}

.paper-item__detail-box :deep(.rich-content),
.option-card :deep(.rich-content) {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .page-head {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .setup-form,
  .paper-list,
  .paper-item__detail-stack,
  .field-grid,
  .difficulty-mode-grid,
  .result-summary-grid {
    grid-template-columns: 1fr;
  }

  .field--preview {
    position: static;
  }

  .field-head,
  .field-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

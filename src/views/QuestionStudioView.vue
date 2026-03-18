<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import EmptyState from "../components/EmptyState.vue";
import RichContent from "../components/RichContent.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { parseJsonContent, requestQuestionSet } from "../utils/deepseek";
import { exportElementToPdf, exportElementToWord } from "../utils/export";
import { normalizeQuestionStudioResult } from "../utils/generativeResults";

const route = useRoute();
const router = useRouter();
const store = useEduScopeStore();

const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 30;
const MIN_DIFFICULTY_COEFFICIENT = 1;
const MAX_DIFFICULTY_COEFFICIENT = 10;

const grade = ref("初一");
const subject = ref("数学");
const count = ref(8);
const prompt = ref("");
const difficultyMode = ref("default");
const difficultyCoefficient = ref(6);
const selectedQuestionTypes = ref([]);
const resultExportRef = ref(null);

const gradeOptions = ["小学三年级", "小学四年级", "小学五年级", "小学六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
const subjectOptions = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "政治", "地理"];
const questionTypeOptions = ["选择题", "填空题", "判断题", "简答题", "计算题", "应用题", "实验探究题", "综合大题"];
const promptPresets = [
  "覆盖本单元核心知识点，基础题和提升题都要有",
  "加入生活化场景应用题，并保留少量挑战题",
  "更适合课堂小测，题目表达简洁一些",
  "额外加入 1 道综合题，解析更偏教学提示",
];

const paper = computed(() => store.ai.questionStudio.lastPaper);
const isBusy = computed(() => store.ai.questionStudio.requestInFlight);
const isResultRoute = computed(() => route.name === "question-studio-result");
const hasRenderablePaper = computed(() => Boolean(paper.value));
const hasStructuredQuestions = computed(() => Array.isArray(paper.value?.questions) && paper.value.questions.length > 0);
const rawResponseContent = computed(() => String(paper.value?.raw_response || "").trim());
const requestMeta = computed(() => paper.value?.request_meta || null);
const resolvedPaperTitle = computed(() => {
  const title = String(paper.value?.title || "").trim();
  if (title) return title;
  const requestGrade = requestMeta.value?.grade || grade.value;
  const requestSubject = requestMeta.value?.subject || subject.value;
  return `${requestGrade}-${requestSubject}-智能出题结果`;
});
const resolvedPaperOverview = computed(() => {
  const overview = String(paper.value?.overview || "").trim();
  if (overview) return overview;

  const requestCount = requestMeta.value?.requestedCount ?? paper.value?.questions?.length ?? count.value;
  const typeSummary = requestMeta.value?.questionTypes?.length ? requestMeta.value.questionTypes.join("、") : "混合题型";
  return `共生成 ${requestCount} 道练习题，题型范围为${typeSummary}，${getDifficultyRequestSummary(requestMeta.value)}。`;
});
const resultDifficultySummary = computed(() => {
  const mix = paper.value?.difficulty_mix || {};
  return `易 ${mix.easy ?? "--"} · 中 ${mix.medium ?? "--"} · 难 ${mix.hard ?? "--"}`;
});
const resultDifficultyRequestLabel = computed(() => getDifficultyRequestLabel(requestMeta.value));
const difficultyDescription = computed(() => {
  if (difficultyMode.value === "coefficient") {
    if (difficultyCoefficient.value <= 3) return "当前按偏基础难度生成";
    if (difficultyCoefficient.value <= 6) return "当前按基础到中等难度生成";
    if (difficultyCoefficient.value <= 8) return "当前按偏提升难度生成";
    return "当前按偏挑战难度生成";
  }
  return "当前按简单 / 中等 / 困难的默认梯度混合出题";
});
const questionTypeSummary = computed(() =>
  selectedQuestionTypes.value.length ? `当前限定题型：${selectedQuestionTypes.value.join("、")}` : "当前未限制题型，系统会自动混合出题"
);

function normalizeCountInput() {
  if (count.value === "" || count.value === null || typeof count.value === "undefined") {
    count.value = 8;
    return;
  }

  const numericValue = Number(count.value);
  if (!Number.isFinite(numericValue)) {
    count.value = 8;
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

async function generatePaper() {
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key");
    router.push("/ai?redirect=/question-studio");
    return;
  }

  const normalizedCount = Number(count.value);
  if (!Number.isInteger(normalizedCount) || normalizedCount < MIN_QUESTION_COUNT || normalizedCount > MAX_QUESTION_COUNT) {
    store.showToast(`题量请输入 ${MIN_QUESTION_COUNT} 到 ${MAX_QUESTION_COUNT} 之间的整数`);
    return;
  }

  normalizeDifficultyCoefficient();
  if (
    difficultyMode.value === "coefficient" &&
    (!Number.isInteger(Number(difficultyCoefficient.value)) ||
      difficultyCoefficient.value < MIN_DIFFICULTY_COEFFICIENT ||
      difficultyCoefficient.value > MAX_DIFFICULTY_COEFFICIENT)
  ) {
    store.showToast(`难度系数请输入 ${MIN_DIFFICULTY_COEFFICIENT} 到 ${MAX_DIFFICULTY_COEFFICIENT} 之间的整数`);
    return;
  }

  store.ai.questionStudio.requestInFlight = true;
  store.ai.questionStudio.status = "生成中";

  try {
    const requestOptions = {
      apiKey: store.ai.apiKey,
      grade: grade.value,
      subject: subject.value,
      prompt: prompt.value,
      count: normalizedCount,
      questionTypes: [...selectedQuestionTypes.value],
      difficultyMode: difficultyMode.value,
      difficultyCoefficient: difficultyMode.value === "coefficient" ? Number(difficultyCoefficient.value) : null,
    };
    const response = await requestQuestionSet(requestOptions);
    const content = response.choices?.[0]?.message?.content || "";
    const parsed = parseJsonContent(content);
    const normalizedPaper = normalizeQuestionStudioResult(parsed ?? content, requestOptions);

    store.ai.usage = response.usage || null;
    store.ai.questionStudio.lastPaper = normalizedPaper;
    store.ai.questionStudio.status = "生成完成";
    store.showToast("智能出题已生成");
    /*
    store.showToast(
      normalizedPaper.warnings?.length
        ? `智能出题已生成，已自动修复 ${normalizedPaper.warnings.length} 处结果字段`
        : "智能出题已生成"
    );
    */
    router.push("/question-studio/result");
  } catch (error) {
    store.ai.questionStudio.status = "生成失败";
    store.showToast(`智能出题失败：${error.message || "请检查网络或 API Key"}`);
  } finally {
    store.ai.questionStudio.requestInFlight = false;
  }
}

async function copyPaper() {
  if (!paper.value) {
    store.showToast("当前没有可复制的题目结果");
    return;
  }

  const questionLines = hasStructuredQuestions.value ? [] : [rawResponseContent.value];

  const lines = [
    resolvedPaperTitle.value,
    resolvedPaperOverview.value,
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
    store.showToast("题目内容已复制");
  } catch (error) {
    store.showToast("当前环境不支持自动复制，请手动复制题目内容");
  }
}

async function exportPdf() {
  if (!paper.value || !resultExportRef.value) {
    store.showToast("当前没有可导出的题目结果");
    return;
  }

  store.showToast("正在导出 PDF");
  await exportElementToPdf(resultExportRef.value, getExportTitle());
}

async function exportWord() {
  if (!paper.value || !resultExportRef.value) {
    store.showToast("当前没有可导出的题目结果");
    return;
  }

  await exportElementToWord(resultExportRef.value, getExportTitle());
  store.showToast("Word 文档已开始导出");
}

function getExportTitle() {
  return resolvedPaperTitle.value;
}

function clearWorkspace() {
  grade.value = "初一";
  subject.value = "数学";
  count.value = 8;
  prompt.value = "";
  difficultyMode.value = "default";
  difficultyCoefficient.value = 6;
  selectedQuestionTypes.value = [];
  store.resetQuestionStudio();
  store.showToast("智能出题参数已清空");
}

function clearResult() {
  store.resetQuestionStudio();
  store.showToast("题目结果已清空");
}

function appendPrompt(text) {
  prompt.value = prompt.value ? `${prompt.value}\n${text}` : text;
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

function goToAiWorkspace() {
  router.push("/ai");
}

function goToSetup() {
  router.push("/question-studio");
}

function getDifficultyRequestSummary(meta) {
  if (!meta) {
    return "难度按系统默认策略生成";
  }

  if (meta.difficultyMode === "coefficient") {
    return `按难度系数 ${meta.difficultyCoefficient}/10 生成`;
  }

  return "按默认梯度生成，保持难易结合";
}

function getDifficultyRequestLabel(meta) {
  if (!meta) {
    return "本次未记录难度请求";
  }

  if (meta.difficultyMode === "coefficient") {
    if (meta.difficultyCoefficient <= 3) return `请求难度：系数 ${meta.difficultyCoefficient}/10，偏基础`;
    if (meta.difficultyCoefficient <= 6) return `请求难度：系数 ${meta.difficultyCoefficient}/10，基础到中等`;
    if (meta.difficultyCoefficient <= 8) return `请求难度：系数 ${meta.difficultyCoefficient}/10，偏提升`;
    return `请求难度：系数 ${meta.difficultyCoefficient}/10，偏挑战`;
  }

  return "请求难度：默认梯度";
}
</script>

<template>
  <section class="studio-page">
    <header class="page-head">
      <div>
        <p class="page-head__eyebrow">{{ isResultRoute ? "智能出题结果" : "智能出题" }}</p>
        <h2 v-if="!isResultRoute">先填写出题要求，生成后再跳转到结果页面查看完整题目</h2>
        <h2 v-else>本次智能出题结果已生成，可返回修改要求或直接导出文档</h2>
        <p class="page-head__lead">
          {{
            isResultRoute
              ? "结果页面聚合了题目、答案和详细解析，并支持复制、PDF 导出和 Word 导出"
              : "设置页只负责填写参数。生成成功后会进入独立结果页，避免要求区和输出区混在一起"
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
        <SurfacePanel title="出题参数" eyebrow="Question Setup">
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

            <label class="field field--count">
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
              <small>支持自定义题量，当前可生成 {{ MIN_QUESTION_COUNT }} 到 {{ MAX_QUESTION_COUNT }} 题</small>
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
                  <p>按简单、中等、困难的梯度混合出题</p>
                </label>
                <label
                  class="difficulty-mode-card"
                  :class="{ 'difficulty-mode-card--active': difficultyMode === 'coefficient' }"
                >
                  <input v-model="difficultyMode" type="radio" value="coefficient" />
                  <strong>难度系数</strong>
                  <p>按系数控制整套题的整体难度</p>
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
                  当前支持 {{ MIN_DIFFICULTY_COEFFICIENT }} 到 {{ MAX_DIFFICULTY_COEFFICIENT }}。数值越高，整套题越偏提升与挑战。
                </small>
              </div>
            </div>

            <label class="field field--prompt">
              <span>补充要求</span>
              <textarea
                v-model="prompt"
                rows="8"
                placeholder="例如：围绕一元二次方程应用题；加入 2 道选择题和 1 道综合题；强调难易梯度。"
              ></textarea>
            </label>

            <div class="preset-list preset-list--full">
              <button
                v-for="item in promptPresets"
                :key="item"
                class="preset-chip"
                type="button"
                @click="appendPrompt(item)"
              >
                {{ item }}
              </button>
            </div>

            <div class="status-card">
              <strong>{{ store.ai.questionStudio.status }}</strong>
              <p>{{ difficultyDescription }}</p>
            </div>

            <div class="setup-actions">
              <button class="page-btn page-btn--primary" type="button" :disabled="isBusy" @click="generatePaper">
                {{ isBusy ? "生成中..." : "生成题目并查看结果" }}
              </button>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </template>

    <template v-else>
      <div v-if="!hasRenderablePaper" class="result-empty">
        <EmptyState
          :title="paper ? '本次生成结果不完整' : '还没有生成题目结果'"
          :description="
            paper
              ? 'AI 已返回内容，但题目列表或关键字段不完整。请返回重新生成，系统现在会优先校验题量和难度后再进入结果页。'
              : '请先返回参数页填写出题要求，生成后再到结果页查看。'
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
          <SurfacePanel title="题目结果" eyebrow="Generated Questions">
            <div class="paper-hero">
              <div class="paper-hero__main">
                <h3>{{ resolvedPaperTitle }}</h3>
                <p>{{ resolvedPaperOverview }}</p>
              </div>
              <div class="mix-card mix-card--hero">
                <span>难度分布</span>
                <strong>{{ resultDifficultySummary }}</strong>
                <small>{{ resultDifficultyRequestLabel }}</small>
              </div>
            </div>

            <div v-if="hasStructuredQuestions" class="paper-list">
              <article v-for="(question, index) in paper.questions || []" :key="question.id || index" class="paper-item">
                <div class="paper-item__head">
                  <span class="paper-item__index">第 {{ index + 1 }} 题</span>
                  <span class="paper-item__difficulty" :class="`paper-item__difficulty--${question.difficulty}`">
                    {{ question.difficulty }}
                  </span>
                  <span class="paper-item__type">{{ question.type }}</span>
                  <span class="paper-item__score">{{ question.score }} 分</span>
                </div>

                <section class="paper-item__section">
                  <span class="paper-item__section-label">题干</span>
                  <RichContent class="paper-item__stem" :content="question.stem" />
                </section>

                <section v-if="question.options?.length" class="paper-item__section">
                  <span class="paper-item__section-label">选项</span>
                  <div class="option-grid">
                    <article v-for="(option, optionIndex) in question.options" :key="optionIndex" class="option-card">
                      <RichContent :content="option" />
                    </article>
                  </div>
                </section>

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
            <div v-else class="raw-response-card">
              <strong>原始返回内容</strong>
              <RichContent :content="rawResponseContent || 'AI 已返回结果，但当前没有可展示的文本内容'" />
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
.field-toolbar small,
.paper-hero p,
.difficulty-mode-card p,
.status-card p,
.mix-card span,
.mix-card small {
  color: var(--ink-soft);
}

.page-head__lead {
  margin: 14px 0 0;
}

.page-head__actions,
.result-toolbar,
.setup-actions,
.field-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.page-btn,
.preset-chip,
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
.preset-list,
.type-chip-list {
  display: grid;
  gap: 16px;
}

.setup-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.field,
.field-grid {
  display: grid;
  gap: 12px;
}

.field-grid,
.field--types,
.field--difficulty,
.field--prompt,
.preset-list--full,
.status-card,
.setup-actions {
  grid-column: 1 / -1;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 14px 16px;
  border-radius: 16px;
}

.field-grid,
.difficulty-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.type-chip-list {
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}

.type-chip,
.preset-chip,
.difficulty-mode-card,
.paper-item__detail-box,
.option-card,
.status-card,
.mix-card {
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

.field-toolbar {
  justify-content: space-between;
  align-items: center;
}

.text-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--copper);
  font-weight: 700;
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
.paper-item__detail-box strong {
  display: block;
}

.difficulty-mode-card p {
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

.preset-list {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.preset-chip {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(249, 250, 251, 0.92);
  text-align: left;
}

.preset-chip:hover,
.page-btn:hover {
  transform: translateY(-1px);
}

.status-card,
.mix-card {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.92);
}

.status-card strong,
.mix-card strong {
  display: block;
}

.status-card p,
.mix-card strong {
  margin-top: 8px;
}

.mix-card small {
  display: block;
  margin-top: 8px;
  line-height: 1.5;
}

.result-empty,
.export-stage {
  display: grid;
}

.export-stage {
  gap: 18px;
  width: 100%;
}

.result-toolbar {
  justify-content: flex-end;
}

.paper-list {
  grid-template-columns: minmax(0, 1fr);
  gap: 22px;
}

.raw-response-card {
  display: grid;
  gap: 14px;
  padding: 20px 22px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(249, 250, 251, 0.92);
}

.raw-response-card strong {
  display: block;
}

.paper-hero {
  display: grid;
  gap: 18px;
  padding-bottom: 14px;
}

.paper-hero__main {
  display: grid;
  gap: 8px;
}

.paper-hero h3 {
  margin: 0;
  font-size: clamp(1.35rem, 2vw, 1.85rem);
  line-height: 1.3;
}

.paper-hero p {
  margin: 0;
  line-height: 1.7;
}

.mix-card--hero {
  justify-self: start;
  min-width: min(100%, 320px);
}

.paper-item {
  display: grid;
  gap: 18px;
  padding: clamp(22px, 2.2vw, 30px);
  border-radius: 24px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 38px rgba(121, 152, 205, 0.12);
}

.paper-item__head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(215, 226, 245, 0.9);
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

.paper-item__section {
  display: grid;
  gap: 12px;
}

.paper-item__section-label {
  font-size: var(--font-size-meta);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.paper-item__stem {
  margin-top: 0;
  font-size: clamp(1.05rem, 1.2vw, 1.16rem);
  line-height: 1.78;
}

.option-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.option-card {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(249, 250, 251, 0.86);
}

.paper-item__detail-stack {
  margin-top: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.paper-item__detail-box {
  padding: 18px 20px;
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.86);
}

.paper-item__detail-box--analysis {
  background: rgba(243, 244, 246, 0.82);
}

.type-chip,
.difficulty-mode-card,
.preset-chip,
.status-card,
.mix-card,
.raw-response-card,
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

.paper-item__detail-box--analysis {
  background: linear-gradient(156deg, var(--accent-08), var(--surface-96) 64%);
}

.type-chip:hover,
.difficulty-mode-card:hover,
.preset-chip:hover,
.paper-item:hover {
  transform: translateY(-2px);
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
}

.paper-item__detail-box :deep(.rich-content),
.paper-item__section :deep(.rich-content),
.option-card :deep(.rich-content) {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .page-head {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .field-grid,
  .difficulty-mode-grid {
    grid-template-columns: 1fr;
  }

  .field-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .setup-form,
  .paper-list,
  .paper-item__detail-stack {
    grid-template-columns: 1fr;
  }
}
</style>

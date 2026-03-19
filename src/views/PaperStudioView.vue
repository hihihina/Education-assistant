<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import EmptyState from "../components/EmptyState.vue";
import RichContent from "../components/RichContent.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { parseJsonContent, requestPaperSet } from "../utils/deepseek";
import { extractWordText } from "../utils/word";
import { exportElementToPdf, exportElementToWord } from "../utils/export";
import { normalizePaperStudioResult } from "../utils/generativeResults";

const route = useRoute();
const router = useRouter();
const store = useEduScopeStore();

const DEFAULT_SECTION_CONFIGS = [
  { type: "选择题", count: 6 },
  { type: "填空题", count: 4 },
  { type: "判断题", count: 0 },
  { type: "简答题", count: 2 },
  { type: "计算题", count: 2 },
  { type: "应用题", count: 2 },
  { type: "实验探究题", count: 0 },
  { type: "综合大题", count: 1 },
];

const grade = ref("初一");
const subject = ref("数学");
const knowledgeInput = ref("");
const prompt = ref("");
const referenceInputRef = ref(null);
const referenceLoading = ref(false);
const referencePapers = ref([]);
const sectionConfigs = ref(cloneDefaultSectionConfigs());
const resultExportRef = ref(null);

const gradeOptions = ["小学三年级", "小学四年级", "小学五年级", "小学六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
const subjectOptions = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "政治", "地理"];
const promptPresets = [
  "难度层次要清晰，适合作为单元测试卷",
  "适当加入综合应用题，覆盖课堂核心知识点",
  "试卷风格偏学校月考，题干表达规范一些",
  "基础题占多数，最后保留 1 到 2 道提升题",
];

const paper = computed(() => store.ai.paperStudio.lastPaper);
const isBusy = computed(() => store.ai.paperStudio.requestInFlight);
const isResultRoute = computed(() => route.name === "paper-studio-result");
const hasRenderablePaper = computed(() => Boolean(paper.value));
const hasStructuredQuestions = computed(() => Array.isArray(paper.value?.questions) && paper.value.questions.length > 0);
const rawResponseContent = computed(() => String(paper.value?.raw_response || "").trim());
const requestMeta = computed(() => paper.value?.request_meta || null);
const resolvedPaperTitle = computed(() => {
  const title = String(paper.value?.title || "").trim();
  if (title) return title;
  const requestGrade = requestMeta.value?.grade || grade.value;
  const requestSubject = requestMeta.value?.subject || subject.value;
  return `${requestGrade}-${requestSubject}-智能出卷结果`;
});
const resolvedPaperOverview = computed(() => {
  const overview = String(paper.value?.overview || "").trim();
  if (overview) return overview;
  const knowledgeText = (paper.value?.knowledge_points || requestMeta.value?.knowledgePoints || []).join("、") || "核心知识点";
  return `本卷围绕${knowledgeText}生成，已自动整理为可直接导出的试卷结构。`;
});
const selectedSections = computed(() =>
  sectionConfigs.value
    .map((item) => ({ ...item, count: Number(item.count || 0) }))
    .filter((item) => Number.isInteger(item.count) && item.count > 0)
);
const totalQuestionCount = computed(() => selectedSections.value.reduce((total, item) => total + item.count, 0));
const knowledgePoints = computed(() =>
  knowledgeInput.value
    .split(/\n|,|，|、/)
    .map((item) => item.trim())
    .filter(Boolean)
);
const referenceSummary = computed(() =>
  referencePapers.value.length
    ? `已导入 ${referencePapers.value.length} 份参考试卷，生成时会参考其结构与风格`
    : "未导入参考试卷，将仅根据知识点和题型要求生成"
);

function normalizeSectionCounts() {
  sectionConfigs.value = sectionConfigs.value.map((item) => {
    const numericValue = Number(item.count);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return { ...item, count: 0 };
    }

    return { ...item, count: Math.trunc(numericValue) };
  });
}

async function generatePaper() {
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key");
    router.push("/ai?redirect=/paper-studio");
    return;
  }

  normalizeSectionCounts();

  if (!knowledgePoints.value.length) {
    store.showToast("请至少填写 1 个需要覆盖的知识点");
    return;
  }

  if (!selectedSections.value.length) {
    store.showToast("请至少为 1 种题型设置题量");
    return;
  }

  store.ai.paperStudio.requestInFlight = true;
  store.ai.paperStudio.status = "出卷中";

  try {
    const response = await requestPaperSet({
      apiKey: store.ai.apiKey,
      grade: grade.value,
      subject: subject.value,
      knowledgePoints: knowledgePoints.value,
      sectionConfigs: selectedSections.value,
      prompt: prompt.value,
      referencePapers: referencePapers.value,
    });
    const content = response.choices?.[0]?.message?.content || "";
    const parsed = parseJsonContent(content);
    const normalizedPaper = normalizePaperStudioResult(parsed ?? content, {
      grade: grade.value,
      subject: subject.value,
      knowledgePoints: knowledgePoints.value,
      sectionConfigs: selectedSections.value,
      prompt: prompt.value,
      referencePapers: referencePapers.value,
      count: totalQuestionCount.value,
    });

    store.ai.usage = response.usage || null;
    store.ai.paperStudio.lastPaper = normalizedPaper;
    store.ai.paperStudio.status = "生成完成";
    store.showToast("智能出卷已生成");
    /*
    store.showToast(
      normalizedPaper.warnings?.length ? `智能出卷已生成，已自动修复 ${normalizedPaper.warnings.length} 处结果字段` : "智能出卷已生成"
    );
    */
    router.push("/paper-studio/result");
  } catch (error) {
    store.ai.paperStudio.status = "生成失败";
    store.showToast(`智能出卷失败：${error.message || "请检查网络或 API Key"}`);
  } finally {
    store.ai.paperStudio.requestInFlight = false;
  }
}

async function copyPaper() {
  if (!paper.value) {
    store.showToast("当前没有可复制的试卷结果");
    return;
  }

  const questionLines = hasStructuredQuestions.value ? [] : [rawResponseContent.value];

  const lines = [
    resolvedPaperTitle.value,
    resolvedPaperOverview.value,
    paper.value.reference_summary ? `参考说明：${paper.value.reference_summary}` : "",
    `知识点：${(paper.value.knowledge_points || []).join("、")}`,
    "",
    ...(paper.value.sections || []).map((item) => `${item.type}：${item.count} 题，${item.total_score} 分`),
    "",
    ...questionLines,
    ...(paper.value.questions || []).flatMap((question, index) => [
      `${index + 1}. [${question.section_type || question.type}] ${question.stem}`,
      question.options?.length ? question.options.map((option) => `- ${option}`).join("\n") : "",
      `答案：${question.answer}`,
      `解析：${question.analysis}`,
      "",
    ]),
  ].filter(Boolean);

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    store.showToast("试卷内容已复制");
  } catch (error) {
    store.showToast("当前环境不支持自动复制，请手动复制试卷内容");
  }
}

async function exportPdf() {
  if (!paper.value || !resultExportRef.value) {
    store.showToast("当前没有可导出的试卷结果");
    return;
  }

  store.showToast("正在导出 PDF");
  await exportElementToPdf(resultExportRef.value, getExportTitle());
}

async function exportWord() {
  if (!paper.value || !resultExportRef.value) {
    store.showToast("当前没有可导出的试卷结果");
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
  knowledgeInput.value = "";
  prompt.value = "";
  referencePapers.value = [];
  sectionConfigs.value = cloneDefaultSectionConfigs();
  store.resetPaperStudio();
  store.showToast("智能出卷参数已清空");
}

function clearResult() {
  store.resetPaperStudio();
  store.showToast("试卷结果已清空");
}

function appendPrompt(text) {
  prompt.value = prompt.value ? `${prompt.value}\n${text}` : text;
}

function triggerReferenceSelect() {
  referenceInputRef.value?.click();
}

async function handleReferenceChange(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  referenceLoading.value = true;
  try {
    const parsedFiles = [];
    for (const file of files) {
      const parsed = await extractWordText(file);
      parsedFiles.push(parsed);
    }
    referencePapers.value = [...referencePapers.value, ...parsedFiles].slice(0, 6);
    store.showToast(`已导入 ${parsedFiles.length} 份参考试卷`);
  } catch (error) {
    store.showToast(error.message || "参考试卷导入失败");
  } finally {
    referenceLoading.value = false;
    event.target.value = "";
  }
}

function removeReference(fileName) {
  referencePapers.value = referencePapers.value.filter((item) => item.fileName !== fileName);
}

function clearReferences() {
  referencePapers.value = [];
}

function goToAiWorkspace() {
  router.push("/ai");
}

function goToSetup() {
  router.push("/paper-studio");
}

function cloneDefaultSectionConfigs() {
  return DEFAULT_SECTION_CONFIGS.map((item) => ({ ...item }));
}
</script>

<template>
  <section class="studio-page">
    <header class="page-head">
      <div>
        <p class="page-head__eyebrow">{{ isResultRoute ? "智能出卷结果" : "智能出卷" }}</p>
        <h2 v-if="!isResultRoute">先填写出卷要求，生成后再跳转到独立结果页面查看完整试卷</h2>
        <h2 v-else>本次智能出卷结果已生成，可返回修改要求或直接导出文档</h2>
        <p class="page-head__lead">
          {{
            isResultRoute
              ? "结果页面展示整份试卷、题型分布、答案与详细解析，并支持 PDF 和 Word 导出"
              : "设置页负责填写知识点、题型数量、参考试卷和补充要求，输出结果不再和参数页混排"
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
        <SurfacePanel title="出卷参数" eyebrow="Paper Setup">
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

            <label class="field field--knowledge">
              <span>知识点范围</span>
              <textarea
                v-model="knowledgeInput"
                rows="6"
                placeholder="每行一个知识点，也支持用逗号分隔，例如：二次函数图像，一元二次方程，函数最值。"
              ></textarea>
              <small>至少填写 1 个知识点，系统会围绕这些知识点组织整份试卷</small>
            </label>

            <div class="field field--sections">
              <span>题型与数量</span>
              <div class="section-grid">
                <label v-for="item in sectionConfigs" :key="item.type" class="section-card">
                  <strong>{{ item.type }}</strong>
                  <input v-model.number="item.count" type="number" min="0" step="1" @blur="normalizeSectionCounts" />
                  <small>{{ item.count || 0 }} 题</small>
                </label>
              </div>
              <div class="status-card">
                <strong>{{ store.ai.paperStudio.status }}</strong>
                <p>当前总题量 {{ totalQuestionCount }} 题</p>
              </div>
            </div>

            <div class="field field--reference">
              <span>参考试卷</span>
              <input ref="referenceInputRef" accept=".docx" hidden multiple type="file" @change="handleReferenceChange" />
              <div class="reference-toolbar">
                <button class="page-btn page-btn--ghost" type="button" :disabled="referenceLoading" @click="triggerReferenceSelect">
                  {{ referenceLoading ? "导入中..." : "导入 Word 试卷" }}
                </button>
                <button class="text-btn" type="button" @click="clearReferences">清空参考试卷</button>
              </div>
              <small>{{ referenceSummary }}</small>
              <div v-if="referencePapers.length" class="reference-list">
                <article v-for="item in referencePapers" :key="item.fileName" class="reference-card">
                  <div>
                    <strong>{{ item.fileName }}</strong>
                    <p>{{ item.rawLength }} 字{{ item.truncated ? " · 已截断" : "" }}</p>
                  </div>
                  <button class="text-btn" type="button" @click="removeReference(item.fileName)">移除</button>
                </article>
              </div>
            </div>

            <label class="field field--prompt">
              <span>补充要求</span>
              <textarea
                v-model="prompt"
                rows="7"
                placeholder="例如：风格偏学校月考；基础题和提升题比例约 7:3；最后一题做综合压轴。"
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

            <div class="setup-actions">
              <button class="page-btn page-btn--primary" type="button" :disabled="isBusy" @click="generatePaper">
                {{ isBusy ? "出卷中..." : "生成试卷并查看结果" }}
              </button>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </template>

    <template v-else>
      <div v-if="!hasRenderablePaper" class="result-empty">
        <EmptyState
          :title="paper ? '本次试卷结果不完整' : '还没有生成试卷结果'"
          :description="
            paper
              ? 'AI 已返回内容，但试卷题目列表或关键字段不完整。请返回重新生成，系统会优先自动修复后再展示。'
              : '请先返回参数页填写出卷要求，生成后再到结果页查看。'
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
          <SurfacePanel title="试卷结果" eyebrow="Generated Paper">
            <div class="paper-hero">
              <div>
                <h3>{{ resolvedPaperTitle }}</h3>
                <p>{{ resolvedPaperOverview }}</p>
              </div>
              <div class="mix-card">
                <span>参考说明</span>
                <strong>{{ paper.reference_summary || "未使用参考试卷" }}</strong>
              </div>
            </div>

            <div class="tag-list">
              <span v-for="item in paper.knowledge_points || []" :key="item" class="tag-chip">{{ item }}</span>
            </div>

            <div class="section-summary-grid">
              <article v-for="item in paper.sections || []" :key="item.type" class="section-summary-card">
                <span>{{ item.type }}</span>
                <strong>{{ item.count }} 题</strong>
                <small>{{ item.total_score }} 分</small>
              </article>
            </div>

            <div v-if="hasStructuredQuestions" class="paper-list">
              <article v-for="(question, index) in paper.questions || []" :key="question.id || index" class="paper-item">
                <div class="paper-item__head">
                  <span class="paper-item__index">第 {{ index + 1 }} 题</span>
                  <span class="paper-item__difficulty" :class="`paper-item__difficulty--${question.difficulty}`">
                    {{ question.difficulty }}
                  </span>
                  <span class="paper-item__type">{{ question.section_type || question.type }}</span>
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
.paper-hero p,
.section-summary-card span,
.section-summary-card small,
.mix-card span,
.reference-card p {
  color: var(--ink-soft);
}

.page-head__lead {
  margin: 14px 0 0;
}

.page-head__actions,
.result-toolbar,
.setup-actions,
.reference-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.page-btn,
.preset-chip {
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

.text-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--copper);
  font-weight: 700;
}

.setup-shell {
  width: 100%;
}

.setup-form,
.paper-list,
.paper-item__detail-stack,
.preset-list,
.reference-list,
.tag-list,
.section-summary-grid {
  display: grid;
  gap: 16px;
}

.field,
.field-grid {
  display: grid;
  gap: 12px;
}

.setup-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.field-grid,
.field--knowledge,
.field--sections,
.preset-list--full,
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

.field-grid {
  grid-template-columns: 1fr 1fr;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.section-card,
.paper-item__detail-box,
.option-card,
.reference-card,
.section-summary-card,
.mix-card,
.status-card,
.preset-chip {
  border: 1px solid var(--line);
}

.section-card {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.92);
}

.section-card strong,
.paper-item__detail-box strong,
.reference-card strong,
.section-summary-card strong,
.status-card strong,
.mix-card strong {
  display: block;
}

.reference-card,
.section-summary-card,
.status-card,
.mix-card {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.92);
}

.reference-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.reference-card p,
.status-card p {
  margin: 8px 0 0;
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

.page-btn:hover,
.preset-chip:hover {
  transform: translateY(-1px);
}

.result-empty,
.export-stage {
  display: grid;
}

.export-stage {
  width: 100%;
}

.result-toolbar {
  justify-content: flex-end;
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

.mix-card strong {
  margin-top: 8px;
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

.section-summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.paper-list {
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
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

.section-card,
.preset-chip,
.mix-card,
.reference-card,
.section-summary-card,
.status-card,
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

.paper-item__detail-box--analysis {
  background: linear-gradient(156deg, var(--accent-08), var(--surface-96) 64%);
}

.section-card:hover,
.preset-chip:hover,
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
  .field-grid,
  .section-grid {
    grid-template-columns: 1fr;
  }

  .reference-card {
    grid-template-columns: 1fr;
  }

  .setup-form,
  .paper-list,
  .paper-item__detail-stack {
    grid-template-columns: 1fr;
  }
}
</style>

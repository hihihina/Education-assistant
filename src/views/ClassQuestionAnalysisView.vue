<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import * as echarts from "echarts";
import SurfacePanel from "../components/SurfacePanel.vue";
import MetricCard from "../components/MetricCard.vue";
import AnalysisFilePicker from "../components/AnalysisFilePicker.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { requestAnalysisInsight } from "../utils/deepseek";
import { exportElementToPdf } from "../utils/export";
import { renderMarkdown } from "../utils/markdown";
import { formatPercent, formatScore } from "../utils/questionAnalysis";

const router = useRouter();
const store = useEduScopeStore();

const pageRef = ref(null);
const questionChartRef = ref(null);
const knowledgeChartRef = ref(null);
const blueprintFile = ref(null);
const detailFile = ref(null);
const uploading = ref(false);
const aiInsight = ref("");
const aiLoading = ref(false);

let questionChart = null;
let knowledgeChart = null;

const dataset = computed(() => store.getDataset("classQuestion"));
const weakQuestions = computed(() => dataset.value?.questions.slice(0, 10) || []);
const weakKnowledge = computed(() => dataset.value?.knowledgePoints.slice(0, 8) || []);
const renderedAiInsight = computed(() => renderMarkdown(aiInsight.value));

watch(
  dataset,
  async () => {
    await nextTick();
    renderQuestionChart();
    renderKnowledgeChart();
    aiInsight.value = "";
  },
  { deep: true }
);

onMounted(() => {
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  questionChart?.dispose();
  knowledgeChart?.dispose();
});

async function startAnalysis() {
  if (!blueprintFile.value || !detailFile.value) {
    store.showToast("请先上传双向细目表和班级小题细分数据。");
    return;
  }

  uploading.value = true;
  const result = await store.importClassQuestion(blueprintFile.value, detailFile.value);
  uploading.value = false;

  if (!result.success) {
    store.showToast("班级小题分析数据匹配失败，已切换到失败页。");
    router.push("/analysis/failure");
    return;
  }

  store.showToast(`班级小题分析已完成，共识别 ${result.dataset.students.length} 名学生、${result.dataset.questions.length} 道小题。`);
}

function resetAnalysis() {
  blueprintFile.value = null;
  detailFile.value = null;
  store.clearDataset("classQuestion");
}

function goBack() {
  router.push("/analysis");
}

async function exportPdf() {
  if (!pageRef.value || !dataset.value) return;
  store.showToast("正在导出班级小题分析 PDF...");
  await exportElementToPdf(pageRef.value, `${dataset.value.meta.className}-${dataset.value.meta.subjectName}-班级小题分析`);
}

function handleBlueprint(files) {
  blueprintFile.value = files[0] || null;
}

function handleDetail(files) {
  detailFile.value = files[0] || null;
}

function resizeCharts() {
  questionChart?.resize();
  knowledgeChart?.resize();
}

function renderQuestionChart() {
  if (!questionChartRef.value || !weakQuestions.value.length) return;
  if (!questionChart) questionChart = echarts.init(questionChartRef.value);
  questionChart.setOption({
    grid: { top: 16, right: 24, bottom: 28, left: 92 },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", data: [...weakQuestions.value].reverse().map((item) => item.label) },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter(params) {
        const item = [...weakQuestions.value].reverse()[params[0].dataIndex];
        return `${item.label}<br/>班级均分率：${formatPercent(item.averageRate)}<br/>低分占比：${formatPercent(item.lowRate)}<br/>知识点：${item.knowledgeLabel}`;
      },
    },
    series: [
      {
        type: "bar",
        barWidth: 18,
        data: [...weakQuestions.value].reverse().map((item) => ({
          value: item.averageRate,
          itemStyle: { color: item.averageRate < 60 ? "#e35d67" : item.averageRate < 75 ? "#94a3b8" : "#0a2463", borderRadius: [0, 10, 10, 0] },
        })),
      },
    ],
  });
}

function renderKnowledgeChart() {
  if (!knowledgeChartRef.value || !weakKnowledge.value.length) return;
  if (!knowledgeChart) knowledgeChart = echarts.init(knowledgeChartRef.value);
  knowledgeChart.setOption({
    grid: { top: 16, right: 24, bottom: 28, left: 92 },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", data: [...weakKnowledge.value].reverse().map((item) => item.name) },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter(params) {
        const item = [...weakKnowledge.value].reverse()[params[0].dataIndex];
        return `${item.name}<br/>掌握率：${formatPercent(item.averageRate)}<br/>薄弱小题：${item.weakQuestionLabel || "--"}`;
      },
    },
    series: [{ type: "bar", barWidth: 18, data: [...weakKnowledge.value].reverse().map((item) => item.averageRate), itemStyle: { color: "#0a2463", borderRadius: [0, 10, 10, 0] } }],
  });
}

async function generateAiInsight() {
  if (!dataset.value) return;
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key。");
    router.push("/ai?redirect=/analysis/class-question");
    return;
  }

  aiLoading.value = true;
  try {
    const response = await requestAnalysisInsight({
      apiKey: store.ai.apiKey,
      analysisType: `${dataset.value.meta.className} ${dataset.value.meta.subjectName}班级考试分析`,
      summary: buildClassInsightSummary(dataset.value),
    });
    aiInsight.value = response.choices?.[0]?.message?.content || "未获取到 AI 分析结果。";
    store.ai.usage = response.usage || null;
    store.showToast("AI 班级分析已生成。");
  } catch (error) {
    store.showToast(`AI 班级分析失败：${error.message || "请检查网络或 API Key。"}`);
  } finally {
    aiLoading.value = false;
  }
}

function buildClassInsightSummary(currentDataset) {
  const weakestQuestions = currentDataset.questions
    .slice(0, 5)
    .map(
      (item) =>
        `${item.label}（均分率 ${formatPercent(item.averageRate)}，低分占比 ${formatPercent(item.lowRate)}，知识点 ${item.knowledgeLabel}）`
    )
    .join("；");
  const weakestKnowledge = currentDataset.knowledgePoints
    .slice(0, 5)
    .map((item) => `${item.name}（掌握率 ${formatPercent(item.averageRate)}，关联小题 ${item.questionCount}）`)
    .join("；");
  const riskStudents = [...currentDataset.students]
    .sort((left, right) => left.totalRate - right.totalRate)
    .slice(0, 5)
    .map(
      (item) =>
        `${item.displayName}（总得分率 ${formatPercent(item.totalRate)}，薄弱小题 ${item.weakQuestionCount}，零分小题 ${item.zeroQuestionCount}）`
    )
    .join("；");

  return [
    `班级：${currentDataset.meta.className}`,
    `科目：${currentDataset.meta.subjectName}`,
    `参考人数：${currentDataset.metrics.participantCount}`,
    `整体得分率：${formatPercent(currentDataset.metrics.averageRate)}`,
    `薄弱小题数量：${currentDataset.metrics.weakQuestionCount}`,
    `薄弱知识点数量：${currentDataset.metrics.weakKnowledgeCount}`,
    `当前最薄弱小题：${weakestQuestions || "暂无"}`,
    `当前最薄弱知识点：${weakestKnowledge || "暂无"}`,
    `重点关注学生：${riskStudents || "暂无"}`,
  ].join("\n");
}
</script>

<template>
  <section ref="pageRef" class="analysis-page">
    <template v-if="!dataset">
      <header class="analysis-hero">
        <div class="analysis-hero__copy">
          <p class="analysis-hero__eyebrow">Class Question Analysis</p>
          <h2>上传双向细目表与班级小题细分数据，定位班级薄弱题目与知识点</h2>
          <p>科目名称会优先根据 Excel 文件名自动识别。分析结果将覆盖小题掌握率、知识点掌握率、班级 AI 智能解读与薄弱项清单。</p>
        </div>
        <button class="page-btn page-btn--ghost" type="button" @click="goBack">返回成绩分析目录</button>
      </header>

      <div class="upload-layout">
        <div class="upload-stack">
          <AnalysisFilePicker title="上传双向细目表" eyebrow="Blueprint" description="请先上传已补全的小题题号、知识点、分值等信息。" hint="建议在细目表中包含：题号、小题知识点、分值、能力维度。" :file-names="blueprintFile ? [blueprintFile.name] : []" @select="handleBlueprint" />
          <AnalysisFilePicker title="上传班级小题细分数据" eyebrow="Class Detail" description="上传单个班级的小题得分明细表，系统会自动按题号匹配。" hint="建议文件名中包含学科与班级信息，例如：高一3班-数学.xlsx。" :file-names="detailFile ? [detailFile.name] : []" @select="handleDetail" />
        </div>

        <SurfacePanel title="使用要求" eyebrow="Requirements">
          <div class="requirements">
            <article><span>上传文件</span><strong>共 2 份：双向细目表 + 班级小题细分数据</strong></article>
            <article><span>题号匹配</span><strong>班级数据中的题号命名需与细目表一致或高度接近</strong></article>
            <article><span>输出内容</span><strong>返回薄弱小题、薄弱知识点、AI 智能分析、学生排名表格与统计图</strong></article>
            <article><span>科目识别</span><strong>优先根据 Excel 文件名自动提取学科名称</strong></article>
          </div>
          <div class="upload-actions">
            <button class="page-btn page-btn--ghost" type="button" @click="resetAnalysis">清空选择</button>
            <button class="page-btn page-btn--primary" type="button" :disabled="uploading" @click="startAnalysis">
              {{ uploading ? "分析中..." : "开始分析" }}
            </button>
          </div>
        </SurfacePanel>
      </div>
    </template>

    <template v-else>
      <div class="topbar">
        <button class="page-btn page-btn--ghost" type="button" @click="goBack">返回成绩分析目录</button>
        <div class="topbar__actions">
          <button class="page-btn page-btn--ghost" type="button" @click="resetAnalysis">重新上传文件</button>
          <button class="page-btn page-btn--primary" type="button" @click="exportPdf">导出 PDF</button>
        </div>
      </div>

      <header class="analysis-hero">
        <div class="analysis-hero__copy">
          <p class="analysis-hero__eyebrow">{{ dataset.meta.subjectName }}</p>
          <h2>{{ dataset.meta.className }} 班级小题分析</h2>
          <p>已匹配 {{ dataset.meta.matchedQuestionCount }} / {{ dataset.meta.blueprintQuestionCount }} 道小题，覆盖率 {{ formatPercent(dataset.meta.coverageRate) }}，以下结果基于当前上传文件生成。</p>
        </div>
      </header>

      <div class="metric-grid">
        <MetricCard label="参考人数" :value="dataset.metrics.participantCount" hint="当前有效学生记录" />
        <MetricCard label="整体得分率" :value="formatPercent(dataset.metrics.averageRate)" :progress="dataset.metrics.averageRate" />
        <MetricCard label="薄弱小题" :value="dataset.metrics.weakQuestionCount" hint="班级均分率 < 60%" />
        <MetricCard label="薄弱知识点" :value="dataset.metrics.weakKnowledgeCount" hint="知识点掌握率 < 60%" />
        <MetricCard label="科目" :value="dataset.meta.subjectName" hint="来自文件名识别" />
        <MetricCard label="总分值" :value="formatScore(dataset.metrics.totalFullScore)" hint="已匹配小题分值之和" />
      </div>

      <div class="chart-grid">
        <SurfacePanel title="薄弱小题排行" eyebrow="Weak Questions"><div ref="questionChartRef" class="chart-host"></div></SurfacePanel>
        <SurfacePanel title="薄弱知识点排行" eyebrow="Knowledge"><div ref="knowledgeChartRef" class="chart-host"></div></SurfacePanel>
        <SurfacePanel title="AI 智能分析" eyebrow="AI Insight">
          <template #header>
            <button class="page-btn page-btn--ghost" type="button" :disabled="aiLoading" @click="generateAiInsight">
              {{ aiLoading ? "分析中..." : aiInsight ? "重新生成" : "生成分析" }}
            </button>
          </template>

          <div v-if="!aiInsight" class="ai-insight-empty">
            <strong>生成班级考试智能分析</strong>
            <p>这里会结合班级整体得分率、薄弱小题、薄弱知识点和学生风险情况，输出面向教师的诊断建议。</p>
          </div>
          <div v-else class="ai-insight-content markdown-body" v-html="renderedAiInsight"></div>
        </SurfacePanel>
      </div>

      <div class="table-grid">
        <SurfacePanel title="小题诊断明细" eyebrow="Question Table">
          <div class="table-wrap"><table><thead><tr><th>题号</th><th>知识点</th><th>均分率</th><th>低分占比</th><th>零分占比</th><th>区分度</th><th>状态</th></tr></thead><tbody><tr v-for="item in dataset.questions" :key="item.id"><td>{{ item.label }}</td><td>{{ item.knowledgeLabel }}</td><td>{{ formatPercent(item.averageRate) }}</td><td>{{ formatPercent(item.lowRate) }}</td><td>{{ formatPercent(item.zeroRate) }}</td><td>{{ formatPercent(item.discrimination) }}</td><td><span class="pill" :class="`pill--${item.masteryClass}`">{{ item.masteryLabel }}</span></td></tr></tbody></table></div>
        </SurfacePanel>

        <SurfacePanel title="知识点诊断明细" eyebrow="Knowledge Table">
          <div class="table-wrap"><table><thead><tr><th>知识点</th><th>掌握率</th><th>关联小题数</th><th>薄弱小题数</th><th>重点关注小题</th><th>状态</th></tr></thead><tbody><tr v-for="item in dataset.knowledgePoints" :key="item.name"><td>{{ item.name }}</td><td>{{ formatPercent(item.averageRate) }}</td><td>{{ item.questionCount }}</td><td>{{ item.lowQuestionCount }}</td><td>{{ item.weakQuestionLabel || "--" }}</td><td><span class="pill" :class="`pill--${item.masteryClass}`">{{ item.masteryLabel }}</span></td></tr></tbody></table></div>
        </SurfacePanel>
      </div>

      <SurfacePanel title="学生排名与风险分布" eyebrow="Student Table">
        <div class="table-wrap"><table><thead><tr><th>排名</th><th>学生</th><th>总分</th><th>总得分率</th><th>薄弱小题数</th><th>零分小题数</th><th>缺失小题数</th></tr></thead><tbody><tr v-for="item in dataset.students" :key="item.id"><td>{{ item.rank }}</td><td>{{ item.displayName }}{{ item.code ? ` / ${item.code}` : "" }}</td><td>{{ formatScore(item.totalScore) }}</td><td>{{ formatPercent(item.totalRate) }}</td><td>{{ item.weakQuestionCount }}</td><td>{{ item.zeroQuestionCount }}</td><td>{{ item.missingQuestionCount }}</td></tr></tbody></table></div>
      </SurfacePanel>
    </template>
  </section>
</template>

<style scoped>
.analysis-page,
.upload-stack,
.requirements,
.chart-grid,
.metric-grid,
.table-grid {
  display: grid;
  gap: 18px;
}

.analysis-page {
  padding-bottom: 24px;
  align-content: start;
}

.analysis-hero,
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
}

.analysis-hero {
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94));
  box-shadow: var(--shadow-lg);
}

.analysis-hero__copy {
  min-width: 0;
}

.analysis-hero__eyebrow {
  margin: 0;
  color: var(--copper);
  font-size: var(--font-size-meta);
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.analysis-hero h2 {
  margin: 12px 0 0;
  font-size: clamp(2rem, 3vw, 3.2rem);
  line-height: 1.08;
}

.analysis-hero p,
.requirements span,
.ai-insight-empty p {
  margin: 12px 0 0;
  color: var(--ink-soft);
  line-height: 1.7;
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

.upload-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
  gap: 20px;
  align-items: start;
}

.requirements article {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(249, 250, 251, 0.92);
}

.upload-actions,
.topbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.upload-actions {
  margin-top: 12px;
  padding-top: 6px;
}

.metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.chart-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.chart-host {
  height: 320px;
}

.ai-insight-empty,
.ai-insight-content {
  min-height: 320px;
}

.ai-insight-empty {
  display: grid;
  align-content: center;
}

.ai-insight-empty strong {
  font-size: 1.05rem;
}

.ai-insight-content {
  line-height: 1.75;
}

.ai-insight-content :deep(*:first-child) {
  margin-top: 0;
}

.ai-insight-content :deep(*:last-child) {
  margin-bottom: 0;
}

.ai-insight-content :deep(ul),
.ai-insight-content :deep(ol) {
  padding-left: 20px;
}

.table-grid {
  grid-template-columns: 1.08fr 0.92fr;
}

.table-wrap {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--table-line);
  text-align: left;
  vertical-align: top;
}

th {
  position: sticky;
  top: 0;
  background: var(--surface-96);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: var(--font-size-caption);
  font-weight: 700;
}

.pill--good {
  color: var(--success);
  background: rgba(45, 138, 104, 0.14);
}

.pill--mid {
  color: var(--ink-soft);
  background: rgba(10, 36, 99, 0.08);
}

.pill--bad {
  color: var(--danger);
  background: rgba(190, 78, 63, 0.12);
}

.analysis-hero,
.requirements article,
.table-wrap {
  border-color: var(--card-border);
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
}

.analysis-hero {
  background:
    radial-gradient(circle at 100% 0%, var(--accent-12), transparent 40%),
    linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
}

.requirements article {
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

.requirements article:hover {
  transform: translateY(-2px);
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
}

@media (max-width: 1320px) {
  .upload-layout,
  .chart-grid,
  .table-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .analysis-hero,
  .topbar,
  .topbar__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

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
import { formatPercent, formatSigned } from "../utils/questionAnalysis";

const router = useRouter();
const store = useEduScopeStore();

const pageRef = ref(null);
const rankingChartRef = ref(null);
const heatmapChartRef = ref(null);
const blueprintFile = ref(null);
const detailFiles = ref([]);
const uploading = ref(false);
const aiInsight = ref("");
const aiLoading = ref(false);

let rankingChart = null;
let heatmapChart = null;

const dataset = computed(() => store.getDataset("gradeOverview"));
const heatmapKnowledge = computed(() => dataset.value?.knowledgePoints.slice(0, 10) || []);
const renderedAiInsight = computed(() => renderMarkdown(aiInsight.value));
const heatmapDataset = computed(() => {
  if (!dataset.value) {
    return { classNames: [], knowledgeNames: [], values: [] };
  }

  const classNames = dataset.value.classRankings.map((item) => item.className);
  const knowledgeNames = heatmapKnowledge.value.map((item) => item.name);
  const values = [];

  classNames.forEach((className, classIndex) => {
    const classDataset = dataset.value.classes.find((item) => item.meta.className === className);
    knowledgeNames.forEach((knowledgeName, knowledgeIndex) => {
      const rate = classDataset?.knowledgePoints.find((item) => item.name === knowledgeName)?.averageRate;
      if (Number.isFinite(rate)) {
        values.push([classIndex, knowledgeIndex, Number(rate.toFixed(1))]);
      }
    });
  });

  return {
    classNames,
    knowledgeNames,
    values,
  };
});
const classComparisonRows = computed(() => {
  if (!dataset.value) return [];

  const classMap = new Map(dataset.value.classes.map((item) => [item.meta.className, item]));
  return dataset.value.classRankings.map((item) => {
    const classDataset = classMap.get(item.className);
    const weakestKnowledge = classDataset?.knowledgePoints[0];
    const weakestQuestion = classDataset?.questions[0];

    return {
      className: item.className,
      rank: item.rank,
      participantCount: item.participantCount,
      averageRate: item.averageRate,
      deltaToGradeAverage: item.averageRate - dataset.value.metrics.averageRate,
      weakKnowledgeCount: classDataset?.metrics.weakKnowledgeCount ?? 0,
      weakQuestionCount: classDataset?.metrics.weakQuestionCount ?? 0,
      weakestKnowledgeName: weakestKnowledge?.name || "--",
      weakestQuestionLabel: weakestQuestion?.label || "--",
    };
  });
});

watch(
  dataset,
  async () => {
    await nextTick();
    renderRankingChart();
    renderHeatmapChart();
    aiInsight.value = "";
  },
  { deep: true }
);

onMounted(() => {
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  rankingChart?.dispose();
  heatmapChart?.dispose();
});

async function startAnalysis() {
  if (!blueprintFile.value || !detailFiles.value.length) {
    store.showToast("请先上传双向细目表和多个班级小题细分数据文件。");
    return;
  }

  uploading.value = true;
  const result = await store.importGradeOverview(blueprintFile.value, detailFiles.value);
  uploading.value = false;

  if (!result.success) {
    store.showToast("年级情况分析数据匹配失败，已切换到失败页。");
    router.push("/analysis/failure");
    return;
  }

  store.showToast(`年级情况分析已完成，共识别 ${result.dataset.classRankings.length} 个班级。`);
}

function resetAnalysis() {
  blueprintFile.value = null;
  detailFiles.value = [];
  store.clearDataset("gradeOverview");
}

function goBack() {
  router.push("/analysis");
}

async function exportPdf() {
  if (!pageRef.value || !dataset.value) return;
  store.showToast("正在导出年级情况分析 PDF...");
  await exportElementToPdf(pageRef.value, `${dataset.value.meta.gradeLabel}-${dataset.value.meta.subjectName}-年级情况分析`);
}

function handleBlueprint(files) {
  blueprintFile.value = files[0] || null;
}

function handleDetails(files) {
  detailFiles.value = files;
}

function resizeCharts() {
  rankingChart?.resize();
  heatmapChart?.resize();
}

function renderRankingChart() {
  if (!rankingChartRef.value || !dataset.value?.classRankings.length) return;
  if (!rankingChart) rankingChart = echarts.init(rankingChartRef.value);
  rankingChart.setOption({
    grid: { top: 20, right: 24, bottom: 44, left: 48 },
    xAxis: { type: "category", data: dataset.value.classRankings.map((item) => item.className), axisLabel: { rotate: 24 } },
    yAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
    tooltip: { trigger: "axis", formatter: (params) => `${params[0].axisValue}<br/>班级均分率：${formatPercent(params[0].value)}` },
    series: [{ type: "bar", data: dataset.value.classRankings.map((item) => item.averageRate), itemStyle: { color: "#0a2463", borderRadius: [10, 10, 0, 0] } }],
  });
}

function renderHeatmapChart() {
  if (!heatmapChartRef.value || !heatmapDataset.value.values.length) return;
  if (!heatmapChart) heatmapChart = echarts.init(heatmapChartRef.value);
  heatmapChart.setOption({
    grid: {
      top: 62,
      right: 110,
      bottom: 64,
      left: 184,
    },
    tooltip: {
      formatter: (params) =>
        `${heatmapDataset.value.classNames[params.value[0]]}<br/>${heatmapDataset.value.knowledgeNames[params.value[1]]}<br/>掌握率：${formatPercent(
          params.value[2]
        )}`,
    },
    xAxis: {
      type: "category",
      data: heatmapDataset.value.classNames,
      splitArea: { show: true },
      axisLabel: {
        interval: 0,
        fontSize: 14,
        fontWeight: 600,
        margin: 16,
      },
    },
    yAxis: {
      type: "category",
      data: heatmapDataset.value.knowledgeNames,
      splitArea: { show: true },
      axisLabel: {
        width: 152,
        overflow: "truncate",
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 18,
      },
    },
    visualMap: {
      min: 0,
      max: 100,
      orient: "vertical",
      right: 18,
      top: "middle",
      itemHeight: 180,
      text: ["高", "低"],
      textGap: 10,
      inRange: {
        color: ["#e35d67", "#f7d08a", "#a5b4fc", "#0a2463"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatmapDataset.value.values,
        label: {
          show: true,
          fontSize: 13,
          fontWeight: 700,
          color: "#24456f",
          formatter: ({ value }) => `${value[2]}%`,
        },
        emphasis: {
          itemStyle: {
            borderColor: "rgba(255,255,255,0.9)",
            borderWidth: 1,
          },
        },
      },
    ],
  });
}

async function generateAiInsight() {
  if (!dataset.value) return;
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key。");
    router.push("/ai?redirect=/analysis/grade-overview");
    return;
  }

  aiLoading.value = true;
  try {
    const response = await requestAnalysisInsight({
      apiKey: store.ai.apiKey,
      analysisType: `${dataset.value.meta.gradeLabel} ${dataset.value.meta.subjectName}年级考试分析`,
      summary: buildGradeInsightSummary(dataset.value),
    });
    aiInsight.value = response.choices?.[0]?.message?.content || "未获取到 AI 分析结果。";
    store.ai.usage = response.usage || null;
    store.showToast("AI 年级分析已生成。");
  } catch (error) {
    store.showToast(`AI 年级分析失败：${error.message || "请检查网络或 API Key。"}`);
  } finally {
    aiLoading.value = false;
  }
}

function buildGradeInsightSummary(currentDataset) {
  const classRanking = currentDataset.classRankings
    .slice(0, 6)
    .map((item) => `${item.rank} ${item.className}（均分率 ${formatPercent(item.averageRate)}，薄弱知识点 ${item.weakKnowledgeLabel}）`)
    .join("；");
  const weakestKnowledge = currentDataset.knowledgePoints
    .slice(0, 6)
    .map(
      (item) =>
        `${item.name}（年级掌握率 ${formatPercent(item.averageRate)}，最弱班级 ${item.weakestClassName} ${formatPercent(item.weakestClassRate)}）`
    )
    .join("；");
  const biggestGaps = currentDataset.questionGaps
    .slice(0, 6)
    .map(
      (item) =>
        `${item.label}（班级差值 ${formatPercent(item.gapRate)}，最弱班级 ${item.weakestClassName}，最强班级 ${item.strongestClassName}）`
    )
    .join("；");

  return [
    `年级：${currentDataset.meta.gradeLabel}`,
    `科目：${currentDataset.meta.subjectName}`,
    `纳入班级数：${currentDataset.metrics.classCount}`,
    `总人数：${currentDataset.metrics.totalStudents}`,
    `整体均分率：${formatPercent(currentDataset.metrics.averageRate)}`,
    `领先班级：${currentDataset.metrics.topClassName}`,
    `最弱知识点：${currentDataset.metrics.weakestKnowledgeName}`,
    `班级排名摘要：${classRanking || "暂无"}`,
    `薄弱知识点摘要：${weakestKnowledge || "暂无"}`,
    `差异最大小题摘要：${biggestGaps || "暂无"}`,
  ].join("\n");
}

function formatRateGap(value) {
  const text = formatSigned(value);
  return text === "--" ? text : `${text}%`;
}
</script>

<template>
  <section ref="pageRef" class="analysis-page">
    <template v-if="!dataset">
      <header class="analysis-hero">
        <div class="analysis-hero__copy">
          <p class="analysis-hero__eyebrow">Grade Overview</p>
          <h2>上传双向细目表和多个班级文件，分析全年级的班级排名与薄弱知识点</h2>
          <p>系统会自动按题号对齐多个班级文件，并优先根据 Excel 文件名识别科目名称，最终返回班级排名、知识点热力图、小题差异数据和 AI 智能解读。</p>
        </div>
        <button class="page-btn page-btn--ghost" type="button" @click="goBack">返回成绩分析目录</button>
      </header>

      <div class="upload-layout">
        <div class="upload-stack">
          <AnalysisFilePicker title="上传双向细目表" eyebrow="Blueprint" description="请上传该科目统一使用的双向细目表。" hint="细目表建议包含：题号、知识点、分值、能力维度。" :file-names="blueprintFile ? [blueprintFile.name] : []" @select="handleBlueprint" />
          <AnalysisFilePicker title="上传多个班级小题细分数据" eyebrow="Multi Class Files" description="支持一次性导入多个班级文件，系统将对各班级进行横向比较。" hint="请尽量让文件名中带上班级和科目信息，例如：高一1班-数学.xlsx。" :file-names="detailFiles.map((item) => item.name)" multiple @select="handleDetails" />
        </div>

        <SurfacePanel title="使用要求" eyebrow="Requirements">
          <div class="requirements">
            <article><span>上传文件</span><strong>共 1 份细目表 + 多份班级小题细分数据</strong></article>
            <article><span>分析范围</span><strong>适合做同一年级、同一科目的多班级横向比较</strong></article>
            <article><span>核心输出</span><strong>班级排名、薄弱知识点、知识点热力图、小题差异排行和 AI 智能分析</strong></article>
            <article><span>科目识别</span><strong>优先根据 Excel 文件名自动读取学科名称</strong></article>
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
          <h2>{{ dataset.meta.gradeLabel }} 年级情况分析</h2>
          <p>当前共纳入 {{ dataset.metrics.classCount }} 个班级、{{ dataset.metrics.totalStudents }} 名学生，以下结果聚焦班级排名、知识点掌握差异与小题差异。</p>
        </div>
      </header>

      <div class="metric-grid">
        <MetricCard label="班级数" :value="dataset.metrics.classCount" hint="已成功纳入分析" />
        <MetricCard label="总人数" :value="dataset.metrics.totalStudents" hint="所有班级有效样本总数" />
        <MetricCard label="整体均分率" :value="formatPercent(dataset.metrics.averageRate)" :progress="dataset.metrics.averageRate" />
        <MetricCard label="领先班级" :value="dataset.metrics.topClassName" hint="按整体均分率排序" />
        <MetricCard label="最弱知识点" :value="dataset.metrics.weakestKnowledgeName" hint="按年级整体掌握率排序" />
        <MetricCard label="科目" :value="dataset.metrics.subjectName" hint="来自文件名识别" />
      </div>

      <SurfacePanel title="AI 智能分析" eyebrow="AI Insight">
        <template #header>
          <button class="page-btn page-btn--ghost" type="button" :disabled="aiLoading" @click="generateAiInsight">
            {{ aiLoading ? "分析中..." : aiInsight ? "重新生成" : "生成分析" }}
          </button>
        </template>

        <div v-if="!aiInsight" class="ai-insight-empty">
          <strong>生成年级考试智能分析</strong>
          <p>这里会结合班级排名、知识点热力图和小题差异，输出面向备课与分层教学的年级诊断建议。</p>
        </div>
        <div v-else class="ai-insight-content markdown-body" v-html="renderedAiInsight"></div>
      </SurfacePanel>

      <div class="chart-grid">
        <SurfacePanel title="班级整体排名" eyebrow="Ranking" class="chart-grid__ranking">
          <div ref="rankingChartRef" class="chart-host"></div>
        </SurfacePanel>

        <SurfacePanel title="班级关键指标对比" eyebrow="Class Compare" class="chart-grid__compare">
          <div class="table-wrap table-wrap--compact">
            <table class="compare-table">
              <thead>
                <tr>
                  <th>班级</th>
                  <th>均分率</th>
                  <th>较年级均分</th>
                  <th>薄弱知识点数</th>
                  <th>薄弱小题数</th>
                  <th>首要关注知识点</th>
                  <th>首要关注小题</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in classComparisonRows" :key="item.className">
                  <td>
                    <strong>{{ item.className }}</strong>
                    <small>第 {{ item.rank }} 名 · {{ item.participantCount }} 人</small>
                  </td>
                  <td>{{ formatPercent(item.averageRate) }}</td>
                  <td :class="item.deltaToGradeAverage >= 0 ? 'rate-gap rate-gap--up' : 'rate-gap rate-gap--down'">
                    {{ formatRateGap(item.deltaToGradeAverage) }}
                  </td>
                  <td>{{ item.weakKnowledgeCount }}</td>
                  <td>{{ item.weakQuestionCount }}</td>
                  <td>{{ item.weakestKnowledgeName }}</td>
                  <td>{{ item.weakestQuestionLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SurfacePanel>

        <SurfacePanel title="知识点班级热力图" eyebrow="Heatmap" class="chart-grid__heatmap">
          <div ref="heatmapChartRef" class="chart-host chart-host--heatmap"></div>
          <p class="heatmap-note">展示全年级当前最需要关注的 10 个知识点，不同颜色表示各班掌握率高低。</p>
        </SurfacePanel>
      </div>

      <div class="table-grid">
        <SurfacePanel title="班级排名明细" eyebrow="Class Table">
          <div class="table-wrap"><table><thead><tr><th>排名</th><th>班级</th><th>均分率</th><th>距第一名</th><th>人数</th><th>薄弱知识点</th><th>差异最大薄弱题</th></tr></thead><tbody><tr v-for="item in dataset.classRankings" :key="item.className"><td>{{ item.rank }}</td><td>{{ item.className }}</td><td>{{ formatPercent(item.averageRate) }}</td><td>{{ formatSigned(-item.deltaToTop) }}</td><td>{{ item.participantCount }}</td><td>{{ item.weakKnowledgeLabel }}</td><td>{{ item.weakQuestionLabel }}</td></tr></tbody></table></div>
        </SurfacePanel>

        <SurfacePanel title="知识点横向对比" eyebrow="Knowledge Table">
          <div class="table-wrap"><table><thead><tr><th>知识点</th><th>年级掌握率</th><th>最弱班级</th><th>最弱班级掌握率</th><th>最强班级</th><th>最强班级掌握率</th></tr></thead><tbody><tr v-for="item in dataset.knowledgePoints" :key="item.name"><td>{{ item.name }}</td><td>{{ formatPercent(item.averageRate) }}</td><td>{{ item.weakestClassName }}</td><td>{{ formatPercent(item.weakestClassRate) }}</td><td>{{ item.strongestClassName }}</td><td>{{ formatPercent(item.strongestClassRate) }}</td></tr></tbody></table></div>
        </SurfacePanel>
      </div>

      <SurfacePanel title="小题差异排行" eyebrow="Question Gap Table">
        <div class="table-wrap"><table><thead><tr><th>小题</th><th>知识点</th><th>年级均分率</th><th>班级差值</th><th>最弱班级</th><th>最弱班级均分率</th><th>最强班级</th><th>最强班级均分率</th></tr></thead><tbody><tr v-for="item in dataset.questionGaps" :key="item.id"><td>{{ item.label }}</td><td>{{ item.knowledgeLabel }}</td><td>{{ formatPercent(item.averageRate) }}</td><td>{{ formatPercent(item.gapRate) }}</td><td>{{ item.weakestClassName }}</td><td>{{ formatPercent(item.weakestClassRate) }}</td><td>{{ item.strongestClassName }}</td><td>{{ formatPercent(item.strongestClassRate) }}</td></tr></tbody></table></div>
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
  min-width: 0;
}

.analysis-hero,
.topbar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  align-items: start;
}

.analysis-hero {
  padding: clamp(24px, 2.4vw, 32px);
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
  text-wrap: wrap;
}

.page-btn {
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
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
  grid-template-columns: minmax(0, 1.14fr) minmax(320px, 0.86fr);
  gap: clamp(18px, 2vw, 24px);
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
  justify-content: flex-end;
  margin-top: clamp(18px, 2vw, 28px);
  padding-top: 10px;
}

.metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

.chart-grid {
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: clamp(18px, 2vw, 22px);
  align-items: start;
}

.chart-grid > *,
.table-grid > *,
.upload-layout > * {
  min-width: 0;
}

.chart-host {
  height: clamp(300px, 28vw, 360px);
}

.chart-host--heatmap {
  height: clamp(560px, 48vw, 760px);
}

.chart-grid__ranking {
  grid-column: span 4;
}

.chart-grid__compare {
  grid-column: span 8;
}

.chart-grid__heatmap {
  grid-column: 1 / -1;
}

.table-wrap--compact {
  max-height: clamp(360px, 48vw, 520px);
}

.compare-table {
  min-width: 760px;
}

.compare-table td strong {
  display: block;
  font-size: 0.98rem;
}

.compare-table td small {
  display: block;
  margin-top: 6px;
  color: var(--ink-soft);
}

.rate-gap {
  font-weight: 700;
}

.rate-gap--up {
  color: var(--success);
}

.rate-gap--down {
  color: var(--danger);
}

.heatmap-note {
  margin: 14px 0 0;
  color: var(--ink-soft);
  line-height: 1.65;
  text-wrap: wrap;
  padding-right: clamp(0px, 4vw, 120px);
}

.ai-insight-empty,
.ai-insight-content {
  min-height: 220px;
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
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
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

@media (max-width: 1460px) {
  .chart-grid__ranking {
    grid-column: span 5;
  }

  .chart-grid__compare {
    grid-column: span 7;
  }
}

@media (max-width: 1240px) {
  .upload-layout {
    grid-template-columns: 1fr;
  }

  .chart-grid__ranking,
  .chart-grid__compare,
  .chart-grid__heatmap {
    grid-column: 1 / -1;
  }
}

@media (max-width: 780px) {
  .analysis-hero,
  .topbar,
  .topbar__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .upload-actions,
  .topbar__actions {
    width: 100%;
  }

  .upload-actions .page-btn,
  .topbar__actions .page-btn {
    flex: 1 1 100%;
  }

  .chart-host--heatmap {
    height: clamp(480px, 92vw, 620px);
  }
}

@media (max-width: 520px) {
  .table-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import * as echarts from "echarts";
import AnalysisUploadStarter from "../components/AnalysisUploadStarter.vue";
import MetricCard from "../components/MetricCard.vue";
import EmptyState from "../components/EmptyState.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { exportElementToPdf } from "../utils/export";
import {
  buildStudentLabel,
  formatPercent,
  formatScore,
  formatSigned,
  getActiveRows,
  getSubjectSummary,
} from "../utils/analysis";

const router = useRouter();
const store = useEduScopeStore();

const pageRef = ref(null);
const replaceInputRef = ref(null);
const distributionChartRef = ref(null);
const boxplotChartRef = ref(null);
const selectedSubjectKey = ref("");
const selectedBand = ref("");
const searchKeyword = ref("");
const distributionMode = ref("pie");
const focusedStudentId = ref("");
const uploading = ref(false);
const sortState = reactive({ key: "rank", dir: "asc" });

let distributionChart = null;
let boxplotChart = null;

const requirements = [
  { label: "学生标识", value: "建议包含姓名或学号列" },
  { label: "目标科目", value: "至少包含 1 个需要统计的科目成绩列" },
  { label: "分析用途", value: "适合查看单科班级分布与排名明细" },
];

const dataset = computed(() => store.getDataset("subject"));
const availableRows = computed(() => getActiveRows(dataset.value));
const summary = computed(() => getSubjectSummary(dataset.value, selectedSubjectKey.value));

const filteredRows = computed(() => {
  const rows = [...(summary.value?.rows || [])]
    .filter((row) => !selectedBand.value || row.bandKey === selectedBand.value)
    .filter((row) => !searchKeyword.value || buildStudentLabel(row.row).toLowerCase().includes(searchKeyword.value.toLowerCase()));

  const factor = sortState.dir === "asc" ? 1 : -1;
  return rows.sort((left, right) => {
    const leftValue = left[sortState.key];
    const rightValue = right[sortState.key];
    if (typeof leftValue === "string" || typeof rightValue === "string") {
      return String(leftValue).localeCompare(String(rightValue), "zh-CN") * factor;
    }
    return ((leftValue ?? 0) - (rightValue ?? 0)) * factor;
  });
});

watch(
  () => dataset.value?.subjects,
  (subjects) => {
    if (!subjects?.length) {
      selectedSubjectKey.value = "";
      return;
    }
    if (!subjects.some((subject) => subject.key === selectedSubjectKey.value)) {
      selectedSubjectKey.value = subjects[0].key;
    }
  },
  { immediate: true }
);

watch(
  [summary, distributionMode, selectedBand],
  async () => {
    await nextTick();
    renderDistributionChart();
    renderBoxplotChart();
  },
  { deep: true }
);

onMounted(() => {
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  distributionChart?.dispose();
  boxplotChart?.dispose();
});

async function importSubjectFile(file) {
  if (!file) return;
  uploading.value = true;
  const result = await store.importExcel(file, "subject");
  uploading.value = false;

  if (!result.success) {
    store.showToast("班级分析数据匹配失败，已切换到失败页。");
    router.push("/analysis/failure");
    return;
  }

  store.showToast(`班级分析数据已完成解析，共识别 ${result.dataset.rows.length} 条记录。`);
}

function handleReplaceInput(event) {
  importSubjectFile(event.target.files?.[0]);
  event.target.value = "";
}

function triggerReplaceUpload() {
  replaceInputRef.value?.click();
}

function updateSort(key) {
  if (sortState.key === key) {
    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  } else {
    sortState.key = key;
    sortState.dir = key === "rank" ? "asc" : "desc";
    if (key === "student" || key === "bandLabel") sortState.dir = "asc";
  }
}

function renderSortIndicator(key) {
  if (sortState.key !== key) return "";
  return sortState.dir === "asc" ? "↑" : "↓";
}

function toggleBand(key) {
  selectedBand.value = selectedBand.value === key ? "" : key;
}

function renderDistributionChart() {
  if (!summary.value || !distributionChartRef.value) return;
  if (!distributionChart) distributionChart = echarts.init(distributionChartRef.value);
  const isPie = distributionMode.value === "pie";

  distributionChart.off("click");
  distributionChart.setOption(
    {
      animationDuration: 320,
      tooltip: {
        trigger: isPie ? "item" : "axis",
        formatter(params) {
          const source = Array.isArray(params) ? params[0] : params;
          const band = summary.value.bands[source.dataIndex];
          return `${band.label}<br/>人数：${band.count}<br/>占比：${formatPercent(band.ratio)}`;
        },
      },
      xAxis: isPie
        ? undefined
        : {
            type: "category",
            data: summary.value.bands.map((band) => band.label),
            axisTick: { show: false },
          },
      yAxis: isPie
        ? undefined
        : {
            type: "value",
            splitLine: { lineStyle: { color: "rgba(88,123,177,0.12)" } },
          },
      series: isPie
        ? [
            {
              type: "pie",
              radius: ["42%", "72%"],
              center: ["50%", "48%"],
              label: { formatter: "{b}\n{d}%" },
              data: summary.value.bands.map((band) => ({
                name: band.label,
                value: band.count,
                selected: selectedBand.value === band.key,
                itemStyle: { color: band.level === "good" ? "#0a2463" : band.level === "bad" ? "#e35d67" : "#94a3b8" },
              })),
            },
          ]
        : [
            {
              type: "bar",
              data: summary.value.bands.map((band) => ({
                value: band.count,
                itemStyle: { color: band.level === "good" ? "#0a2463" : band.level === "bad" ? "#e35d67" : "#94a3b8" },
              })),
              barWidth: "48%",
            },
          ],
    },
    true
  );

  distributionChart.on("click", (event) => {
    const band = summary.value.bands[event.dataIndex];
    if (!band) return;
    toggleBand(band.key);
  });
}

function renderBoxplotChart() {
  if (!summary.value || !boxplotChartRef.value) return;
  if (!boxplotChart) boxplotChart = echarts.init(boxplotChartRef.value);
  boxplotChart.setOption(
    {
      animationDuration: 320,
      tooltip: {
        trigger: "item",
        formatter(params) {
          if (params.seriesType === "boxplot") {
            const [min, q1, medianValue, q3, max] = params.data;
            return `最小值：${formatScore(min)}<br/>Q1：${formatScore(q1)}<br/>中位数：${formatScore(medianValue)}<br/>Q3：${formatScore(q3)}<br/>最大值：${formatScore(max)}`;
          }
          return `异常值：${formatScore(params.data.value[1])}<br/>学生：${params.data.student}`;
        },
      },
      xAxis: { type: "category", data: [summary.value.label], boundaryGap: true, axisTick: { show: false } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(88,123,177,0.12)" } } },
      series: [
        {
          type: "boxplot",
          data: [[summary.value.quartiles.min, summary.value.quartiles.q1, summary.value.quartiles.median, summary.value.quartiles.q3, summary.value.quartiles.max]],
          itemStyle: { color: "rgba(10, 36, 99, 0.14)", borderColor: "#0a2463" },
        },
        {
          type: "scatter",
          data: summary.value.outliers.map((outlier) => ({
            value: [0, outlier.score],
            student: buildStudentLabel(outlier.row),
          })),
          itemStyle: { color: "#be4e3f" },
        },
      ],
    },
    true
  );
}

function resizeCharts() {
  distributionChart?.resize();
  boxplotChart?.resize();
}

async function exportPdf() {
  if (!pageRef.value || !summary.value) return;
  store.showToast("正在导出班级分析 PDF...");
  await exportElementToPdf(pageRef.value, `${summary.value.label}-班级分析`);
}

function goBack() {
  router.push("/analysis");
}

function focusDistributionByRow(row) {
  const bandIndex = summary.value?.bands.findIndex((band) => band.key === row.bandKey) ?? -1;
  if (bandIndex < 0 || !distributionChart) return;
  distributionChart.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: bandIndex });
  distributionChart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: bandIndex });
}

function clearDistributionFocus() {
  distributionChart?.dispatchAction({ type: "downplay", seriesIndex: 0 });
  distributionChart?.dispatchAction({ type: "hideTip" });
}
</script>

<template>
  <section ref="pageRef" class="immersive-page">
    <template v-if="!dataset">
      <AnalysisUploadStarter
        eyebrow="Class Analysis"
        title="班级分析数据导入"
        description="上传适合班级分析的成绩表后，系统会在当前页面生成单科分布、排名明细和班级整体表现。"
        :requirements="requirements"
        :uploading="uploading"
        @import-file="importSubjectFile"
      >
        <template #actions>
          <button class="immersive-back" type="button" @click="goBack">返回成绩分析目录</button>
        </template>
      </AnalysisUploadStarter>
    </template>

    <template v-else-if="!summary">
      <div class="immersive-topbar">
        <button class="immersive-back" type="button" @click="goBack">返回成绩分析目录</button>
        <div class="immersive-topbar__tools">
          <input ref="replaceInputRef" type="file" accept=".xls,.xlsx" hidden @change="handleReplaceInput" />
          <button class="immersive-back" type="button" @click="triggerReplaceUpload">重新上传数据</button>
        </div>
      </div>

      <EmptyState title="当前没有可用于班级分析的数据" description="请在本页重新上传包含学生标识与目标科目成绩的 Excel 数据。" />
    </template>

    <template v-else>
      <div class="immersive-topbar">
        <button class="immersive-back" type="button" @click="goBack">返回成绩分析目录</button>
        <div class="immersive-topbar__tools">
          <input ref="replaceInputRef" type="file" accept=".xls,.xlsx" hidden @change="handleReplaceInput" />
          <button class="immersive-back" type="button" @click="triggerReplaceUpload">重新上传数据</button>
          <label class="immersive-select">
            <span>科目切换</span>
            <select v-model="selectedSubjectKey">
              <option v-for="subject in dataset.subjects" :key="subject.key" :value="subject.key">
                {{ subject.label }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <header class="immersive-hero">
        <div class="immersive-hero__copy">
          <p class="immersive-hero__eyebrow">班级分析</p>
          <h2>{{ summary.label }} 班级分析</h2>
          <p>查看该科目的分数段分布、排名明细与班级整体表现。共 {{ summary.rows.length }} 条有效记录，结果仅基于当前导入数据生成。</p>
        </div>
        <button class="immersive-export" type="button" @click="exportPdf">导出 PDF</button>
      </header>

      <div class="metric-grid">
        <MetricCard label="参考总人数" :value="summary.rows.length" hint="当前有效样本数" />
        <MetricCard label="科目满分" :value="summary.fullMark" hint="按当前数据自动推断" />
        <MetricCard label="平均分" :value="formatScore(summary.average)" />
        <MetricCard label="最高分" :value="formatScore(summary.max.score)" :hint="summary.max.student" />
        <MetricCard label="最低分" :value="formatScore(summary.min.score)" :hint="summary.min.student" />
        <MetricCard label="中位数" :value="formatScore(summary.median)" />
        <MetricCard label="标准差" :value="summary.stdDev.toFixed(2)" hint="分数离散度" />
        <MetricCard label="及格率" :value="formatPercent(summary.passRate)" :progress="summary.passRate" />
        <MetricCard label="优秀率" :value="formatPercent(summary.excellentRate)" :progress="summary.excellentRate" />
        <MetricCard label="低分率" :value="formatPercent(summary.lowRate)" :progress="summary.lowRate" />
      </div>

      <div class="subject-grid">
        <div class="subject-chart-stack">
          <section class="subject-panel">
            <div class="subject-panel__header">
              <div>
                <p class="subject-panel__eyebrow">Distribution</p>
                <h3>分数段分布</h3>
              </div>
              <button class="toggle-btn" type="button" @click="distributionMode = distributionMode === 'pie' ? 'bar' : 'pie'">
                {{ distributionMode === "pie" ? "切换为柱状图" : "切换为环形图" }}
              </button>
            </div>
            <div class="band-filter-row">
              <button class="band-pill" :class="{ 'band-pill--active': !selectedBand }" type="button" @click="selectedBand = ''">全部</button>
              <button
                v-for="band in summary.bands"
                :key="band.key"
                class="band-pill"
                :class="{ 'band-pill--active': selectedBand === band.key }"
                type="button"
                @click="toggleBand(band.key)"
              >
                {{ band.label }} ({{ band.count }})
              </button>
            </div>
            <div ref="distributionChartRef" class="chart-host"></div>
          </section>

          <section class="subject-panel">
            <div class="subject-panel__header">
              <div>
                <p class="subject-panel__eyebrow">Boxplot</p>
                <h3>成绩分布箱线图</h3>
              </div>
            </div>
            <div ref="boxplotChartRef" class="chart-host"></div>
          </section>
        </div>

        <section class="subject-panel">
          <div class="subject-panel__header">
            <div>
              <p class="subject-panel__eyebrow">Ranking</p>
              <h3>单科排名明细</h3>
            </div>
            <label class="search-field">
              <span>搜索学生</span>
              <input v-model="searchKeyword" type="search" placeholder="姓名 / 学号" />
            </label>
          </div>

          <div class="subject-table-wrap">
            <table>
              <thead>
                <tr>
                  <th @click="updateSort('rank')">班级排名 {{ renderSortIndicator("rank") }}</th>
                  <th @click="updateSort('student')">学生姓名 / 学号 {{ renderSortIndicator("student") }}</th>
                  <th @click="updateSort('score')">得分 {{ renderSortIndicator("score") }}</th>
                  <th @click="updateSort('rate')">得分率 {{ renderSortIndicator("rate") }}</th>
                  <th @click="updateSort('delta')">与平均分差值 {{ renderSortIndicator("delta") }}</th>
                  <th @click="updateSort('bandLabel')">档位 {{ renderSortIndicator("bandLabel") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredRows"
                  :key="row.row.id"
                  :class="{ 'row-focused': focusedStudentId === row.row.id }"
                  @mouseenter="focusedStudentId = row.row.id; focusDistributionByRow(row)"
                  @mouseleave="focusedStudentId = ''; clearDistributionFocus()"
                >
                  <td>{{ row.rank }}</td>
                  <td>{{ buildStudentLabel(row.row) }}</td>
                  <td>{{ formatScore(row.score) }}</td>
                  <td>{{ formatPercent(row.rate) }}</td>
                  <td>{{ formatSigned(row.delta) }}</td>
                  <td>
                    <span class="level-pill" :class="`level-pill--${row.bandLevel}`">{{ row.bandLabel }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.immersive-page {
  display: grid;
  gap: 18px;
  padding-bottom: 24px;
  align-content: start;
  grid-auto-rows: max-content;
}

.immersive-topbar,
.immersive-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.immersive-topbar__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.immersive-back,
.immersive-export,
.toggle-btn {
  padding: 12px 18px;
  border-radius: 999px;
  font-weight: 700;
}

.immersive-back,
.toggle-btn {
  border: 1px solid var(--line-strong);
  background: var(--surface-90);
}

.immersive-export {
  border: 0;
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: var(--paper-strong);
}

.immersive-select {
  display: grid;
  gap: 8px;
  color: var(--ink-soft);
}

.immersive-select select,
.search-field input {
  min-width: 240px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: var(--surface-92);
}

.immersive-hero {
  padding: 26px 28px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94)),
    radial-gradient(circle at top left, rgba(62, 146, 204, 0.16), transparent 34%);
  box-shadow: var(--shadow-lg);
}

.immersive-hero__copy {
  min-width: 0;
}

.immersive-hero__eyebrow,
.subject-panel__eyebrow {
  margin: 0;
  color: var(--copper);
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: var(--font-size-meta);
}

.immersive-hero h2,
.subject-panel h3 {
  margin: 10px 0 0;
}

.immersive-hero h2 {
  font-size: clamp(1.9rem, 2.6vw, 2.8rem);
  line-height: 1.12;
}

.immersive-hero p {
  margin: 12px 0 0;
  color: var(--ink-soft);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}

.subject-grid {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 18px;
}

.subject-chart-stack {
  display: grid;
  gap: 18px;
}

.subject-panel {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.subject-panel__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 0;
}

.band-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 22px 0;
}

.band-pill {
  padding: 9px 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(10, 36, 99, 0.08);
  color: var(--ink-soft);
}

.band-pill--active {
  background: rgba(10, 36, 99, 0.14);
  color: var(--copper);
}

.chart-host {
  height: clamp(280px, 32vw, 360px);
  margin: 18px 14px 18px;
}

.search-field {
  display: grid;
  gap: 8px;
  color: var(--ink-soft);
}

.subject-table-wrap {
  max-height: min(62vh, 760px);
  overflow: auto;
  margin: 18px 22px 22px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.82);
}

.subject-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.subject-table-wrap th,
.subject-table-wrap td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--table-line);
  text-align: left;
}

.subject-table-wrap th {
  position: sticky;
  top: 0;
  background: var(--surface-96);
  cursor: pointer;
}

.immersive-hero,
.subject-panel,
.subject-table-wrap {
  border-color: var(--card-border);
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
}

.immersive-hero {
  background:
    radial-gradient(circle at 100% 0%, var(--accent-12), transparent 38%),
    linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
}

.row-focused {
  background: rgba(10, 36, 99, 0.08);
}

.level-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: var(--font-size-caption);
  font-weight: 700;
}

.level-pill--good {
  color: var(--success);
  background: rgba(45, 138, 104, 0.14);
}

.level-pill--mid {
  color: var(--ink-soft);
  background: rgba(10, 36, 99, 0.08);
}

.level-pill--bad {
  color: var(--danger);
  background: rgba(190, 78, 63, 0.12);
}

@media (max-width: 1320px) {
  .subject-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .immersive-topbar,
  .immersive-hero,
  .subject-panel__header,
  .immersive-topbar__tools {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

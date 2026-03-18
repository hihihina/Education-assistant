<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import * as echarts from "echarts";
import AnalysisUploadStarter from "../components/AnalysisUploadStarter.vue";
import MetricCard from "../components/MetricCard.vue";
import EmptyState from "../components/EmptyState.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { exportElementToPdf } from "../utils/export";
import { formatPercent, formatScore, formatSigned, getActiveRows, getStudentProfile } from "../utils/analysis";

const router = useRouter();
const store = useEduScopeStore();

const pageRef = ref(null);
const replaceInputRef = ref(null);
const barChartRef = ref(null);
const radarChartRef = ref(null);
const selectedStudentId = ref("");
const showAverage = ref(true);
const focusedSubjectKey = ref("");
const uploading = ref(false);
const sortState = reactive({ key: "rate", dir: "desc" });

let barChart = null;
let radarChart = null;

const requirements = [
  { label: "学生标识", value: "建议包含姓名或学号列" },
  { label: "成绩列", value: "建议包含多科成绩，便于生成个人画像" },
  { label: "数据范围", value: "支持单次上传 Excel，会话内临时分析" },
];

const dataset = computed(() => store.getDataset("student"));
const availableRows = computed(() => getActiveRows(dataset.value));
const profile = computed(() => getStudentProfile(dataset.value, selectedStudentId.value));

const sortedSubjectRows = computed(() => {
  const rows = [...(profile.value?.subjectRows || [])];
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
  availableRows,
  (rows) => {
    if (!rows.length) {
      selectedStudentId.value = "";
      return;
    }
    if (!rows.some((row) => row.id === selectedStudentId.value)) {
      selectedStudentId.value = rows[0].id;
    }
  },
  { immediate: true }
);

watch(
  [profile, showAverage],
  async () => {
    await nextTick();
    renderBarChart();
    renderRadarChart();
  },
  { deep: true }
);

onMounted(() => {
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  barChart?.dispose();
  radarChart?.dispose();
});

async function importStudentFile(file) {
  if (!file) return;
  uploading.value = true;
  const result = await store.importExcel(file, "student");
  uploading.value = false;

  if (!result.success) {
    store.showToast("个人分析数据匹配失败，已切换到失败页。");
    router.push("/analysis/failure");
    return;
  }

  store.showToast(`个人分析数据已完成解析，共识别 ${result.dataset.rows.length} 条记录。`);
}

function handleReplaceInput(event) {
  importStudentFile(event.target.files?.[0]);
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
    sortState.dir = key === "subjectLabel" || key === "levelLabel" ? "asc" : "desc";
  }
}

function renderSortIndicator(key) {
  if (sortState.key !== key) return "";
  return sortState.dir === "asc" ? "↑" : "↓";
}

function renderBarChart() {
  if (!profile.value || !barChartRef.value) return;
  if (!barChart) barChart = echarts.init(barChartRef.value);

  barChart.off("click");
  barChart.setOption(
    {
      animationDuration: 320,
      grid: { top: 28, right: 24, bottom: 24, left: 88 },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(88,123,177,0.12)" } },
      },
      yAxis: {
        type: "category",
        data: profile.value.subjectRows.map((row) => row.subjectLabel),
        axisTick: { show: false },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter(params) {
          const row = profile.value.subjectRows[params[0].dataIndex];
          return `${row.subjectLabel}<br/>得分：${formatScore(row.score)} / ${row.fullMark}<br/>得分率：${formatPercent(row.rate)}<br/>排名：${row.rank}`;
        },
      },
      series: [
        {
          type: "bar",
          data: profile.value.subjectRows.map((row) => ({
            value: row.rate,
            itemStyle: {
              color: row.levelClass === "good" ? "#0a2463" : row.levelClass === "bad" ? "#e35d67" : "#94a3b8",
              borderRadius: [0, 10, 10, 0],
            },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "rgba(10, 36, 99, 0.24)" },
            data: [{ xAxis: 60 }, { xAxis: 85 }],
          },
        },
      ],
    },
    true
  );

  barChart.on("click", (event) => {
    const row = profile.value.subjectRows[event.dataIndex];
    focusedSubjectKey.value = row.subjectKey;
  });
}

function renderRadarChart() {
  if (!profile.value || !radarChartRef.value) return;
  if (!radarChart) radarChart = echarts.init(radarChartRef.value);

  radarChart.setOption(
    {
      animationDuration: 320,
      tooltip: {
        formatter(params) {
          return `${params.seriesName}<br/>${params.value
            .map((value, index) => `${profile.value.subjectRows[index].subjectLabel}: ${value.toFixed(1)}%`)
            .join("<br/>")}`;
        },
      },
      legend: { bottom: 0, textStyle: { color: "#6b7280" } },
      radar: {
        radius: "70%",
        splitNumber: 5,
        axisName: { color: "#111827" },
        splitLine: { lineStyle: { color: ["rgba(88,123,177,0.12)"] } },
        splitArea: { areaStyle: { color: ["rgba(255,255,255,0.18)", "rgba(10, 36, 99, 0.04)"] } },
        indicator: profile.value.subjectRows.map((row) => ({ name: row.subjectLabel, max: 100 })),
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: profile.value.subjectRows.map((row) => row.rate),
              name: "当前学生",
              areaStyle: { color: "rgba(10, 36, 99, 0.18)" },
              lineStyle: { color: "#0a2463" },
              itemStyle: { color: "#0a2463" },
            },
            ...(showAverage.value
              ? [
                  {
                    value: profile.value.subjectRows.map((row) => row.averageRate),
                    name: "数据集平均",
                    areaStyle: { color: "rgba(62, 146, 204, 0.16)" },
                    lineStyle: { color: "#6366f1" },
                    itemStyle: { color: "#6366f1" },
                  },
                ]
              : []),
          ],
        },
      ],
    },
    true
  );
}

function resizeCharts() {
  barChart?.resize();
  radarChart?.resize();
}

async function exportPdf() {
  if (!pageRef.value || !profile.value) return;
  store.showToast("正在导出个人分析 PDF...");
  await exportElementToPdf(pageRef.value, `${profile.value.student.displayName}-个人分析`);
}

function goBack() {
  router.push("/analysis");
}
</script>

<template>
  <section ref="pageRef" class="immersive-page">
    <template v-if="!dataset">
      <AnalysisUploadStarter
        eyebrow="Personal Analysis"
        title="个人分析数据导入"
        description="上传适合个人分析的成绩表后，系统会在当前页面生成学生画像、学科表现和个人排名情况。"
        :requirements="requirements"
        :uploading="uploading"
        @import-file="importStudentFile"
      >
        <template #actions>
          <button class="immersive-back" type="button" @click="goBack">返回成绩分析目录</button>
        </template>
      </AnalysisUploadStarter>
    </template>

    <template v-else-if="!profile">
      <div class="immersive-topbar">
        <button class="immersive-back" type="button" @click="goBack">返回成绩分析目录</button>
        <div class="immersive-topbar__tools">
          <input ref="replaceInputRef" type="file" accept=".xls,.xlsx" hidden @change="handleReplaceInput" />
          <button class="immersive-back" type="button" @click="triggerReplaceUpload">重新上传数据</button>
        </div>
      </div>

      <EmptyState title="当前没有可用于个人分析的数据" description="请在本页重新上传包含学生标识与成绩列的 Excel 数据。" />
    </template>

    <template v-else>
      <div class="immersive-topbar">
        <button class="immersive-back" type="button" @click="goBack">返回成绩分析目录</button>
        <div class="immersive-topbar__tools">
          <input ref="replaceInputRef" type="file" accept=".xls,.xlsx" hidden @change="handleReplaceInput" />
          <button class="immersive-back" type="button" @click="triggerReplaceUpload">重新上传数据</button>
          <label class="immersive-select">
            <span>学生切换</span>
            <select v-model="selectedStudentId">
              <option v-for="row in availableRows" :key="row.id" :value="row.id">
                {{ row.displayName }}{{ row.code ? ` / ${row.code}` : "" }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <header class="immersive-hero">
        <div class="immersive-hero__copy">
          <p class="immersive-hero__eyebrow">个人分析</p>
          <h2>{{ profile.student.displayName }} 的个人分析</h2>
          <p>
            查看该学生的总分、学科强弱和班内位置。
            {{ profile.student.code ? `学号 ${profile.student.code}` : "当前记录未识别学号" }}，结果仅基于当前导入数据生成。
          </p>
        </div>
        <button class="immersive-export" type="button" @click="exportPdf">导出 PDF</button>
      </header>

      <div class="metric-grid">
        <MetricCard label="总分" :value="formatScore(profile.totalScore)" :hint="`${profile.subjectCount} 个已识别科目`" />
        <MetricCard label="总得分率" :value="formatPercent(profile.totalRate)" :progress="profile.totalRate" />
        <MetricCard label="总分排名" :value="`${profile.totalRank} / ${profile.participantCount}`" :hint="`共 ${profile.participantCount} 人参与统计`" />
        <MetricCard label="优势科目" :value="profile.strongCount" hint="得分率 ≥ 85%" />
        <MetricCard label="待提升科目" :value="profile.lowCount" hint="得分率 < 60%" />
        <MetricCard label="均衡度" :value="profile.balanceLabel" :hint="`标准差 ${profile.balanceStd.toFixed(1)}`" />
      </div>

      <div class="student-grid">
        <section class="student-panel">
          <div class="student-panel__header">
            <div>
              <p class="student-panel__eyebrow">Subject Table</p>
              <h3>全科目成绩明细</h3>
            </div>
          </div>

          <div class="student-table-wrap">
            <table>
              <thead>
                <tr>
                  <th @click="updateSort('subjectLabel')">科目名称 {{ renderSortIndicator("subjectLabel") }}</th>
                  <th @click="updateSort('score')">本次得分 {{ renderSortIndicator("score") }}</th>
                  <th @click="updateSort('fullMark')">科目满分 {{ renderSortIndicator("fullMark") }}</th>
                  <th @click="updateSort('rate')">得分率 {{ renderSortIndicator("rate") }}</th>
                  <th @click="updateSort('delta')">超 / 低于平均分 {{ renderSortIndicator("delta") }}</th>
                  <th @click="updateSort('rank')">排名 {{ renderSortIndicator("rank") }}</th>
                  <th @click="updateSort('levelLabel')">水平 {{ renderSortIndicator("levelLabel") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sortedSubjectRows"
                  :key="row.subjectKey"
                  :class="{ 'row-focused': focusedSubjectKey === row.subjectKey }"
                  @mouseenter="focusedSubjectKey = row.subjectKey"
                  @mouseleave="focusedSubjectKey = ''"
                >
                  <td>{{ row.subjectLabel }}</td>
                  <td>{{ formatScore(row.score) }}</td>
                  <td>{{ row.fullMark }}</td>
                  <td>{{ formatPercent(row.rate) }}</td>
                  <td>{{ formatSigned(row.delta) }}</td>
                  <td>{{ row.rank }}</td>
                  <td>
                    <span class="level-pill" :class="`level-pill--${row.levelClass}`">{{ row.levelLabel }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="student-chart-stack">
          <section class="student-panel">
            <div class="student-panel__header">
              <div>
                <p class="student-panel__eyebrow">Bar Chart</p>
                <h3>科目得分率柱状图</h3>
              </div>
            </div>
            <div ref="barChartRef" class="chart-host"></div>
          </section>

          <section class="student-panel">
            <div class="student-panel__header">
              <div>
                <p class="student-panel__eyebrow">Radar Chart</p>
                <h3>科目得分雷达图</h3>
              </div>
              <label class="toggle-field">
                <input v-model="showAverage" type="checkbox" />
                <span>显示平均分对比</span>
              </label>
            </div>
            <div ref="radarChartRef" class="chart-host"></div>
          </section>
        </div>
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
.immersive-export {
  padding: 12px 18px;
  border-radius: 999px;
  font-weight: 700;
}

.immersive-back {
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

.immersive-select select {
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
.student-panel__eyebrow {
  margin: 0;
  color: var(--copper);
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-size: var(--font-size-meta);
}

.immersive-hero h2,
.student-panel h3 {
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

.student-grid {
  display: grid;
  grid-template-columns: 1.02fr 0.98fr;
  gap: 18px;
}

.student-chart-stack {
  display: grid;
  gap: 18px;
}

.student-panel {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.student-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 0;
}

.student-table-wrap {
  max-height: min(62vh, 760px);
  overflow: auto;
  margin: 18px 22px 22px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.82);
}

.student-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.student-table-wrap th,
.student-table-wrap td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--table-line);
  text-align: left;
}

.student-table-wrap th {
  position: sticky;
  top: 0;
  background: var(--surface-96);
  cursor: pointer;
}

.immersive-hero,
.student-panel,
.student-table-wrap {
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

.chart-host {
  height: clamp(280px, 34vw, 360px);
  margin: 18px 14px 18px;
}

.toggle-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-soft);
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

@media (max-width: 1280px) {
  .student-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .immersive-topbar,
  .immersive-hero,
  .immersive-topbar__tools {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

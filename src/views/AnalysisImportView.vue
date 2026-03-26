<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";

const store = useEduScopeStore();

const analysisCards = [
  {
    title: "班级小题分析",
    description: "上传双向细目表与单个班级的小题细分数据，定位班级薄弱题目和知识点，并生成 AI 班级解读。",
    requirements: "共上传 2 份文件：细目表 + 班级小题明细。",
    to: "/analysis/class-question",
    tag: "Class Question",
  },
  {
    title: "年级情况分析",
    description: "上传双向细目表与多个班级文件，横向比较各班级排名与薄弱知识点，并生成 AI 年级解读。",
    requirements: "共上传 1 份细目表 + 多个班级小题明细文件。",
    to: "/analysis/grade-overview",
    tag: "Grade Overview",
  },
];

const sessionCards = computed(() => [
  {
    label: "班级小题分析",
    value: store.datasets.classQuestion ? `${store.datasets.classQuestion.metrics.participantCount} 人` : "未导入",
  },
  {
    label: "年级情况分析",
    value: store.datasets.gradeOverview ? `${store.datasets.gradeOverview.metrics.classCount} 个班级` : "未导入",
  },
]);

const checklist = [
  {
    title: "班级小题分析",
    desc: "上传双向细目表与单班小题数据，将自动输出薄弱小题、薄弱知识点、AI 智能分析、统计图和明细表。",
  },
  {
    title: "年级情况分析",
    desc: "上传双向细目表与多个班级文件，输出班级排名、知识点热力图、小题差异排行、AI 智能分析和横向对比表。",
  },
  {
    title: "科目名称智能识别",
    desc: "系统将优先根据导入的 Excel 文件名进行自动识别，并在分析结果内页的头部直接为你展示。",
  },
  {
    title: "严格及默认题号规则",
    desc: "当前版本暂不提供手工映射操作，要求最终作答题号必须与双向细目表保持一致或高度接近以确保准确。",
  },
];
</script>

<template>
  <section class="analysis-hub">
    <header class="analysis-hub__hero">
      <div class="analysis-hub__copy">
        <p class="analysis-hub__eyebrow">Analysis Workspace</p>
        <h2 class="hero-title">
          通过 <span>班级小题分析</span> 或 <span>年级情况分析</span> 入口<br />
          进入对应的数据导入与概览页面
        </h2>
        <p class="analysis-hub__lead">
          当前成绩分析聚焦小题与知识点层级诊断。请根据任务类型，在左侧子菜单或下方卡片中选择入口。
        </p>
      </div>

      <SurfacePanel title="当前会话" eyebrow="Session" compact>
        <div class="session-grid">
          <article v-for="item in sessionCards" :key="item.label" class="session-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
      </SurfacePanel>
    </header>

    <div class="analysis-card-grid">
      <RouterLink v-for="item in analysisCards" :key="item.to" :to="item.to" class="analysis-card">
        <span class="analysis-card__tag">{{ item.tag }}</span>
        <h3>{{ item.title }}</h3>
        <p>{{ item.description }}</p>
        <small>{{ item.requirements }}</small>
        <span class="analysis-card__action">进入页面</span>
      </RouterLink>
    </div>

    <SurfacePanel title="功能清单" eyebrow="Checklist">
      <div class="checklist-grid">
        <article v-for="item in checklist" :key="item.title" class="checklist-card">
          <div class="checklist-card__header">
            <span class="checklist-dot"></span>
            <strong>{{ item.title }}</strong>
          </div>
          <p>{{ item.desc }}</p>
        </article>
      </div>
    </SurfacePanel>
  </section>
</template>

<style scoped>
.analysis-hub {
  display: grid;
  gap: 22px;
  align-content: start;
  min-width: 0;
}

.analysis-hub__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(300px, 0.88fr);
  gap: clamp(18px, 2.2vw, 24px);
  align-items: start;
}

.analysis-hub__copy {
  min-width: 0;
  padding: clamp(26px, 3vw, 36px);
  border: 1px solid var(--line);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(243, 244, 246, 0.9));
  box-shadow: var(--shadow-md);
}

.analysis-hub__eyebrow,
.analysis-card__tag,
.analysis-card__action {
  display: inline-flex;
  margin: 0;
  color: var(--copper);
  font-size: var(--font-size-meta);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero-title {
  margin: 18px 0 0;
  font-size: clamp(1.6rem, 2.5vw, 2.4rem);
  line-height: 1.35;
  font-weight: 800;
  color: var(--copper);
  letter-spacing: -0.01em;
}

.hero-title span {
  color: var(--teal);
  position: relative;
  display: inline-block;
}

.hero-title span::after {
  content: "";
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  height: 8px;
  background: var(--primary-12);
  border-radius: 4px;
  z-index: -1;
}

.analysis-hub__lead,
.analysis-card p,
.analysis-card small,
.session-card span {
  color: var(--ink-soft);
  text-wrap: wrap;
}

.analysis-hub__lead {
  margin: 20px 0 0;
  font-size: 1.05rem;
  line-height: 1.6;
}

.session-grid,
.analysis-card-grid,
.checklist-grid {
  display: grid;
  gap: 16px;
}

.session-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.checklist-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.checklist-card {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--shadow-sm);
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.checklist-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-24);
}

.checklist-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.checklist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--teal);
  box-shadow: 0 0 0 3px var(--primary-12);
}

.checklist-card strong {
  font-size: 1.05rem;
  color: var(--copper);
}

.checklist-card p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--ink-soft);
}

.session-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(249, 250, 251, 0.92);
}

.session-card strong {
  display: block;
  margin-top: 8px;
  font-size: 1.3rem;
}

.analysis-card-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.analysis-card {
  display: grid;
  gap: 12px;
  align-content: start;
  min-height: 100%;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow-md);
  transition: 180ms ease;
}

.analysis-card:hover {
  transform: translateY(-1px);
}

.analysis-card h3 {
  margin: 0;
  font-size: 1.18rem;
}

.analysis-card p,
.analysis-card small {
  margin: 0;
  line-height: 1.65;
}

.analysis-hub__copy,
.session-card,
.analysis-card {
  position: relative;
  overflow: hidden;
  border-color: var(--card-border);
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 220ms ease;
}

.analysis-card:hover,
.session-card:hover {
  transform: translateY(-2px);
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
}

@media (max-width: 1240px) {
  .analysis-hub__hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .analysis-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>

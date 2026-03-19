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
  "班级小题分析：上传双向细目表与单班小题数据，输出薄弱小题、薄弱知识点、AI 智能分析、统计图和明细表。",
  "年级情况分析：上传双向细目表与多个班级文件，输出班级排名、知识点热力图、小题差异排行、AI 智能分析和横向对比表。",
  "科目名称：优先根据 Excel 文件名自动识别，并在分析页头部直接展示。",
  "固定规则：当前版本不提供手工映射，题号需与双向细目表保持一致或高度接近。",
];
</script>

<template>
  <section class="analysis-hub">
    <header class="analysis-hub__hero">
      <div class="analysis-hub__copy">
        <p class="analysis-hub__eyebrow">Analysis Workspace</p>
        <h2>从班级小题分析或年级情况分析入口进入对应的数据导入与分析页面</h2>
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
      <div class="session-grid">
        <article v-for="item in checklist" :key="item" class="session-card">
          <strong>{{ item }}</strong>
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

.analysis-hub h2 {
  margin: 14px 0 0;
  font-size: clamp(2rem, 3.1vw, 3.3rem);
  line-height: 1.08;
}

.analysis-hub__lead,
.analysis-card p,
.analysis-card small,
.session-card span {
  color: var(--ink-soft);
  text-wrap: wrap;
}

.analysis-hub__lead {
  margin: 16px 0 0;
}

.session-grid,
.analysis-card-grid {
  display: grid;
  gap: 16px;
}

.session-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

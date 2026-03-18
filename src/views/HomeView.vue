<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import { RouterLink } from "vue-router";

const routeCards = [
  {
    title: "成绩分析",
    description: "围绕班级小题分析和年级情况分析开展诊断，关注题目与知识点层级的薄弱项。",
    to: "/analysis",
    tag: "成绩诊断",
  },
  {
    title: "智能助手",
    description: "支持连续文本对话，并可导入 Word(.docx) 与 Excel 表格做分析，适合知识讲解、学习规划、错题复盘和日常学习辅导。",
    to: "/assistant",
    tag: "连续对话",
  },
  {
    title: "智能出题",
    description: "按年级、科目、题型和难度设置生成带详细解析的练习题，适合做日常训练或课堂补充。",
    to: "/question-studio",
    tag: "难度出题",
  },
  {
    title: "智能出卷",
    description: "根据知识点、题型数量和可选参考试卷生成整份试卷，适合备课与阶段测验。",
    to: "/paper-studio",
    tag: "整卷生成",
  },
  {
    title: "题目变式",
    description: "先提取一道原题的知识点，再按你的修订结果生成几道类似结构的变式题。",
    to: "/question-variant",
    tag: "变式训练",
  },
];

const stats = [
  { label: "核心模块", value: "5", hint: "分析 / 助手 / 出题 / 出卷 / 变式" },
  { label: "数据保存", value: "会话内", hint: "不做持久化" },
  { label: "AI 输入", value: "文本 / Word / Excel", hint: "不支持图片" },
];

const focusPoints = [
  {
    title: "任务分区清晰",
    description: "总览、成绩分析、智能助手、智能出题、智能出卷和题目变式分别对应独立页面，操作路径更直接。",
  },
  {
    title: "自适应布局",
    description: "主内容区、卡片和面板会根据屏幕尺寸调整比例，兼顾桌面与移动端浏览。",
  },
  {
    title: "会话内处理",
    description: "数据、API Key、对话和试题结果仅保存在当前会话，轻量且适合临时使用。",
  },
  {
    title: "变式训练链路",
    description: "可先识别原题知识点，再按修订后的知识点生成类似题，适合日常拓展训练。",
  },
  {
    title: "整卷生成能力",
    description: "可围绕知识点和题型数量直接生成试卷，也支持导入参考试卷做风格借鉴。",
  },
];

let revealObserver = null;

onMounted(() => {
  const revealNodes = Array.from(document.querySelectorAll(".reveal-item"));
  revealNodes.forEach((node, index) => {
    node.style.transitionDelay = `${Math.min(index * 70, 260)}ms`;
  });

  if (!("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px",
    }
  );

  revealNodes.forEach((node) => revealObserver.observe(node));
});

onBeforeUnmount(() => {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
});
</script>

<template>
  <section class="overview-page">
    <header class="overview-section hero-section reveal-item">
      <div class="hero-content">
        <p class="eyebrow">Education Assistant Overview</p>
        <h1>面向轻量教育辅助的成绩分析、智能助手、智能出题与智能出卷平台</h1>
        <p class="hero-lead">
          edua 聚焦五类高频任务：基于小题数据做成绩分析、与智能助手连续对话、按年级和学科生成练习题、围绕知识点生成整份试卷，以及围绕原题生成变式训练题。
        </p>

        <div class="hero-actions">
          <RouterLink class="hero-btn hero-btn--primary" to="/analysis">开始成绩分析</RouterLink>
          <RouterLink class="hero-btn hero-btn--ghost" to="/ai">进入 AI 工作区</RouterLink>
        </div>

        <div class="kpi-grid">
          <article v-for="item in stats" :key="item.label" class="kpi-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </article>
        </div>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <article class="visual-card visual-card--main">
          <p>Session Runtime</p>
          <strong>Excel / AI Key / 对话结果仅会话内保存</strong>
          <div class="visual-bars">
            <span style="--w: 88%"></span>
            <span style="--w: 74%"></span>
            <span style="--w: 66%"></span>
          </div>
        </article>
        <article class="visual-card visual-card--sub">
          <p>Workspace Entry</p>
          <strong>分析 + 助手 + 出题 + 出卷 + 变式</strong>
        </article>
        <span class="visual-chip visual-chip--one">Class Analysis</span>
        <span class="visual-chip visual-chip--two">Question Studio</span>
        <span class="visual-chip visual-chip--three">Paper Composer</span>
      </div>
    </header>

    <section class="overview-section reveal-item">
      <div class="section-head">
        <p class="eyebrow">Core Modules</p>
        <h2>核心工作台</h2>
        <p>保留原有总览内容结构，聚焦你常用的五类工作路径，开箱即用。</p>
      </div>

      <div class="module-grid">
        <RouterLink v-for="card in routeCards" :key="card.to" :to="card.to" class="module-card">
          <span class="module-tag">{{ card.tag }}</span>
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
          <span class="module-link">打开工作台</span>
        </RouterLink>
      </div>
    </section>

    <section class="overview-section reveal-item">
      <div class="section-head">
        <p class="eyebrow">Current Highlights</p>
        <h2>当前特色</h2>
        <p>围绕任务分区、响应式体验与会话式处理能力，保持轻量且高效的操作体验。</p>
      </div>

      <div class="focus-grid">
        <article v-for="item in focusPoints" :key="item.title" class="focus-card">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped>
.overview-page {
  border-radius: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, var(--accent-12), transparent 34%),
    linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
}

.overview-section {
  padding: clamp(80px, 9vw, 100px) clamp(20px, 5vw, 72px);
}

.overview-section + .overview-section {
  border-top: 1px solid var(--primary-08);
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: clamp(28px, 4vw, 52px);
  align-items: center;
}

.section-head {
  display: grid;
  gap: 14px;
  margin-bottom: clamp(26px, 3vw, 34px);
  max-width: 74ch;
}

.eyebrow,
.module-tag,
.module-link {
  margin: 0;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--copper);
}

.hero-content h1 {
  margin: 14px 0 0;
  font-size: clamp(36px, 4.3vw, 48px);
  line-height: 1.1;
  font-weight: 800;
  color: var(--copper);
}

.section-head h2 {
  margin: 0;
  font-size: clamp(24px, 2.9vw, 32px);
  line-height: 1.2;
  font-weight: 600;
  color: var(--copper);
}

.hero-lead,
.section-head p,
.module-card p,
.focus-card p,
.kpi-card span,
.kpi-card small {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink-soft);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 16px;
  font-weight: 600;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, color 180ms ease;
}

.hero-btn--primary {
  background: linear-gradient(120deg, var(--copper), var(--teal));
  color: var(--paper-strong);
}

.hero-btn--ghost {
  background: var(--paper-strong);
  border-color: var(--primary-22);
  color: var(--copper);
}

.hero-btn:hover {
  transform: translateY(-1px);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 30px;
}

.kpi-card,
.module-card,
.focus-card,
.visual-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 220ms ease;
}

.kpi-card::before,
.module-card::before,
.focus-card::before,
.visual-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--surface-68), transparent 38%);
  pointer-events: none;
}

.kpi-card::after,
.module-card::after,
.focus-card::after,
.visual-card::after {
  content: "";
  position: absolute;
  top: -42%;
  right: -24%;
  width: 62%;
  height: 84%;
  background: radial-gradient(circle, var(--card-glow), transparent 68%);
  pointer-events: none;
}

.kpi-card > *,
.module-card > *,
.focus-card > *,
.visual-card > * {
  position: relative;
  z-index: 1;
}

.kpi-card {
  padding: 16px;
}

.kpi-card strong {
  display: block;
  margin-top: 8px;
  font-size: clamp(24px, 2.1vw, 30px);
  line-height: 1.15;
  color: var(--copper);
}

.kpi-card small {
  display: block;
  margin-top: 8px;
}

.hero-visual {
  position: relative;
  min-height: 330px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background:
    radial-gradient(circle at 0% 0%, var(--accent-12), transparent 44%),
    linear-gradient(180deg, var(--surface-98), var(--surface-muted-92));
}

.visual-card {
  min-width: 0;
  padding: 16px;
}

.visual-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.3;
  color: var(--ink-soft);
}

.visual-card strong {
  display: block;
  margin-top: 8px;
  color: var(--copper);
  line-height: 1.28;
}

.visual-card--main strong {
  font-size: clamp(1.08rem, 0.62vw + 0.96rem, 1.34rem);
}

.visual-card--sub strong {
  font-size: clamp(1.02rem, 0.42vw + 0.94rem, 1.2rem);
  word-break: break-word;
}

.visual-card--main {
  width: min(100%, 340px);
}

.visual-card--sub {
  width: min(100%, 260px);
  margin-top: 14px;
  margin-left: auto;
}

.visual-bars {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.visual-bars span {
  display: block;
  height: 8px;
  width: var(--w);
  border-radius: 999px;
  background: linear-gradient(90deg, var(--copper), var(--teal));
}

.visual-chip {
  position: absolute;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--primary-20);
  background: var(--surface-94);
  font-size: 12px;
  color: var(--copper);
}

.visual-chip--one {
  top: 22px;
  right: 22px;
}

.visual-chip--two {
  bottom: 76px;
  left: 24px;
}

.visual-chip--three {
  right: 24px;
  bottom: 22px;
}

.module-grid,
.focus-grid {
  display: grid;
  gap: 16px;
}

.module-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.focus-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.module-card,
.focus-card {
  padding: 20px;
  align-content: start;
}

.module-card h3,
.focus-card h3 {
  margin: 14px 0 0;
  font-size: 20px;
  line-height: 1.3;
  color: var(--copper);
}

.module-card p,
.focus-card p {
  margin-top: 10px;
}

.module-link {
  margin-top: 14px;
  color: var(--teal);
}

.kpi-card:hover,
.module-card:hover,
.focus-card:hover,
.visual-card:hover {
  border-color: var(--card-border-hover);
  background: linear-gradient(140deg, var(--primary-05), var(--accent-08) 58%, var(--surface-98));
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
  transform: translateY(-3px);
}

.reveal-item {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 560ms ease, transform 560ms ease;
}

.reveal-item.is-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 1220px) {
  .hero-section {
    grid-template-columns: 1fr;
  }

  .hero-visual {
    min-height: 0;
    padding: 18px;
  }

  .visual-card--main,
  .visual-card--sub {
    width: 100%;
    margin: 0;
  }

  .visual-chip {
    position: static;
    display: inline-flex;
    margin: 6px 8px 0 0;
  }

  .visual-chip--one,
  .visual-chip--two,
  .visual-chip--three {
    top: auto;
    right: auto;
    bottom: auto;
    left: auto;
  }

  .module-grid,
  .focus-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .kpi-grid,
  .module-grid,
  .focus-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-btn {
    flex: 1 1 220px;
  }
}
</style>

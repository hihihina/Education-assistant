<script setup>
import { RouterLink } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";

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
</script>

<template>
  <section class="home-dashboard">
    <header class="home-hero">
      <div class="home-hero__copy">
        <p class="home-hero__eyebrow">edua</p>
        <h2>面向轻量教育辅助的成绩分析、智能助手、智能出题与智能出卷平台</h2>
        <p class="home-hero__lead">
          edua 聚焦五类高频任务：基于小题数据做成绩分析、与智能助手连续对话、按年级和学科生成练习题、围绕知识点生成整份试卷，以及围绕原题生成变式训练题。左侧导航帮助你快速切换工作区。
        </p>
        <div class="home-hero__actions">
          <RouterLink class="home-btn home-btn--primary" to="/analysis">开始成绩分析</RouterLink>
          <RouterLink class="home-btn home-btn--ghost" to="/ai">进入 AI 工作区</RouterLink>
        </div>
      </div>

      <SurfacePanel title="平台概况" eyebrow="总览" compact>
        <div class="hero-stat-list">
          <article v-for="item in stats" :key="item.label" class="hero-stat">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </article>
        </div>
        <div class="hero-note">
          edua 采用会话式处理方式，Excel 数据、API Key、对话和题目结果都只保留在当前浏览会话内。
        </div>
      </SurfacePanel>
    </header>

    <div class="route-grid">
      <RouterLink v-for="card in routeCards" :key="card.to" :to="card.to" class="route-card">
        <span class="route-card__tag">{{ card.tag }}</span>
        <h3>{{ card.title }}</h3>
        <p>{{ card.description }}</p>
        <span class="route-card__action">打开工作台</span>
      </RouterLink>
    </div>

    <SurfacePanel title="当前特色" eyebrow="当前版本">
      <div class="focus-grid">
        <article v-for="item in focusPoints" :key="item.title" class="focus-item">
          <strong>{{ item.title }}</strong>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </SurfacePanel>
  </section>
</template>

<style scoped>
.home-dashboard {
  display: grid;
  gap: 22px;
}

.home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(340px, 460px);
  gap: 20px;
  align-items: stretch;
}

.home-hero__copy {
  padding: clamp(26px, 3vw, 38px);
  border: 1px solid var(--line);
  border-radius: 32px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(235, 244, 255, 0.9));
  box-shadow: var(--shadow-md);
}

.home-hero__eyebrow,
.route-card__tag,
.route-card__action {
  display: inline-flex;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--copper);
}

.home-hero h2 {
  margin: 14px 0 0;
  font-size: clamp(2rem, 3.2vw, 3.6rem);
  line-height: 1.08;
  max-width: none;
}

.home-hero__lead,
.route-card p,
.focus-item p,
.hero-note,
.hero-stat span,
.hero-stat small {
  color: var(--ink-soft);
}

.home-hero__lead {
  max-width: 58ch;
  margin: 16px 0 0;
  font-size: 1.02rem;
}

.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}

.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 13px 18px;
  border-radius: 999px;
  font-weight: 700;
  transition: 180ms ease;
}

.home-btn--primary {
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: #ffffff;
  box-shadow: 0 18px 34px rgba(47, 125, 244, 0.22);
}

.home-btn--ghost {
  background: rgba(47, 125, 244, 0.08);
}

.hero-stat-list,
.route-grid,
.focus-grid {
  display: grid;
  gap: 16px;
}

.hero-stat-list {
  grid-template-columns: repeat(3, minmax(120px, 1fr));
}

.hero-stat {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(248, 251, 255, 0.92);
}

.hero-stat strong {
  display: block;
  margin-top: 10px;
  font-size: 1.6rem;
}

.hero-stat small {
  display: block;
  margin-top: 8px;
}

.hero-note {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(47, 125, 244, 0.06);
}

.route-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.route-card {
  display: grid;
  gap: 12px;
  align-content: start;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-md);
  transition: 180ms ease;
}

.route-card:hover,
.home-btn:hover {
  transform: translateY(-1px);
}

.route-card h3,
.focus-item strong {
  font-size: 1.08rem;
}

.route-card h3 {
  margin: 0;
}

.route-card p,
.focus-item p {
  margin: 0;
  line-height: 1.65;
}

.focus-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.focus-item {
  padding: 18px;
  align-content: start;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: rgba(248, 251, 255, 0.92);
}

.focus-item strong {
  display: block;
  margin-bottom: 8px;
}

@media (max-width: 1120px) {
  .home-hero,
  .route-grid,
  .focus-grid {
    grid-template-columns: 1fr;
  }

  .home-hero h2 {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .hero-stat-list {
    grid-template-columns: 1fr;
  }

  .home-hero__copy {
    padding: 24px;
  }
}
</style>

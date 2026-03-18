<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useEduScopeStore } from "../composables/useEduScopeStore";

const route = useRoute();
const store = useEduScopeStore();

const navGroups = [
  {
    label: "工作台",
    items: [
      {
        label: "总览",
        to: "/",
        badge: "01",
      },
    ],
  },
  {
    label: "AI 工作区",
    items: [
      {
        label: "AI 工作区",
        to: "/ai",
        badge: "02",
        matchPrefixes: ["/ai", "/assistant", "/question-studio", "/paper-studio", "/question-variant"],
        children: [
          { label: "智能助手", to: "/assistant" },
          { label: "智能出题", to: "/question-studio" },
          { label: "智能出卷", to: "/paper-studio" },
          { label: "题目变式", to: "/question-variant" },
        ],
      },
    ],
  },
  {
    label: "成绩分析",
    items: [
      {
        label: "成绩分析",
        to: "/analysis",
        badge: "03",
        matchPrefix: "/analysis",
        children: [
          { label: "班级小题分析", to: "/analysis/class-question" },
          { label: "年级情况分析", to: "/analysis/grade-overview" },
        ],
      },
    ],
  },
];

const apiStatus = computed(() => (store.ai.apiKey ? "已配置" : "待配置"));
const datasetStatus = computed(() => {
  const classReady = !!store.datasets.classQuestion;
  const gradeReady = !!store.datasets.gradeOverview;
  if (classReady && gradeReady) return "班级小题 / 年级已导入";
  if (classReady) return "班级小题已导入";
  if (gradeReady) return "年级已导入";
  return "未导入";
});

function isActive(item) {
  if (item.to === "/") {
    return route.path === "/";
  }
  const prefixes = Array.isArray(item.matchPrefixes) ? item.matchPrefixes : [item.matchPrefix || item.to];
  return route.path === item.to || prefixes.some((prefix) => route.path.startsWith(prefix));
}

function isChildActive(child) {
  return route.path === child.to || route.path.startsWith(`${child.to}/`);
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar__brand">
      <div class="brand-mark">ea</div>
      <div>
        <p class="brand-eyebrow">education assistant</p>
        <h1>edua</h1>
        <p class="brand-copy">成绩分析、智能助手、出题与出卷工作台。</p>
      </div>
    </div>

    <nav class="app-sidebar__nav" aria-label="站点导航">
      <section v-for="group in navGroups" :key="group.label" class="sidebar-group">
        <p class="sidebar-group__label">{{ group.label }}</p>

        <div v-for="item in group.items" :key="item.to" class="sidebar-item">
          <RouterLink
            :to="item.to"
            class="sidebar-link"
            :class="{ 'sidebar-link--active': isActive(item) }"
          >
            <span class="sidebar-link__badge">{{ item.badge }}</span>
            <strong>{{ item.label }}</strong>
          </RouterLink>

          <div v-if="item.children" class="sidebar-subnav">
            <RouterLink
              v-for="child in item.children"
              :key="child.to"
              :to="child.to"
              class="sidebar-sub-link"
              :class="{ 'sidebar-sub-link--active': isChildActive(child) }"
            >
              <span class="sidebar-sub-link__dot"></span>
              <span>{{ child.label }}</span>
            </RouterLink>
          </div>
        </div>
      </section>
    </nav>

    <div class="app-sidebar__status">
      <div class="sidebar-note">
        <strong>当前为会话模式</strong>
        <p>Excel 数据、AI Key、对话与题目结果只保存在当前浏览会话内存中。</p>
      </div>

      <div class="status-grid">
        <article class="status-card">
          <span>AI 状态</span>
          <strong>{{ apiStatus }}</strong>
        </article>
        <article class="status-card">
          <span>数据状态</span>
          <strong>{{ datasetStatus }}</strong>
        </article>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  position: sticky;
  top: clamp(12px, 1.4vw, 18px);
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: calc(100vh - 36px);
  padding: clamp(18px, 1.8vw, 24px);
  border: 1px solid var(--line);
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 248, 255, 0.92));
  box-shadow: var(--shadow-md);
}

.app-sidebar__brand {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: linear-gradient(145deg, var(--copper), var(--teal));
  color: #ffffff;
  font-weight: 800;
  font-size: 0.94rem;
  letter-spacing: 0.05em;
  box-shadow: 0 18px 34px rgba(47, 125, 244, 0.22);
}

.brand-eyebrow,
.sidebar-group__label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--copper);
}

.app-sidebar__brand h1 {
  margin: 8px 0 0;
  font-size: 1.2rem;
}

.brand-copy,
.sidebar-note p,
.status-card span {
  margin: 6px 0 0;
  color: var(--ink-soft);
}

.app-sidebar__nav {
  display: grid;
  gap: 18px;
}

.sidebar-group {
  display: grid;
  gap: 10px;
}

.sidebar-item {
  display: grid;
  gap: 8px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid transparent;
  transition: 180ms ease;
}

.sidebar-link:hover {
  background: rgba(47, 125, 244, 0.05);
  border-color: rgba(47, 125, 244, 0.08);
}

.sidebar-link--active {
  background: linear-gradient(135deg, rgba(47, 125, 244, 0.12), rgba(135, 208, 255, 0.12));
  border-color: rgba(47, 125, 244, 0.16);
}

.sidebar-link__badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(47, 125, 244, 0.08);
  color: var(--copper);
  font-size: 12px;
  font-weight: 800;
}

.sidebar-link--active .sidebar-link__badge {
  background: linear-gradient(145deg, var(--copper), var(--teal));
  color: #ffffff;
}

.sidebar-link strong {
  font-size: 0.98rem;
}

.sidebar-subnav {
  display: grid;
  gap: 6px;
  margin-left: 54px;
}

.sidebar-sub-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 6px 10px;
  border-radius: 12px;
  color: var(--ink-soft);
  transition: 180ms ease;
}

.sidebar-sub-link:hover {
  background: rgba(47, 125, 244, 0.05);
}

.sidebar-sub-link--active {
  background: rgba(47, 125, 244, 0.1);
  color: var(--ink);
}

.sidebar-sub-link__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(47, 125, 244, 0.32);
}

.sidebar-sub-link--active .sidebar-sub-link__dot {
  background: linear-gradient(145deg, var(--copper), var(--teal));
}

.app-sidebar__status {
  margin-top: auto;
  display: grid;
  gap: 14px;
}

.sidebar-note {
  padding: 16px;
  border-radius: 20px;
  background: rgba(235, 243, 255, 0.8);
  border: 1px solid rgba(47, 125, 244, 0.12);
}

.sidebar-note strong {
  display: block;
}

.status-grid {
  display: grid;
  gap: 12px;
}

.status-card {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.86);
}

.status-card strong {
  display: block;
  margin-top: 6px;
  font-size: 1rem;
}

@media (max-width: 1100px) {
  .app-sidebar {
    position: static;
    min-height: 0;
  }
}

@media (max-width: 760px) {
  .status-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .status-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-subnav {
    margin-left: 18px;
  }
}
</style>

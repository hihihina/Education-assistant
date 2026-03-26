<script setup>
import { computed, ref, onMounted } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useEduScopeStore } from "../composables/useEduScopeStore";

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["toggle-collapse"]);

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

function toggleCollapse() {
  emit("toggle-collapse", !props.collapsed);
}

const isDark = ref(false);

function toggleDarkMode() {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("edua-theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("edua-theme", "light");
  }
}

onMounted(() => {
  const saved = localStorage.getItem("edua-theme");
  if (saved === "dark") {
    isDark.value = true;
    document.documentElement.classList.add("dark");
  }
});
</script>

<template>
  <aside class="app-sidebar" :class="{ 'app-sidebar--collapsed': props.collapsed }">
    <button
      class="sidebar-collapse-btn"
      type="button"
      :aria-label="props.collapsed ? '展开侧栏' : '收起侧栏'"
      :title="props.collapsed ? '展开侧栏' : '收起侧栏'"
      @click="toggleCollapse"
    >
      {{ props.collapsed ? ">" : "<" }}
    </button>
    <div class="app-sidebar__inner">
      <div class="app-sidebar__brand">
        <div class="app-sidebar__brand-main">
          <div class="brand-copy-wrap">
            <p class="brand-eyebrow">education assistant</p>
            <h1>edua</h1>
            <p class="brand-copy">成绩分析、智能助手、出题与出卷工作台。</p>
            <button class="dark-mode-btn" type="button" @click="toggleDarkMode" :title="isDark ? '切换至日间模式' : '切换至夜览模式'">
              {{ isDark ? '🌞 日间模式' : '🌙 夜览模式' }}
            </button>
          </div>
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
              :title="props.collapsed ? item.label : ''"
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
                :title="props.collapsed ? child.label : ''"
              >
                <span class="sidebar-sub-link__dot"></span>
                <span class="sidebar-sub-link__label">{{ child.label }}</span>
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
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  position: sticky;
  top: clamp(12px, 1.4vw, 18px);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 36px);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--surface-98), var(--surface-muted-94));
  box-shadow: var(--shadow-md);
  transition: width 180ms ease;
}

.app-sidebar__inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: clamp(16px, 1.5vw, 22px);
  height: 100%;
  overflow-y: auto;
  transition: padding 180ms ease;
}

.app-sidebar__inner::-webkit-scrollbar {
  width: 6px;
}
.app-sidebar__inner::-webkit-scrollbar-thumb {
  background: var(--primary-18);
  border-radius: 4px;
}
.app-sidebar__inner::-webkit-scrollbar-thumb:hover {
  background: var(--primary-28);
}

.app-sidebar__brand {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.app-sidebar__brand-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
  padding-right: 40px;
}

.brand-copy-wrap {
  min-width: 0;
}

.sidebar-collapse-btn {
  position: absolute;
  top: clamp(16px, 1.5vw, 22px);
  right: clamp(16px, 1.5vw, 22px);
  z-index: 10;
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--primary-22);
  background: var(--accent-08);
  color: var(--copper);
  font-weight: 700;
  line-height: 1;
  transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease;
}

.sidebar-collapse-btn:hover {
  background: var(--accent-16);
  border-color: var(--primary-28);
  transform: translateY(-1px);
}

.sidebar-collapse-btn:active {
  transform: translateY(0);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(145deg, var(--copper), var(--teal));
  color: var(--paper-strong);
  font-weight: 800;
  font-size: 0.94rem;
  letter-spacing: 0.05em;
  box-shadow: 0 10px 22px var(--primary-24);
}

.brand-eyebrow,
.sidebar-group__label {
  margin: 0;
  font-size: var(--font-size-eyebrow);
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--copper);
}

.app-sidebar__brand h1 {
  margin: 8px 0 0;
  font-size: clamp(1rem, 1.2rem, 1.2rem);
}

.brand-copy {
  margin: 6px 0 0;
  color: var(--ink-soft);
  font-size: 0.8rem;
  line-height: 1.4;
}

.dark-mode-btn {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--surface-muted-94);
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 180ms ease;
}

.dark-mode-btn:hover {
  background: var(--accent-08);
  border-color: var(--primary-28);
}

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
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: 180ms ease;
}

.sidebar-link:hover {
  background: var(--accent-08);
  border-color: var(--primary-18);
}

.sidebar-link--active {
  background: linear-gradient(130deg, var(--primary-16), var(--accent-16));
  border-color: var(--primary-28);
}

.sidebar-link__badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--primary-12);
  color: var(--copper);
  font-size: var(--font-size-meta);
  font-weight: 800;
}

.sidebar-link--active .sidebar-link__badge {
  background: linear-gradient(145deg, var(--copper), var(--teal));
  color: var(--paper-strong);
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
  border-radius: 8px;
  color: var(--ink-soft);
  transition: 180ms ease;
  white-space: nowrap;
}

.sidebar-sub-link:hover {
  background: var(--accent-08);
}

.sidebar-sub-link--active {
  background: var(--primary-12);
  color: var(--ink);
}

.sidebar-sub-link__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary-34);
}

.sidebar-sub-link__label {
  min-width: 0;
  font-size: 0.9rem;
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
  border-radius: 10px;
  background: var(--surface-96);
  border: 1px solid var(--primary-14);
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
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--surface-96);
}

.status-card strong {
  display: block;
  margin-top: 6px;
  font-size: 1rem;
}

.app-sidebar--collapsed {
  width: min-content;
}

.app-sidebar--collapsed .app-sidebar__inner {
  align-items: center;
  padding: 0px 10px 14px;
  gap: 14px;
}

.app-sidebar--collapsed .app-sidebar__brand {
  width: 100%;
  display: flex;
  justify-content: center;
}

.app-sidebar--collapsed .app-sidebar__brand-main {
  display: none;
}

.app-sidebar--collapsed .brand-copy-wrap,
.app-sidebar--collapsed .dark-mode-btn,
.app-sidebar--collapsed .sidebar-group__label,
.app-sidebar--collapsed .sidebar-sub-link__label,
.app-sidebar--collapsed .app-sidebar__status {
  display: none;
}

.app-sidebar--collapsed .app-sidebar__nav,
.app-sidebar--collapsed .sidebar-group,
.app-sidebar--collapsed .sidebar-item {
  width: 100%;
}

.app-sidebar--collapsed .sidebar-link {
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px;
  border-radius: 10px;
}

.app-sidebar--collapsed .sidebar-link strong {
  font-size: 0.7rem;
  line-height: 1;
  text-align: center;
  font-weight: 500;
  white-space: nowrap;
}

.app-sidebar--collapsed .sidebar-link__badge {
  width: 36px;
  height: 36px;
}

.app-sidebar--collapsed .sidebar-subnav {
  display: none;
}

.app-sidebar--collapsed .sidebar-sub-link {
  justify-content: center;
  width: 36px;
  min-height: 32px;
  padding: 0;
}

.app-sidebar--collapsed .sidebar-sub-link__dot {
  width: 10px;
  height: 10px;
}

.app-sidebar--collapsed .sidebar-collapse-btn {
  position: static;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  align-self: center;
  margin-top: 14px;
}

@media (max-width: 1100px) {
  .app-sidebar {
    position: static;
    height: auto;
    overflow-y: visible;
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

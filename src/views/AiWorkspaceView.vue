<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";

const route = useRoute();
const router = useRouter();
const store = useEduScopeStore();

const apiKey = computed({
  get: () => store.ai.apiKey,
  set: (value) => store.setApiKey(value),
});

const redirectTarget = computed(() => {
  const value = typeof route.query.redirect === "string" ? route.query.redirect : "";
  const allowedPrefixes = [
    "/assistant",
    "/question-studio",
    "/paper-studio",
    "/question-variant",
    "/analysis/class-question",
    "/analysis/grade-overview",
  ];
  return allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`)) ? value : "";
});

const workspaceCards = [
  {
    title: "智能助手模式",
    description: "支持连续文本对话，并可导入 Word(.docx) 与 Excel 表格做分析，适合知识解释、学习规划、成绩复盘和连续追问。",
    to: "/assistant",
    tag: "连续对话",
  },
  {
    title: "智能出题模式",
    description: "选择年级、科目、题型与难度设置，生成难易结合、带详细步骤解析的练习题。",
    to: "/question-studio",
    tag: "智能出题",
  },
  {
    title: "智能出卷模式",
    description: "根据知识点、题型数量与可选参考试卷，生成一份结构完整的试卷。",
    to: "/paper-studio",
    tag: "智能出卷",
  },
  {
    title: "题目变式模式",
    description: "输入一道原题，先提取知识点并支持手动修订，再生成几道同知识结构的变式训练题。",
    to: "/question-variant",
    tag: "题目变式",
  },
];

const usageCards = computed(() => [
  { label: "总 Token", value: store.ai.usage?.total_tokens ?? "--" },
  { label: "Prompt Token", value: store.ai.usage?.prompt_tokens ?? "--" },
  { label: "Completion Token", value: store.ai.usage?.completion_tokens ?? "--" },
]);

function openWorkspace(path) {
  if (!store.ai.apiKey) {
    store.showToast("请先填写 DeepSeek API Key。");
    return;
  }
  router.push(path);
}

function saveAndContinue() {
  if (!store.ai.apiKey) {
    store.showToast("请先填写有效的 DeepSeek API Key。");
    return;
  }
  store.showToast("API Key 已保存到当前会话。");
  router.push(redirectTarget.value || "/assistant");
}

function clearApiKey() {
  store.setApiKey("");
  store.ai.usage = null;
  store.showToast("API Key 已从当前会话中清空。");
}
</script>

<template>
  <section class="ai-workspace">
    <header class="page-intro">
      <div>
        <p class="page-intro__eyebrow">edua ai</p>
        <h2>先完成 edua AI 工作区配置，再切换智能助手、智能出题、智能出卷或题目变式模式</h2>
        <p class="page-intro__lead">
          这里负责 API Key 配置、模式入口和最近调用信息，便于统一管理当前会话中的 AI 能力，也支持成绩分析页中的 AI 智能解读。
        </p>
        <p v-if="redirectTarget" class="page-intro__tip">你刚才尝试进入 AI 子页面，请先完成 API 配置后继续。</p>
      </div>
      <div class="page-intro__actions">
        <button class="page-btn page-btn--ghost" type="button" @click="clearApiKey">清空 Key</button>
        <button class="page-btn page-btn--primary" type="button" @click="saveAndContinue">
          {{ redirectTarget ? "保存并继续" : "保存并进入智能助手" }}
        </button>
      </div>
    </header>

    <div class="ai-workspace__layout">
      <SurfacePanel title="API 配置" eyebrow="当前会话">
        <div class="setup-form">
          <label class="field">
            <span>DeepSeek API Key</span>
            <input v-model="apiKey" type="password" placeholder="sk-..." autocomplete="off" />
          </label>

          <div class="setup-note">
            <strong>{{ store.ai.apiKey ? "已配置，可进入 AI 模式" : "待配置，暂不能调用 AI" }}</strong>
            <p>当前支持文本输入、Word(.docx) 与 Excel 表格解析，不支持图片；Key 仅保存在当前浏览会话中。</p>
          </div>

          <div class="setup-points">
            <article class="setup-point">
              <span>安全策略</span>
              <strong>关闭或刷新页面后，Key 与调用结果不会保留。</strong>
            </article>
            <article class="setup-point">
              <span>使用方式</span>
              <strong>配置完成后，可直接进入智能助手、智能出题、智能出卷或题目变式模式。</strong>
            </article>
          </div>
        </div>
      </SurfacePanel>

      <div class="ai-workspace__side">
        <SurfacePanel title="模式入口" eyebrow="选择模式" compact>
          <div class="workspace-card-list">
            <button
              v-for="workspace in workspaceCards"
              :key="workspace.to"
              class="workspace-card"
              type="button"
              @click="openWorkspace(workspace.to)"
            >
              <span class="workspace-card__tag">{{ workspace.tag }}</span>
              <strong>{{ workspace.title }}</strong>
              <p>{{ workspace.description }}</p>
              <span class="workspace-card__action">进入模式</span>
            </button>
          </div>
        </SurfacePanel>

        <SurfacePanel title="最近调用" eyebrow="调用统计" compact>
          <div class="usage-grid">
            <article v-for="item in usageCards" :key="item.label" class="usage-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
        </SurfacePanel>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-workspace {
  display: grid;
  gap: 22px;
  align-content: start;
}

.page-intro,
.ai-workspace__layout {
  display: grid;
  gap: 20px;
}

.page-intro {
  grid-template-columns: minmax(0, 1.45fr) auto;
  align-items: start;
  padding: clamp(24px, 3vw, 34px);
  border: 1px solid var(--line);
  border-radius: 32px;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.98), rgba(235, 244, 255, 0.92));
  box-shadow: var(--shadow-md);
}

.page-intro__eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--copper);
}

.page-intro h2 {
  margin: 12px 0 0;
  font-size: clamp(2rem, 3vw, 3.2rem);
  line-height: 1.12;
}

.page-intro__lead,
.page-intro__tip,
.field span,
.setup-note p,
.setup-point span,
.workspace-card p,
.usage-card span {
  color: var(--ink-soft);
}

.page-intro__lead,
.page-intro__tip {
  margin: 14px 0 0;
}

.page-intro__tip {
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(47, 125, 244, 0.08);
  display: inline-flex;
}

.page-intro__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.page-btn,
.workspace-card {
  transition: 180ms ease;
}

.page-btn {
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

.page-btn--primary {
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: #ffffff;
  box-shadow: 0 18px 34px rgba(47, 125, 244, 0.22);
}

.page-btn--ghost {
  background: rgba(47, 125, 244, 0.08);
  color: var(--ink);
}

.ai-workspace__layout {
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 400px);
  align-items: start;
}

.setup-form,
.setup-points,
.workspace-card-list,
.usage-grid {
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 10px;
}

.field input {
  width: 100%;
  padding: 15px 16px;
  border-radius: 16px;
}

.setup-note,
.setup-point,
.usage-card {
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(248, 251, 255, 0.92);
}

.setup-note strong,
.setup-point strong,
.workspace-card strong,
.usage-card strong {
  display: block;
}

.setup-note p,
.usage-card strong {
  margin-top: 8px;
}

.workspace-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  text-align: left;
}

.workspace-card:hover {
  transform: translateY(-1px);
  border-color: rgba(47, 125, 244, 0.18);
}

.workspace-card__tag,
.workspace-card__action {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--copper);
}

.workspace-card__action {
  margin-top: 4px;
}

@media (max-width: 1080px) {
  .page-intro,
  .ai-workspace__layout {
    grid-template-columns: 1fr;
  }

  .page-intro__actions {
    justify-content: flex-start;
  }
}
</style>

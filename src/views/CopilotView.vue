<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { requestCopilotAnswer } from "../utils/deepseek";
import { renderMarkdown } from "../utils/markdown";
import { extractSpreadsheetText } from "../utils/spreadsheet";
import { extractWordText } from "../utils/word";

const router = useRouter();
const store = useEduScopeStore();
const input = ref("");
const chatFeedRef = ref(null);
const attachmentInputRef = ref(null);
const attachedFile = ref(null);
const attachmentLoading = ref(false);

const suggestionPrompts = [
  "帮我解释“二次函数顶点式”和一般式之间的关系",
  "根据这次考试表现，给我一个一周复盘计划",
  "我想提高英语阅读速度，先帮我拆一下训练方法",
  "请用初中生能理解的方式解释牛顿第一定律",
];

const isBusy = computed(() => store.ai.copilot.requestInFlight);
const messages = computed(() => store.ai.copilot.messages);
const usageCards = computed(() => [
  { label: "总 Token", value: store.ai.usage?.total_tokens ?? "--" },
  { label: "Prompt Token", value: store.ai.usage?.prompt_tokens ?? "--" },
  { label: "Completion Token", value: store.ai.usage?.completion_tokens ?? "--" },
]);

watch(
  messages,
  async () => {
    await nextTick();
    if (chatFeedRef.value) {
      chatFeedRef.value.scrollTop = chatFeedRef.value.scrollHeight;
    }
  },
  { deep: true }
);

async function sendMessage(promptText) {
  const content = (promptText ?? input.value).trim();
  if (!store.ai.apiKey) {
    store.showToast("请先到 AI 工作区填写 DeepSeek API Key。");
    router.push("/ai");
    return;
  }
  if ((!content && !attachedFile.value) || isBusy.value) return;

  const displayContent = content || `请分析我上传的${attachedFile.value.kindLabel}《${attachedFile.value.fileName}》`;
  const requestContent = attachedFile.value
    ? `${content || `请分析我上传的${attachedFile.value.kindLabel}《${attachedFile.value.fileName}》`}\n\n以下是用户上传的${
        attachedFile.value.kindLabel
      }《${attachedFile.value.fileName}》提取出的内容，请结合文件内容回答：\n${attachedFile.value.text}`
    : displayContent;
  const attachmentMeta = attachedFile.value
    ? {
        fileName: attachedFile.value.fileName,
        rawLength: attachedFile.value.rawLength,
        truncated: attachedFile.value.truncated,
        kindLabel: attachedFile.value.kindLabel,
      }
    : null;

  store.ai.copilot.requestInFlight = true;
  store.ai.copilot.status = "请求中";
  store.ai.copilot.messages.push({
    role: "user",
    content: displayContent,
    requestContent,
    attachment: attachmentMeta,
  });
  input.value = "";
  attachedFile.value = null;

  try {
    const response = await requestCopilotAnswer({
      apiKey: store.ai.apiKey,
      messages: store.ai.copilot.messages.map((message) => ({
        role: message.role,
        content: message.requestContent || message.content,
      })),
    });
    const answer = response.choices?.[0]?.message?.content || "接口未返回有效内容。";
    store.ai.usage = response.usage || null;
    store.ai.copilot.messages.push({ role: "assistant", content: answer });
    store.ai.copilot.status = "调用成功";
  } catch (error) {
    store.ai.copilot.status = "调用失败";
    store.showToast(`智能助手调用失败：${error.message || "请检查网络或 API Key。"}`);
  } finally {
    store.ai.copilot.requestInFlight = false;
  }
}

function applySuggestion(prompt) {
  input.value = prompt;
}

function clearConversation() {
  store.resetCopilot();
  attachedFile.value = null;
  store.showToast("智能助手会话已清空。");
}

function goToAiWorkspace() {
  router.push("/ai");
}

function formatMessageContent(content) {
  return renderMarkdown(content);
}

function triggerAttachmentSelect() {
  attachmentInputRef.value?.click();
}

async function handleAttachmentChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  attachmentLoading.value = true;
  try {
    const parsed = await parseAttachmentFile(file);
    attachedFile.value = parsed;
    store.showToast(`已导入${parsed.kindLabel}：${parsed.fileName}`);
  } catch (error) {
    attachedFile.value = null;
    store.showToast(error.message || "附件读取失败");
  } finally {
    attachmentLoading.value = false;
    event.target.value = "";
  }
}

function clearAttachment() {
  attachedFile.value = null;
}

async function parseAttachmentFile(file) {
  const lowerName = String(file.name || "").toLowerCase();

  if (lowerName.endsWith(".docx")) {
    const parsed = await extractWordText(file);
    return {
      ...parsed,
      kind: "word",
      kindLabel: "Word(.docx) 文档",
    };
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
    const parsed = await extractSpreadsheetText(file);
    return {
      ...parsed,
      kind: "excel",
      kindLabel: "Excel 表格",
    };
  }

  throw new Error("当前仅支持 Word(.docx) 与 Excel(.xlsx/.xls/.csv) 附件。");
}
</script>

<template>
  <section class="copilot-page">
    <header class="page-head">
      <div>
        <p class="page-head__eyebrow">智能助手</p>
        <h2>以连续对话的方式完成知识问答和学习辅导</h2>
        <p class="page-head__lead">
          适合做知识点解释、学习规划、成绩复盘、文档梳理和表格解读。当前支持文本输入、Word(.docx) 与 Excel 附件导入分析，不支持图片。
        </p>
      </div>
      <div class="page-head__actions">
        <button class="page-btn page-btn--ghost" type="button" @click="goToAiWorkspace">AI 配置</button>
        <button class="page-btn page-btn--primary" type="button" @click="clearConversation">清空对话</button>
      </div>
    </header>

    <div class="copilot-layout">
      <SurfacePanel title="智能助手对话" eyebrow="对话分析">
        <template #header>
          <span class="status-pill">{{ store.ai.copilot.status }}</span>
        </template>

        <div ref="chatFeedRef" class="chat-feed">
          <div v-if="!messages.length" class="chat-empty">
            <h3>从一个问题开始</h3>
            <p>你可以问学习问题、知识点、复习计划、错题整理思路，或者继续追问上一轮回答。</p>
          </div>

          <article
            v-for="(message, index) in messages"
            :key="`${message.role}-${index}`"
            class="chat-message"
            :class="`chat-message--${message.role}`"
          >
            <span class="chat-message__role">{{ message.role === "user" ? "你" : "智能助手" }}</span>
            <div v-if="message.attachment" class="chat-message__attachment">
              <strong>{{ message.attachment.kindLabel }}</strong>
              <span>{{ message.attachment.fileName }}</span>
              <small>
                {{ message.attachment.rawLength }} 字{{ message.attachment.truncated ? " · 已截断后发送" : "" }}
              </small>
            </div>
            <div class="chat-message__body markdown-body" v-html="formatMessageContent(message.content)"></div>
          </article>
        </div>

        <div class="chat-composer">
          <input
            ref="attachmentInputRef"
            accept=".docx,.xlsx,.xls,.csv"
            hidden
            type="file"
            @change="handleAttachmentChange"
          />
          <div v-if="attachedFile" class="chat-attachment-card">
            <div>
              <strong>{{ attachedFile.fileName }}</strong>
              <p>
                {{ attachedFile.kindLabel }}，已提取 {{ attachedFile.rawLength }} 字{{
                  attachedFile.truncated ? "，发送时会按上限截断" : ""
                }}
              </p>
            </div>
            <button class="page-btn page-btn--ghost" type="button" @click="clearAttachment">移除附件</button>
          </div>
          <textarea
            v-model="input"
            rows="5"
            placeholder="输入你的问题，或上传 Word / Excel 文件后让智能助手结合内容分析。当前不支持图片。"
            @keydown.ctrl.enter.prevent="sendMessage()"
          ></textarea>
          <div class="chat-composer__actions">
            <div class="chat-composer__meta">
              <span>按 Ctrl + Enter 发送</span>
              <button class="page-btn page-btn--ghost" type="button" :disabled="attachmentLoading" @click="triggerAttachmentSelect">
                {{ attachmentLoading ? "导入中..." : "导入 Word / Excel" }}
              </button>
            </div>
            <button class="send-btn" type="button" :disabled="isBusy || attachmentLoading" @click="sendMessage()">
              {{ isBusy ? "生成中..." : "发送" }}
            </button>
          </div>
        </div>
      </SurfacePanel>

      <div class="copilot-side">
        <SurfacePanel title="快捷问题" eyebrow="快捷开始" compact>
          <div class="suggestion-list">
            <button
              v-for="prompt in suggestionPrompts"
              :key="prompt"
              class="suggestion-card"
              type="button"
              @click="applySuggestion(prompt)"
            >
              {{ prompt }}
            </button>
          </div>
        </SurfacePanel>

        <SurfacePanel title="当前会话" eyebrow="调用统计" compact>
          <div class="usage-grid">
            <article v-for="item in usageCards" :key="item.label" class="usage-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
          <div class="side-note">当前页面专注连续对话使用，API Key 配置入口位于 AI 工作区。</div>
        </SurfacePanel>
      </div>
    </div>
  </section>
</template>

<style scoped>
.copilot-page {
  display: grid;
  gap: 22px;
  align-content: start;
}

.page-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
}

.page-head__eyebrow,
.chat-message__role {
  margin: 0;
  font-size: var(--font-size-meta);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--copper);
}

.page-head h2 {
  margin: 12px 0 0;
  font-size: clamp(1.9rem, 3vw, 3rem);
  line-height: 1.12;
}

.page-head__lead,
.chat-empty p,
.chat-composer__actions span,
.usage-card span,
.side-note {
  color: var(--ink-soft);
}

.page-head__lead {
  margin: 14px 0 0;
}

.page-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.page-btn,
.send-btn,
.suggestion-card {
  transition: 180ms ease;
}

.page-btn,
.send-btn {
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  font-weight: 700;
}

.page-btn--primary,
.send-btn {
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: var(--paper-strong);
}

.page-btn--ghost {
  background: var(--ghost-bg);
}

.copilot-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 400px);
  gap: 20px;
  align-items: start;
}

.copilot-side,
.suggestion-list,
.usage-grid {
  display: grid;
  gap: 16px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--ghost-bg);
  color: var(--copper);
  font-weight: 700;
}

.chat-feed {
  display: grid;
  gap: 14px;
  min-height: clamp(380px, 56vh, 680px);
  max-height: clamp(420px, 62vh, 760px);
  overflow: auto;
  padding-right: 4px;
}

.chat-empty {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 26px;
  text-align: center;
}

.chat-empty h3 {
  margin: 0 0 10px;
}

.chat-message {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--line);
  background: var(--surface-muted-96);
}

.chat-message--assistant {
  justify-self: start;
  width: min(100%, 1100px);
  max-width: 96%;
}

.chat-message--user {
  justify-self: end;
  max-width: min(920px, 88%);
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: var(--paper-strong);
  border-color: transparent;
}

.chat-message--user .chat-message__role {
  color: var(--surface-82);
}

.chat-message__body {
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.chat-message__body :deep(*:first-child) {
  margin-top: 0;
}

.chat-message__body :deep(*:last-child) {
  margin-bottom: 0;
}

.chat-message__body :deep(p),
.chat-message__body :deep(ul),
.chat-message__body :deep(ol),
.chat-message__body :deep(blockquote),
.chat-message__body :deep(pre),
.chat-message__body :deep(table) {
  margin: 0 0 14px;
}

.chat-message__body :deep(h1),
.chat-message__body :deep(h2),
.chat-message__body :deep(h3),
.chat-message__body :deep(h4) {
  margin: 18px 0 10px;
  line-height: 1.4;
}

.chat-message__body :deep(ul),
.chat-message__body :deep(ol) {
  padding-left: 20px;
}

.chat-message__body :deep(li + li) {
  margin-top: 6px;
}

.chat-message__body :deep(blockquote) {
  padding: 10px 14px;
  border-left: 3px solid var(--primary-28);
  background: var(--primary-04);
  border-radius: 0 12px 12px 0;
}

.chat-message__body :deep(code) {
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--primary-08);
  font-size: 0.92em;
}

.chat-message__body :deep(pre) {
  overflow: auto;
  padding: 14px;
  border-radius: 14px;
  background: var(--primary-06);
}

.chat-message__body :deep(pre code) {
  padding: 0;
  background: transparent;
}

.chat-message__body :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  border-radius: 14px;
  border: 1px solid var(--line);
}

.chat-message__body :deep(th),
.chat-message__body :deep(td) {
  padding: 10px 12px;
  border-bottom: 1px solid var(--table-line);
  text-align: left;
  vertical-align: top;
}

.chat-message__body :deep(th) {
  background: var(--primary-06);
}

.chat-message__body :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--primary-30);
  text-underline-offset: 3px;
}

.chat-message--user .chat-message__body :deep(blockquote) {
  border-left-color: var(--surface-26);
  background: var(--surface-12);
}

.chat-message--user .chat-message__body :deep(code) {
  background: var(--surface-16);
}

.chat-message--user .chat-message__body :deep(pre) {
  background: var(--surface-14);
}

.chat-message--user .chat-message__body :deep(table) {
  border-color: var(--surface-18);
}

.chat-message--user .chat-message__body :deep(th) {
  background: var(--surface-14);
}

.chat-message--user .chat-message__body :deep(th),
.chat-message--user .chat-message__body :deep(td) {
  border-bottom-color: var(--surface-14);
}

.chat-composer {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.chat-composer textarea {
  width: 100%;
  min-height: 138px;
  padding: 15px 16px;
  border-radius: 18px;
}

.chat-composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.chat-composer__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.suggestion-card,
.usage-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--surface-92);
}

.suggestion-card {
  text-align: left;
}

.suggestion-card:hover {
  transform: translateY(-1px);
  border-color: var(--primary-18);
}

.usage-card strong {
  display: block;
  margin-top: 8px;
  font-size: 1.2rem;
}

.side-note {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--primary-06);
  line-height: 1.6;
}

.chat-attachment-card,
.chat-message__attachment {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--primary-05);
}

.chat-attachment-card {
  margin-bottom: 14px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.chat-attachment-card p,
.chat-message__attachment span,
.chat-message__attachment small {
  margin: 0;
  color: var(--ink-soft);
}

.chat-message__attachment {
  margin-bottom: 14px;
}

.suggestion-card,
.usage-card,
.chat-attachment-card,
.chat-message__attachment,
.chat-message--assistant {
  border-color: var(--card-border);
  background: linear-gradient(162deg, var(--surface-98), var(--surface-muted-92) 58%, var(--surface-96));
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
}

.suggestion-card,
.usage-card,
.chat-attachment-card {
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

.suggestion-card:hover,
.usage-card:hover,
.chat-attachment-card:hover {
  transform: translateY(-2px);
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
}

@media (max-width: 1080px) {
  .page-head,
  .copilot-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .chat-composer__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .chat-attachment-card {
    grid-template-columns: 1fr;
  }

  .chat-composer__meta {
    justify-content: space-between;
  }

  .send-btn {
    width: 100%;
  }
}
</style>

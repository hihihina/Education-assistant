<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";
import { renderMarkdown } from "../utils/markdown";

const props = defineProps({
  content: {
    type: String,
    default: "",
  },
});

const contentRef = ref(null);

watch(
  () => props.content,
  async () => {
    await renderContent();
  }
);

onMounted(async () => {
  await renderContent();
});

async function renderContent() {
  await nextTick();
  if (!contentRef.value) return;

  const source = String(props.content || "").trim();
  contentRef.value.innerHTML = source ? renderMarkdown(source) : "";

  if (!source) return;

  renderMathInElement(contentRef.value, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
    strict: false,
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  });
}
</script>

<template>
  <div ref="contentRef" class="rich-content markdown-body"></div>
</template>

<style scoped>
.rich-content {
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.rich-content :deep(*:first-child) {
  margin-top: 0;
}

.rich-content :deep(*:last-child) {
  margin-bottom: 0;
}

.rich-content :deep(p),
.rich-content :deep(ul),
.rich-content :deep(ol),
.rich-content :deep(blockquote),
.rich-content :deep(pre),
.rich-content :deep(table) {
  margin: 0 0 14px;
}

.rich-content :deep(h1),
.rich-content :deep(h2),
.rich-content :deep(h3),
.rich-content :deep(h4) {
  margin: 18px 0 10px;
  line-height: 1.45;
}

.rich-content :deep(ul),
.rich-content :deep(ol) {
  padding-left: 20px;
}

.rich-content :deep(li + li) {
  margin-top: 6px;
}

.rich-content :deep(blockquote) {
  padding: 10px 14px;
  border-left: 3px solid var(--primary-24);
  background: var(--primary-05);
  border-radius: 0 12px 12px 0;
}

.rich-content :deep(code) {
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--primary-08);
  font-size: 0.92em;
}

.rich-content :deep(pre) {
  overflow: auto;
  padding: 14px;
  border-radius: 14px;
  background: var(--primary-06);
}

.rich-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.rich-content :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  border-radius: 14px;
  border: 1px solid var(--line);
}

.rich-content :deep(th),
.rich-content :deep(td) {
  padding: 10px 12px;
  border-bottom: 1px solid var(--table-line);
  text-align: left;
  vertical-align: top;
}

.rich-content :deep(th) {
  background: var(--primary-06);
}

.rich-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--primary-30);
  text-underline-offset: 3px;
}

.rich-content :deep(.katex-display) {
  margin: 14px 0;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>

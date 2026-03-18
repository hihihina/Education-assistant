<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

const props = defineProps({
  content: {
    type: String,
    default: "",
  },
  emptyText: {
    type: String,
    default: "输入内容后，这里会显示 LaTeX 预览。",
  },
});

const previewRef = ref(null);

watch(
  () => props.content,
  async () => {
    await renderPreview();
  }
);

onMounted(async () => {
  await renderPreview();
});

async function renderPreview() {
  await nextTick();
  if (!previewRef.value || !props.content) return;

  previewRef.value.textContent = props.content;
  renderMathInElement(previewRef.value, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
    strict: false,
  });
}
</script>

<template>
  <div v-if="content" ref="previewRef" class="latex-preview"></div>
  <div v-else class="latex-preview latex-preview--empty">{{ emptyText }}</div>
</template>

<style scoped>
.latex-preview {
  min-height: 120px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  line-height: 1.85;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.latex-preview--empty {
  display: grid;
  place-items: center;
  color: var(--ink-soft);
  background: rgba(249, 250, 251, 0.92);
  text-align: center;
}

.latex-preview :deep(.katex-display) {
  margin: 12px 0;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>

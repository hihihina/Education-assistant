<script setup>
import { ref } from "vue";
import SurfacePanel from "./SurfacePanel.vue";

defineProps({
  eyebrow: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  requirements: {
    type: Array,
    default: () => [],
  },
  uploading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["import-file"]);
const fileInput = ref(null);
const isDragging = ref(false);

function triggerSelect() {
  fileInput.value?.click();
}

function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (file) {
    emit("import-file", file);
  }
  event.target.value = "";
}

function handleDrop(event) {
  event.preventDefault();
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    emit("import-file", file);
  }
}
</script>

<template>
  <section class="analysis-starter">
    <header class="analysis-starter__hero">
      <div class="analysis-starter__copy">
        <p class="analysis-starter__eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <div class="analysis-starter__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="analysis-starter__layout">
      <SurfacePanel title="上传数据" eyebrow="Upload">
        <div
          class="upload-stage"
          :class="{ 'upload-stage--dragging': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop="handleDrop"
          @click="triggerSelect"
        >
          <input ref="fileInput" type="file" accept=".xls,.xlsx" hidden @change="handleFileChange" />
          <span class="upload-stage__badge">.xls / .xlsx</span>
          <strong>{{ uploading ? "正在解析，请稍候..." : "拖拽文件到这里，或点击选择上传" }}</strong>
          <p>仅处理单个有效 Sheet，不支持手工映射或兜底修正。</p>
        </div>
      </SurfacePanel>

      <SurfacePanel title="数据要求" eyebrow="Requirements">
        <div class="requirement-list">
          <article v-for="item in requirements" :key="item.label" class="requirement-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
      </SurfacePanel>
    </div>
  </section>
</template>

<style scoped>
.analysis-starter {
  display: grid;
  gap: 22px;
  align-content: start;
  grid-auto-rows: max-content;
}

.analysis-starter__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
}

.analysis-starter__copy {
  min-width: 0;
}

.analysis-starter__eyebrow {
  margin: 0;
  color: var(--copper);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: var(--font-size-meta);
  font-weight: 700;
}

.analysis-starter h2 {
  margin: 12px 0 0;
  font-size: clamp(2rem, 3vw, 3.2rem);
  line-height: 1.08;
}

.analysis-starter p {
  margin: 12px 0 0;
  color: var(--ink-soft);
}

.analysis-starter__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.analysis-starter__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 20px;
  align-items: start;
}

.upload-stage {
  display: grid;
  place-items: center;
  min-height: clamp(220px, 28vh, 320px);
  padding: clamp(24px, 2vw, 32px);
  border-radius: 24px;
  border: 1.5px dashed var(--line-strong);
  background:
    linear-gradient(145deg, var(--surface-96), var(--surface-muted-94)),
    radial-gradient(circle at top, var(--accent-16), transparent 42%);
  text-align: center;
  transition: 180ms ease;
}

.upload-stage--dragging {
  border-color: var(--copper);
  transform: translateY(-1px);
}

.upload-stage__badge {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--primary-08);
  color: var(--ink-soft);
}

.upload-stage strong {
  margin-top: 18px;
  font-size: clamp(1.3rem, 2vw, 2rem);
}

.requirement-list {
  display: grid;
  gap: 12px;
}

.requirement-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface-muted-92);
}

.requirement-item span {
  color: var(--ink-soft);
}

@media (max-width: 1080px) {
  .analysis-starter__hero,
  .analysis-starter__layout {
    grid-template-columns: 1fr;
  }
}
</style>

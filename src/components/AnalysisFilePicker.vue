<script setup>
import { ref } from "vue";
import SurfacePanel from "./SurfacePanel.vue";

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  eyebrow: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  hint: {
    type: String,
    default: "",
  },
  fileNames: {
    type: Array,
    default: () => [],
  },
  accept: {
    type: String,
    default: ".xls,.xlsx",
  },
  multiple: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["select"]);
const inputRef = ref(null);
const isDragging = ref(false);

function openPicker() {
  inputRef.value?.click();
}

function handleChange(event) {
  const files = Array.from(event.target.files || []);
  if (files.length) emit("select", files);
  event.target.value = "";
}

function handleDrop(event) {
  event.preventDefault();
  isDragging.value = false;
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length) emit("select", files);
}
</script>

<template>
  <SurfacePanel :title="title" :eyebrow="eyebrow">
    <div class="picker-card">
      <button
        class="picker-dropzone"
        :class="{ 'picker-dropzone--dragging': isDragging }"
        type="button"
        @click="openPicker"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop="handleDrop"
      >
        <input ref="inputRef" :accept="accept" :multiple="multiple" hidden type="file" @change="handleChange" />
        <span class="picker-dropzone__badge">{{ multiple ? "multiple files" : ".xls / .xlsx" }}</span>
        <strong>{{ multiple ? "拖拽多个文件到这里，或点击选择" : "拖拽文件到这里，或点击选择上传" }}</strong>
        <p>{{ description }}</p>
      </button>

      <p v-if="hint" class="picker-hint">{{ hint }}</p>

      <div v-if="props.fileNames.length" class="picker-files">
        <span v-for="name in props.fileNames" :key="name" class="picker-file">{{ name }}</span>
      </div>
    </div>
  </SurfacePanel>
</template>

<style scoped>
.picker-card {
  display: grid;
  gap: 14px;
}

.picker-dropzone {
  display: grid;
  place-items: center;
  gap: 10px;
  width: 100%;
  min-height: 220px;
  padding: 26px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 24px;
  background:
    linear-gradient(145deg, var(--surface-96), var(--surface-muted-94)),
    radial-gradient(circle at top, var(--accent-16), transparent 42%);
  text-align: center;
  transition: 180ms ease;
}

.picker-dropzone--dragging {
  border-color: var(--copper);
  transform: translateY(-1px);
}

.picker-dropzone__badge,
.picker-file {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--primary-08);
  color: var(--ink-soft);
}

.picker-dropzone strong {
  font-size: clamp(1.15rem, 1.2vw + 0.9rem, 1.7rem);
}

.picker-dropzone p,
.picker-hint {
  margin: 0;
  color: var(--ink-soft);
  line-height: 1.65;
}

.picker-files {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>

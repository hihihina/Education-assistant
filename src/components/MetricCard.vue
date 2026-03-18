<script setup>
const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    required: true,
  },
  hint: {
    type: String,
    default: "",
  },
  progress: {
    type: Number,
    default: null,
  },
});

const normalizedProgress = Math.max(0, Math.min(100, Number(props.progress ?? 0)));
</script>

<template>
  <article class="metric-card">
    <span class="metric-card__label">{{ label }}</span>
    <strong class="metric-card__value">{{ value }}</strong>
    <p v-if="hint" class="metric-card__hint">{{ hint }}</p>
    <div v-if="progress !== null" class="metric-card__track">
      <div class="metric-card__bar" :style="{ width: `${normalizedProgress}%` }"></div>
    </div>
  </article>
</template>

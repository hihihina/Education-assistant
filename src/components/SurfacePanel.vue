<script setup>
defineProps({
  title: {
    type: String,
    default: "",
  },
  eyebrow: {
    type: String,
    default: "",
  },
  compact: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <section class="surface-panel" :class="{ 'surface-panel--compact': compact }">
    <header v-if="title || eyebrow || $slots.header" class="surface-panel__header">
      <div>
        <p v-if="eyebrow" class="surface-panel__eyebrow">{{ eyebrow }}</p>
        <h2 v-if="title" class="surface-panel__title">{{ title }}</h2>
      </div>
      <slot name="header" />
    </header>
    <div class="surface-panel__body">
      <slot />
    </div>
  </section>
</template>

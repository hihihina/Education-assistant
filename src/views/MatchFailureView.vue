<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import SurfacePanel from "../components/SurfacePanel.vue";
import { useEduScopeStore } from "../composables/useEduScopeStore";

const store = useEduScopeStore();
const reasons = computed(() => store.failure?.reasons || []);
const retryPath = computed(() => (store.failure?.mode === "gradeOverview" ? "/analysis/grade-overview" : "/analysis/class-question"));
const retryLabel = computed(() => (store.failure?.mode === "gradeOverview" ? "返回年级情况分析页" : "返回班级小题分析页"));
</script>

<template>
  <section class="failure-view">
    <SurfacePanel title="数据匹配失败" eyebrow="Matching Failed">
      <div class="failure-copy">
        <p>
          当前上传数据没有满足固定匹配规则。系统不会提供手工兜底映射，请根据失败原因调整 Excel
          后重新上传。
        </p>
      </div>

      <div v-if="reasons.length" class="failure-list">
        <article v-for="(reason, index) in reasons" :key="index" class="failure-item">
          <strong>原因 {{ index + 1 }}</strong>
          <p>{{ reason }}</p>
        </article>
      </div>

      <div class="failure-actions">
        <RouterLink class="failure-btn failure-btn--primary" :to="retryPath">{{ retryLabel }}</RouterLink>
        <RouterLink class="failure-btn failure-btn--ghost" to="/">回到总览</RouterLink>
      </div>
    </SurfacePanel>
  </section>
</template>

<style scoped>
.failure-view {
  max-width: 920px;
  margin: 10vh auto 0;
}

.failure-copy p,
.failure-item p {
  margin: 0;
  color: var(--ink-soft);
}

.failure-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.failure-item {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(190, 78, 63, 0.16);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--card-shadow), inset 0 1px 0 var(--surface-90);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

.failure-item:hover {
  transform: translateY(-2px);
  border-color: rgba(190, 78, 63, 0.24);
  box-shadow: var(--card-shadow-hover), inset 0 1px 0 var(--surface-90);
}

.failure-item strong {
  display: block;
  margin-bottom: 6px;
  color: var(--danger);
}

.failure-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.failure-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-radius: 999px;
  font-weight: 700;
}

.failure-btn--primary {
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: var(--paper-strong);
}

.failure-btn--ghost {
  border: 1px solid var(--line-strong);
  background: var(--surface-92);
}
</style>

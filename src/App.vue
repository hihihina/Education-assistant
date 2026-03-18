<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import { RouterView, useRoute } from "vue-router";
import AppSidebar from "./components/AppSidebar.vue";
import { useEduScopeStore } from "./composables/useEduScopeStore";

const route = useRoute();
const store = useEduScopeStore();

const isImmersive = computed(() => route.name === "analysis-class-question" || route.name === "analysis-grade-overview");
const activityEvents = ["click", "keydown", "mousemove", "touchstart", "scroll"];

function refreshSession() {
  store.touchSession();
}

onMounted(() => {
  store.startSessionTimer();
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, refreshSession, { passive: true });
  });
});

onUnmounted(() => {
  activityEvents.forEach((eventName) => {
    window.removeEventListener(eventName, refreshSession);
  });
});
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div class="app-shell__main">
      <main class="app-shell__content" :class="{ 'app-shell__content--immersive': isImmersive }">
        <RouterView />
      </main>
    </div>

    <transition name="toast-fade">
      <div v-if="store.ui.toast.visible" class="toast-pill">
        {{ store.ui.toast.message }}
      </div>
    </transition>
  </div>
</template>

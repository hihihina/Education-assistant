<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterView, useRoute } from "vue-router";
import AppSidebar from "./components/AppSidebar.vue";
import { useEduScopeStore } from "./composables/useEduScopeStore";

const route = useRoute();
const store = useEduScopeStore();
const sidebarCollapsed = ref(false);
const fluidRouteNames = new Set([
  "home",
  "ai-workspace",
  "assistant",
  "question-studio",
  "question-studio-result",
  "paper-studio",
  "paper-studio-result",
  "question-variant",
  "question-variant-result",
  "analysis",
  "analysis-class-question",
  "analysis-grade-overview",
  "analysis-failure",
]);

const isImmersive = computed(
  () =>
    route.name === "analysis-class-question" ||
    route.name === "analysis-grade-overview"
);
const isAuthPage = computed(() => route.name === "login");
const activityEvents = [
  "click",
  "keydown",
  "mousemove",
  "touchstart",
  "scroll",
];

function refreshSession() {
  store.touchSession();
}

function updateSidebarCollapsed(nextValue) {
  sidebarCollapsed.value = Boolean(nextValue);
  window.localStorage.setItem(
    "edua.sidebarCollapsed",
    sidebarCollapsed.value ? "1" : "0"
  );
}

onMounted(async () => {
  await store.initAuth();
  const cachedState = window.localStorage.getItem("edua.sidebarCollapsed");
  if (cachedState === "1" || cachedState === "0") {
    sidebarCollapsed.value = cachedState === "1";
  }

  document.documentElement.removeAttribute("data-theme");
  window.localStorage.removeItem("edua.devTheme");

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
  <div
    class="app-shell"
    :class="{
      'app-shell--collapsed': sidebarCollapsed,
      'app-shell--fluid': isFluidContent,
    }"
  >
    <AppSidebar
      v-if="!isAuthPage"
      :collapsed="sidebarCollapsed"
      @toggle-collapse="updateSidebarCollapsed"
    />
    <div class="app-shell__main">
      <main
        class="app-shell__content"
        :class="{
          'app-shell__content--immersive': isImmersive,
          'app-shell__content--auth': isAuthPage,
          'app-shell__content--fluid': isFluidContent,
        }"
      >
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

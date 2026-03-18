import { createRouter, createWebHistory } from "vue-router";
import { useEduScopeStore } from "../composables/useEduScopeStore";

const HomeView = () => import("../views/HomeView.vue");
const AiWorkspaceView = () => import("../views/AiWorkspaceView.vue");
const CopilotView = () => import("../views/CopilotView.vue");
const QuestionStudioView = () => import("../views/QuestionStudioView.vue");
const PaperStudioView = () => import("../views/PaperStudioView.vue");
const SimilarQuestionView = () => import("../views/SimilarQuestionView.vue");
const AnalysisImportView = () => import("../views/AnalysisImportView.vue");
const ClassQuestionAnalysisView = () => import("../views/ClassQuestionAnalysisView.vue");
const GradeOverviewAnalysisView = () => import("../views/GradeOverviewAnalysisView.vue");
const MatchFailureView = () => import("../views/MatchFailureView.vue");

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
    meta: { title: "总览" },
  },
  {
    path: "/ai",
    name: "ai-workspace",
    component: AiWorkspaceView,
    meta: { title: "AI 工作区" },
  },
  {
    path: "/assistant",
    name: "assistant",
    component: CopilotView,
    meta: { title: "智能助手", requiresApiKey: true },
  },
  {
    path: "/question-studio",
    name: "question-studio",
    component: QuestionStudioView,
    meta: { title: "智能出题", requiresApiKey: true },
  },
  {
    path: "/question-studio/result",
    name: "question-studio-result",
    component: QuestionStudioView,
    meta: { title: "智能出题结果", requiresApiKey: true },
  },
  {
    path: "/paper-studio",
    name: "paper-studio",
    component: PaperStudioView,
    meta: { title: "智能出卷", requiresApiKey: true },
  },
  {
    path: "/paper-studio/result",
    name: "paper-studio-result",
    component: PaperStudioView,
    meta: { title: "智能出卷结果", requiresApiKey: true },
  },
  {
    path: "/question-variant",
    name: "question-variant",
    component: SimilarQuestionView,
    meta: { title: "题目变式", requiresApiKey: true },
  },
  {
    path: "/question-variant/result",
    name: "question-variant-result",
    component: SimilarQuestionView,
    meta: { title: "题目变式结果", requiresApiKey: true },
  },
  {
    path: "/analysis",
    name: "analysis",
    component: AnalysisImportView,
    meta: { title: "成绩分析" },
  },
  {
    path: "/analysis/class-question",
    name: "analysis-class-question",
    component: ClassQuestionAnalysisView,
    meta: { title: "班级小题分析" },
  },
  {
    path: "/analysis/grade-overview",
    name: "analysis-grade-overview",
    component: GradeOverviewAnalysisView,
    meta: { title: "年级情况分析" },
  },
  {
    path: "/analysis/student",
    redirect: "/analysis",
  },
  {
    path: "/analysis/subject",
    redirect: "/analysis",
  },
  {
    path: "/analysis/failure",
    name: "analysis-failure",
    component: MatchFailureView,
    meta: { title: "匹配失败" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const store = useEduScopeStore();
  if (to.meta.requiresApiKey && !store.ai.apiKey) {
    return {
      path: "/ai",
      query: { redirect: to.fullPath },
    };
  }

  return true;
});

router.afterEach((to) => {
  document.title = `edua | ${to.meta.title || "Education Assistant"}`;
});

export default router;

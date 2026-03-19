import { reactive } from "vue";
import { parseClassQuestionBundle, parseGradeOverviewBundle } from "../utils/questionAnalysis.js";
import { api } from "../utils/api.js";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ANALYSIS_MODES = ["classQuestion", "gradeOverview"];

const state = reactive({
  datasets: {
    classQuestion: null,
    gradeOverview: null,
  },
  failure: null,
  ui: {
    toast: {
      visible: false,
      message: "",
    },
  },
  auth: {
    user: null,
    isLoggedIn: false,
    loading: false,
  },
  ai: {
    apiKey: "",
    usage: null,
    copilot: {
      status: "待配置",
      requestInFlight: false,
      messages: [],
    },
    questionStudio: {
      status: "待生成",
      requestInFlight: false,
      lastPaper: null,
    },
    paperStudio: {
      status: "待生成",
      requestInFlight: false,
      lastPaper: null,
    },
    similarQuestionStudio: {
      status: "待生成",
      extracting: false,
      requestInFlight: false,
      extraction: null,
      knowledgeDraft: [],
      lastPaper: null,
    },
  },
});

let toastTimer = null;
let sessionTimer = null;

export function useEduScopeStore() {
  return {
    state,
    ui: state.ui,
    ai: state.ai,
    auth: state.auth,
    get datasets() {
      return state.datasets;
    },
    get dataset() {
      return state.datasets.classQuestion || state.datasets.gradeOverview;
    },
    get failure() {
      return state.failure;
    },
    getDataset,
    showToast,
    startSessionTimer,
    touchSession,
    clearAllSession,
    setUser,
    clearUser,
    initAuth,
    logout,
    async importClassQuestion(blueprintFile, detailFile) {
      const result = await parseClassQuestionBundle({ blueprintFile, detailFile });
      if (!result.success) {
        state.datasets.classQuestion = null;
        state.failure = { reasons: result.reasons, mode: "classQuestion" };
        return result;
      }
      state.failure = null;
      state.datasets.classQuestion = result.dataset;
      return result;
    },
    async importGradeOverview(blueprintFile, detailFiles) {
      const result = await parseGradeOverviewBundle({ blueprintFile, detailFiles });
      if (!result.success) {
        state.datasets.gradeOverview = null;
        state.failure = { reasons: result.reasons, mode: "gradeOverview" };
        return result;
      }
      state.failure = null;
      state.datasets.gradeOverview = result.dataset;
      return result;
    },
    setApiKey(value) {
      state.ai.apiKey = value.trim();
      state.ai.copilot.status = state.ai.apiKey ? "待请求" : "待配置";
      state.ai.questionStudio.status = state.ai.apiKey ? "待生成" : "待配置";
      state.ai.paperStudio.status = state.ai.apiKey ? "待生成" : "待配置";
      state.ai.similarQuestionStudio.status = state.ai.apiKey ? "待生成" : "待配置";
    },
    setDataset(mode, dataset) {
      state.datasets[normalizeMode(mode)] = dataset;
    },
    setFailure(failure) {
      state.failure = failure;
    },
    clearDataset(mode) {
      if (!mode) {
        ANALYSIS_MODES.forEach((item) => {
          state.datasets[item] = null;
        });
        state.failure = null;
        return;
      }
      const normalizedMode = normalizeMode(mode);
      state.datasets[normalizedMode] = null;
      if (state.failure?.mode === normalizedMode) {
        state.failure = null;
      }
    },
    resetCopilot() {
      state.ai.usage = null;
      state.ai.copilot.status = state.ai.apiKey ? "待请求" : "待配置";
      state.ai.copilot.requestInFlight = false;
      state.ai.copilot.messages = [];
    },
    resetQuestionStudio() {
      state.ai.usage = null;
      state.ai.questionStudio.status = state.ai.apiKey ? "待生成" : "待配置";
      state.ai.questionStudio.requestInFlight = false;
      state.ai.questionStudio.lastPaper = null;
    },
    resetPaperStudio() {
      state.ai.usage = null;
      state.ai.paperStudio.status = state.ai.apiKey ? "待生成" : "待配置";
      state.ai.paperStudio.requestInFlight = false;
      state.ai.paperStudio.lastPaper = null;
    },
    resetSimilarQuestionStudio() {
      state.ai.usage = null;
      state.ai.similarQuestionStudio.status = state.ai.apiKey ? "待生成" : "待配置";
      state.ai.similarQuestionStudio.extracting = false;
      state.ai.similarQuestionStudio.requestInFlight = false;
      state.ai.similarQuestionStudio.extraction = null;
      state.ai.similarQuestionStudio.knowledgeDraft = [];
      state.ai.similarQuestionStudio.lastPaper = null;
    },
  };
}

function getDataset(mode = "classQuestion") {
  return state.datasets[normalizeMode(mode)];
}

function normalizeMode(mode) {
  return ANALYSIS_MODES.includes(mode) ? mode : "classQuestion";
}

function showToast(message) {
  state.ui.toast.visible = true;
  state.ui.toast.message = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.ui.toast.visible = false;
  }, 2400);
}

function startSessionTimer() {
  touchSession();
}

function touchSession() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    clearAllSession();
    showToast("会话超过 30 分钟未操作，全部临时数据已自动清空。");
  }, SESSION_TIMEOUT_MS);
}

function clearAllSession() {
  ANALYSIS_MODES.forEach((mode) => {
    state.datasets[mode] = null;
  });
  state.failure = null;
  state.ai.apiKey = "";
  state.ai.usage = null;
  state.ai.copilot = {
    status: "待配置",
    requestInFlight: false,
    messages: [],
  };
  state.ai.questionStudio = {
    status: "待配置",
    requestInFlight: false,
    lastPaper: null,
  };
  state.ai.paperStudio = {
    status: "待配置",
    requestInFlight: false,
    lastPaper: null,
  };
  state.ai.similarQuestionStudio = {
    status: "待配置",
    extracting: false,
    requestInFlight: false,
    extraction: null,
    knowledgeDraft: [],
    lastPaper: null,
  };
}

function setUser(user) {
  state.auth.user = user;
  state.auth.isLoggedIn = true;
}

function clearUser() {
  state.auth.user = null;
  state.auth.isLoggedIn = false;
}

async function initAuth() {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    return false;
  }

  state.auth.loading = true;
  try {
    const result = await api.getCurrentUser();
    if (result.success) {
      setUser(result.data.user);
      return true;
    }
  } catch (error) {
    console.error("Failed to get current user:", error);
    clearUser();
    localStorage.removeItem("auth_token");
  } finally {
    state.auth.loading = false;
  }
  return false;
}

async function logout() {
  try {
    await api.logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearUser();
    localStorage.removeItem("auth_token");
  }
}

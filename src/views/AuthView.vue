<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { api } from "../utils/api";

const router = useRouter();
const route = useRoute();
const store = useEduScopeStore();

const isLogin = ref(true);
const loading = ref(false);
const errorMessage = ref("");

const form = ref({
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  nickname: "",
});

const formTitle = computed(() => (isLogin.value ? "登录" : "注册"));
const switchText = computed(() =>
  isLogin.value ? "没有账号？立即注册" : "已有账号？立即登录"
);

function switchMode() {
  isLogin.value = !isLogin.value;
  errorMessage.value = "";
}

function validateForm() {
  if (isLogin.value) {
    if (!form.value.username || !form.value.password) {
      errorMessage.value = "请填写用户名和密码";
      return false;
    }
  } else {
    if (!form.value.username || form.value.username.length < 3) {
      errorMessage.value = "用户名至少需要3个字符";
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(form.value.username)) {
      errorMessage.value = "用户名只能包含字母、数字和下划线";
      return false;
    }
    if (
      !form.value.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)
    ) {
      errorMessage.value = "请输入有效的邮箱地址";
      return false;
    }
    if (!form.value.password || form.value.password.length < 6) {
      errorMessage.value = "密码至少需要6个字符";
      return false;
    }
    if (form.value.password !== form.value.confirmPassword) {
      errorMessage.value = "两次输入的密码不一致";
      return false;
    }
  }
  return true;
}

async function handleSubmit() {
  errorMessage.value = "";

  if (!validateForm()) {
    return;
  }

  loading.value = true;

  try {
    let result;
    if (isLogin.value) {
      result = await api.login(form.value.username, form.value.password);
    } else {
      result = await api.register(
        form.value.username,
        form.value.email,
        form.value.password,
        form.value.nickname
      );
    }

    if (result.success) {
      store.setUser(result.data.user);
      store.showToast(isLogin.value ? "登录成功" : "注册成功");

      const redirect = route.query.redirect || "/";
      router.push(redirect);
    }
  } catch (error) {
    errorMessage.value = error.message || "操作失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-bg">
      <div class="bg-shape bg-shape-1"></div>
      <div class="bg-shape bg-shape-2"></div>
      <div class="bg-shape bg-shape-3"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="auth-content">
      <div class="auth-left">
        <div class="brand-section">
          <div class="brand-logo">
            <span class="logo-icon">ea</span>
          </div>
          <h1 class="brand-title">edua</h1>
          <p class="brand-tagline">教育辅助平台</p>
        </div>

        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                ></path>
              </svg>
            </div>
            <div class="feature-text">
              <h3>智能助手</h3>
              <p>AI 驱动的教学辅助</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                ></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div class="feature-text">
              <h3>智能出题</h3>
              <p>一键生成高质量试题</p>
            </div>
          </div>

          <div class="feature-item">
            <div class="feature-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div class="feature-text">
              <h3>成绩分析</h3>
              <p>深度数据洞察报告</p>
            </div>
          </div>
        </div>
      </div>

      <div class="auth-right">
        <div class="auth-card">
          <div class="card-header">
            <h2 class="card-title">{{ formTitle }}</h2>
            <p class="card-subtitle">
              {{
                isLogin
                  ? "欢迎回来，请登录您的账号"
                  : "创建新账号，开始使用平台"
              }}
            </p>
          </div>

          <form class="auth-form" @submit.prevent="handleSubmit">
            <div v-if="errorMessage" class="error-message">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              {{ errorMessage }}
            </div>

            <div class="form-group">
              <label class="form-label">
                {{ isLogin ? "用户名/邮箱" : "用户名" }}
              </label>
              <div class="input-wrapper">
                <svg
                  class="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <input
                  v-model="form.username"
                  type="text"
                  class="form-input"
                  :placeholder="isLogin ? '请输入用户名或邮箱' : '请输入用户名'"
                  autocomplete="username"
                />
              </div>
            </div>

            <div v-if="!isLogin" class="form-group">
              <label class="form-label">邮箱</label>
              <div class="input-wrapper">
                <svg
                  class="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                  ></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <input
                  v-model="form.email"
                  type="email"
                  class="form-input"
                  placeholder="请输入邮箱"
                  autocomplete="email"
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">密码</label>
              <div class="input-wrapper">
                <svg
                  class="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    ry="2"
                  ></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  v-model="form.password"
                  type="password"
                  class="form-input"
                  placeholder="请输入密码"
                  autocomplete="current-password"
                />
              </div>
            </div>

            <div v-if="!isLogin" class="form-group">
              <label class="form-label">确认密码</label>
              <div class="input-wrapper">
                <svg
                  class="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    ry="2"
                  ></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  v-model="form.confirmPassword"
                  type="password"
                  class="form-input"
                  placeholder="请再次输入密码"
                  autocomplete="new-password"
                />
              </div>
            </div>

            <div v-if="!isLogin" class="form-group">
              <label class="form-label">昵称（可选）</label>
              <div class="input-wrapper">
                <svg
                  class="input-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <input
                  v-model="form.nickname"
                  type="text"
                  class="form-input"
                  placeholder="请输入昵称"
                />
              </div>
            </div>

            <button type="submit" class="submit-button" :disabled="loading">
              <span v-if="loading" class="loading-spinner"></span>
              <span v-else>{{ formTitle }}</span>
            </button>

            <div class="form-footer">
              <span class="footer-text">{{
                isLogin ? "还没有账号？" : "已有账号？"
              }}</span>
              <button type="button" class="switch-link" @click="switchMode">
                {{ isLogin ? "立即注册" : "立即登录" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #0a2463 0%, #1e3a8a 50%, #3e92cc 100%);
}

.auth-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
}

.bg-shape-1 {
  width: 600px;
  height: 600px;
  background: linear-gradient(135deg, #3e92cc, #63b3e6);
  top: -200px;
  right: -100px;
  animation-delay: 0s;
}

.bg-shape-2 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #0a2463, #1e3a8a);
  bottom: -150px;
  left: -100px;
  animation-delay: -5s;
}

.bg-shape-3 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #63b3e6, #3e92cc);
  top: 50%;
  left: 30%;
  animation-delay: -10s;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.05);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.95);
  }
  75% {
    transform: translate(20px, 10px) scale(1.02);
  }
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(
      rgba(255, 255, 255, 0.03) 1px,
      transparent 1px
    ),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}

.auth-content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px;
  gap: 60px;
  align-items: center;
}

.auth-left {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.brand-section {
  text-align: left;
}

.brand-logo {
  margin-bottom: 24px;
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 1.75rem;
  font-weight: 800;
  color: white;
  letter-spacing: 0.05em;
}

.brand-title {
  font-size: 3.5rem;
  font-weight: 800;
  color: white;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
}

.brand-tagline {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  font-weight: 500;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateX(8px);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: white;
}

.feature-text h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  margin: 0 0 4px;
}

.feature-text p {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.auth-right {
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 48px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.1);
}

.card-header {
  text-align: center;
  margin-bottom: 32px;
}

.card-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f1f3d;
  margin: 0 0 8px;
}

.card-subtitle {
  font-size: 0.95rem;
  color: #5f6f86;
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #dc2626;
  font-size: 0.875rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #9ca3af;
  pointer-events: none;
  transition: color 0.2s;
}

.form-input {
  width: 100%;
  padding: 14px 16px 14px 44px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  background: #f9fafb;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3e92cc;
  background: white;
  box-shadow: 0 0 0 4px rgba(62, 146, 204, 0.1);
}

.form-input:focus + .input-icon,
.input-wrapper:focus-within .input-icon {
  color: #3e92cc;
}

.form-input::placeholder {
  color: #9ca3af;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #0a2463 0%, #3e92cc 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(10, 36, 99, 0.3);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.footer-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.switch-link {
  background: none;
  border: none;
  color: #0a2463;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.switch-link:hover {
  color: #3e92cc;
  text-decoration: underline;
}

@media (max-width: 1024px) {
  .auth-content {
    grid-template-columns: 1fr;
    padding: 24px;
    gap: 40px;
  }

  .auth-left {
    display: none;
  }

  .auth-right {
    justify-content: center;
  }
}

@media (max-width: 520px) {
  .auth-container {
    padding: 16px;
  }

  .auth-card {
    padding: 32px 24px;
    border-radius: 20px;
  }

  .card-title {
    font-size: 1.5rem;
  }
}
</style>

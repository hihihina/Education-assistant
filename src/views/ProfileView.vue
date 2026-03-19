<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useEduScopeStore } from "../composables/useEduScopeStore";
import { api } from "../utils/api";

const router = useRouter();
const store = useEduScopeStore();

const loading = ref(false);
const saving = ref(false);
const message = ref("");
const messageType = ref("success");

const form = ref({
  nickname: "",
  gender: "other",
  identity: "other",
  school: "",
  grade: "",
  className: "",
  studentId: "",
  phone: "",
  bio: "",
  subject: "",
  aiApiKey: "",
});

const genderOptions = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "保密" },
];

const identityOptions = [
  { value: "student", label: "学生" },
  { value: "teacher", label: "教师" },
  { value: "other", label: "其他" },
];

const gradeOptions = [
  { value: "", label: "请选择年级" },
  { value: "高一", label: "高一" },
  { value: "高二", label: "高二" },
  { value: "高三", label: "高三" },
  { value: "初一", label: "初一" },
  { value: "初二", label: "初二" },
  { value: "初三", label: "初三" },
  { value: "小学", label: "小学" },
  { value: "大学", label: "大学" },
];

const subjectOptions = [
  { value: "", label: "请选择学科" },
  { value: "语文", label: "语文" },
  { value: "数学", label: "数学" },
  { value: "英语", label: "英语" },
  { value: "物理", label: "物理" },
  { value: "化学", label: "化学" },
  { value: "生物", label: "生物" },
  { value: "历史", label: "历史" },
  { value: "地理", label: "地理" },
  { value: "政治", label: "政治" },
  { value: "其他", label: "其他" },
];

const isStudent = computed(() => form.value.identity === "student");
const isTeacher = computed(() => form.value.identity === "teacher");

onMounted(async () => {
  await loadProfile();
});

async function loadProfile() {
  loading.value = true;
  try {
    const result = await api.getCurrentUser();
    if (result.success) {
      const user = result.data.user;
      form.value = {
        nickname: user.nickname || "",
        gender: user.gender || "other",
        identity: user.identity || "other",
        school: user.school || "",
        grade: user.grade || "",
        className: user.className || "",
        studentId: user.studentId || "",
        phone: user.phone || "",
        bio: user.bio || "",
        subject: user.subject || "",
        aiApiKey: user.aiApiKey || "",
      };
    }
  } catch (error) {
    showMessage("加载用户信息失败", "error");
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  message.value = "";

  try {
    const result = await api.updateProfile(form.value);
    if (result.success) {
      store.setUser(result.data.user);
      showMessage("保存成功", "success");
    }
  } catch (error) {
    showMessage(error.message || "保存失败", "error");
  } finally {
    saving.value = false;
  }
}

function showMessage(text, type) {
  message.value = text;
  messageType.value = type;
  setTimeout(() => {
    message.value = "";
  }, 3000);
}

function goBack() {
  router.back();
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-header">
      <button class="back-button" @click="goBack">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h1 class="page-title">个人信息</h1>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else class="profile-content">
      <div v-if="message" class="message-toast" :class="messageType">
        {{ message }}
      </div>

      <form class="profile-form" @submit.prevent="handleSave">
        <section class="form-section">
          <h2 class="section-title">基本信息</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">昵称</label>
              <input
                v-model="form.nickname"
                type="text"
                class="form-input"
                placeholder="请输入昵称"
              />
            </div>

            <div class="form-group">
              <label class="form-label">性别</label>
              <div class="radio-group">
                <label
                  v-for="option in genderOptions"
                  :key="option.value"
                  class="radio-item"
                  :class="{ active: form.gender === option.value }"
                >
                  <input
                    v-model="form.gender"
                    type="radio"
                    :value="option.value"
                  />
                  {{ option.label }}
                </label>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">身份</label>
              <div class="radio-group">
                <label
                  v-for="option in identityOptions"
                  :key="option.value"
                  class="radio-item"
                  :class="{ active: form.identity === option.value }"
                >
                  <input
                    v-model="form.identity"
                    type="radio"
                    :value="option.value"
                  />
                  {{ option.label }}
                </label>
              </div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">学校信息</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">学校名称</label>
              <input
                v-model="form.school"
                type="text"
                class="form-input"
                placeholder="请输入学校名称"
              />
            </div>

            <div class="form-group">
              <label class="form-label">年级</label>
              <select v-model="form.grade" class="form-select">
                <option
                  v-for="option in gradeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">班级</label>
              <input
                v-model="form.className"
                type="text"
                class="form-input"
                placeholder="例如：高一1班"
              />
            </div>

            <div class="form-group">
              <label class="form-label">{{
                isStudent ? "学号" : isTeacher ? "工号" : "编号"
              }}</label>
              <input
                v-model="form.studentId"
                type="text"
                class="form-input"
                :placeholder="
                  isStudent
                    ? '请输入学号'
                    : isTeacher
                    ? '请输入工号'
                    : '请输入编号'
                "
              />
            </div>
          </div>

          <div v-if="isTeacher" class="form-row">
            <div class="form-group">
              <label class="form-label">任教科目</label>
              <select v-model="form.subject" class="form-select">
                <option
                  v-for="option in subjectOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">联系方式</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">手机号码</label>
              <input
                v-model="form.phone"
                type="tel"
                class="form-input"
                placeholder="请输入手机号码"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">个人简介</label>
              <textarea
                v-model="form.bio"
                class="form-textarea"
                rows="3"
                placeholder="介绍一下自己吧..."
              ></textarea>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">AI 配置</h2>

          <div class="form-row">
            <div class="form-group full-width">
              <label class="form-label">AI API Key（可选）</label>
              <input
                v-model="form.aiApiKey"
                type="password"
                class="form-input"
                placeholder="输入您的 AI API Key 用于智能功能"
              />
              <p class="form-hint">
                配置后将用于智能助手、智能出题、智能出卷等功能
              </p>
            </div>
          </div>
        </section>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="goBack">
            取消
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="btn-loading"></span>
            {{ saving ? "保存中..." : "保存修改" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
  color: var(--ink);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background: rgba(47, 125, 244, 0.05);
  border-color: rgba(47, 125, 244, 0.2);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ink-soft);
  gap: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--line);
  border-top-color: var(--copper);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message-toast {
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 20px;
}

.message-toast.success {
  background: rgba(39, 165, 111, 0.1);
  border: 1px solid rgba(39, 165, 111, 0.2);
  color: #27a56f;
}

.message-toast.error {
  background: rgba(227, 93, 103, 0.1);
  border: 1px solid rgba(227, 93, 103, 0.2);
  color: #e35d67;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  padding: 24px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 20px;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 16px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
}

.form-input,
.form-select,
.form-textarea {
  padding: 12px 16px;
  border: 2px solid var(--line);
  border-radius: 12px;
  font-size: 0.95rem;
  background: #fafbfc;
  color: var(--ink);
  transition: all 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--copper);
  background: white;
  box-shadow: 0 0 0 4px rgba(47, 125, 244, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #9ca3af;
}

.form-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-hint {
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin: 4px 0 0;
}

.radio-group {
  display: flex;
  gap: 12px;
}

.radio-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border: 2px solid var(--line);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--ink-soft);
  cursor: pointer;
  transition: all 0.2s;
}

.radio-item input {
  display: none;
}

.radio-item:hover {
  border-color: rgba(47, 125, 244, 0.3);
}

.radio-item.active {
  border-color: var(--copper);
  background: rgba(47, 125, 244, 0.08);
  color: var(--copper);
  font-weight: 600;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f3f4f6;
  color: #6b7280;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: linear-gradient(135deg, var(--copper), var(--teal));
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(47, 125, 244, 0.3);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-loading {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 640px) {
  .profile-page {
    padding: 16px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .radio-group {
    flex-wrap: wrap;
  }

  .radio-item {
    flex: 1;
    min-width: 80px;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>

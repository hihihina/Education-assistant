const API_BASE = import.meta.env.VITE_API_BASE || '/api';

class ApiService {
    constructor() {
        this.baseURL = API_BASE;
    }

    getToken() {
        return localStorage.getItem('auth_token');
    }

    setToken(token) {
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            const error = new Error(data.message || '请求失败');
            error.response = data;
            throw error;
        }

        return data;
    }

    async register(username, email, password, nickname) {
        const result = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password, nickname }),
        });
        if (result.success && result.data.token) {
            this.setToken(result.data.token);
        }
        return result;
    }

    async login(identifier, password) {
        const result = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
        });
        if (result.success && result.data.token) {
            this.setToken(result.data.token);
        }
        return result;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.setToken(null);
        }
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    async updateProfile(profileData) {
        return this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData),
        });
    }

    async changePassword(oldPassword, newPassword) {
        const result = await this.request('/auth/password', {
            method: 'PUT',
            body: JSON.stringify({ oldPassword, newPassword }),
        });
        this.setToken(null);
        return result;
    }
}

export const api = new ApiService();

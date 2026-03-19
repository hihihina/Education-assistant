import pool from './mysql.js';

const PUBLIC_FIELDS = `id, username, email, nickname, avatar, gender, identity, school, grade, class_name, student_id, phone, bio, subject, ai_api_key, role, status, last_login_at, created_at, updated_at`;

export const UserModel = {
    async create({ username, email, password, nickname }) {
        const [result] = await pool.execute(
            `INSERT INTO users (username, email, password, nickname) VALUES (?, ?, ?, ?)`,
            [username, email, password, nickname || username]
        );
        return this.findById(result.insertId);
    },

    async findById(id) {
        const [rows] = await pool.execute(
            `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    },

    async findByUsername(username) {
        const [rows] = await pool.execute(
            `SELECT * FROM users WHERE username = ?`,
            [username]
        );
        return rows[0] || null;
    },

    async findByEmail(email) {
        const [rows] = await pool.execute(
            `SELECT * FROM users WHERE email = ?`,
            [email]
        );
        return rows[0] || null;
    },

    async findByUsernameOrEmail(identifier) {
        const [rows] = await pool.execute(
            `SELECT * FROM users WHERE username = ? OR email = ?`,
            [identifier, identifier]
        );
        return rows[0] || null;
    },

    async updateLastLogin(id) {
        await pool.execute(
            `UPDATE users SET last_login_at = NOW() WHERE id = ?`,
            [id]
        );
    },

    async updateProfile(id, data) {
        const allowedFields = [
            'nickname', 'avatar', 'gender', 'identity', 'school',
            'grade', 'class_name', 'student_id', 'phone', 'bio', 'subject', 'ai_api_key'
        ];
        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (updates.length === 0) return this.findById(id);

        values.push(id);
        await pool.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        return this.findById(id);
    },

    async updatePassword(id, hashedPassword) {
        await pool.execute(
            `UPDATE users SET password = ? WHERE id = ?`,
            [hashedPassword, id]
        );
    },

    async delete(id) {
        await pool.execute(`DELETE FROM users WHERE id = ?`, [id]);
    },
};

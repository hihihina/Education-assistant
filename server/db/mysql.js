import mysql from 'mysql2/promise';
import { config } from '../config.js';

const pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export async function initDatabase() {
    const connection = await mysql.createConnection({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
    });

    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\``);
    await connection.changeUser({ database: config.mysql.database });

    await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            nickname VARCHAR(50),
            avatar VARCHAR(255),
            gender ENUM('male', 'female', 'other') DEFAULT 'other',
            identity ENUM('student', 'teacher', 'other') DEFAULT 'other',
            school VARCHAR(100),
            grade VARCHAR(20),
            class_name VARCHAR(50),
            student_id VARCHAR(50),
            phone VARCHAR(20),
            bio TEXT,
            subject VARCHAR(50),
            ai_api_key VARCHAR(255),
            role ENUM('user', 'admin') DEFAULT 'user',
            status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
            last_login_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_username (username),
            INDEX idx_email (email),
            INDEX idx_identity (identity),
            INDEX idx_school (school)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.end();
    console.log('Database initialized successfully');
}

export default pool;

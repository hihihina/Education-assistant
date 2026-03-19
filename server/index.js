import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { initDatabase } from './db/mysql.js';
import { connectRedis } from './db/redis.js';
import authRoutes from './routes/auth.js';

const app = express();

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        message: '请求过于频繁，请稍后再试',
    },
});
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在',
    });
});

async function startServer() {
    try {
        console.log('Initializing database...');
        await initDatabase();

        console.log('Connecting to Redis...');
        await connectRedis();

        app.listen(config.port, () => {
            console.log(`Server running on port ${config.port}`);
            console.log(`API available at http://localhost:${config.port}/api`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

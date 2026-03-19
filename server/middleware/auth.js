import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { TokenBlacklist } from '../db/redis.js';

export function generateToken(payload) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, config.jwt.secret);
    } catch {
        return null;
    }
}

export function getTokenExpiry(token) {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.exp) return 0;
    return decoded.exp - Math.floor(Date.now() / 1000);
}

export async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: '未提供认证令牌',
        });
    }

    const token = authHeader.split(' ')[1];

    const isBlacklisted = await TokenBlacklist.has(token);
    if (isBlacklisted) {
        return res.status(401).json({
            success: false,
            message: '令牌已失效，请重新登录',
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({
            success: false,
            message: '令牌无效或已过期',
        });
    }

    req.user = decoded;
    req.token = token;
    next();
}

export function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
            req.token = token;
        }
    }

    next();
}

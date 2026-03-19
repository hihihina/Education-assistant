import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../db/userModel.js';
import { TokenBlacklist, SessionStore } from '../db/redis.js';
import { authMiddleware, generateToken, getTokenExpiry } from '../middleware/auth.js';

const router = Router();

const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('用户名长度必须在3-50个字符之间')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('用户名只能包含字母、数字和下划线'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('请输入有效的邮箱地址')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6, max: 100 })
        .withMessage('密码长度必须在6-100个字符之间'),
];

const loginValidation = [
    body('identifier')
        .trim()
        .notEmpty()
        .withMessage('请输入用户名或邮箱'),
    body('password')
        .notEmpty()
        .withMessage('请输入密码'),
];

function formatUserResponse(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        gender: user.gender,
        identity: user.identity,
        school: user.school,
        grade: user.grade,
        className: user.class_name,
        studentId: user.student_id,
        phone: user.phone,
        bio: user.bio,
        subject: user.subject,
        aiApiKey: user.ai_api_key,
        role: user.role,
        status: user.status,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    };
}

router.post('/register', registerValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '输入验证失败',
                errors: errors.array(),
            });
        }

        const { username, email, password, nickname } = req.body;

        const existingUsername = await UserModel.findByUsername(username);
        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: '用户名已被使用',
            });
        }

        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: '邮箱已被注册',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await UserModel.create({
            username,
            email,
            password: hashedPassword,
            nickname,
        });

        const token = generateToken({ userId: user.id, username: user.username });
        const sessionId = uuidv4();
        const expiresIn = 7 * 24 * 60 * 60;
        await SessionStore.set(user.id, sessionId, { createdAt: Date.now() }, expiresIn);

        res.status(201).json({
            success: true,
            message: '注册成功',
            data: {
                user: formatUserResponse(user),
                token,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

router.post('/login', loginValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '输入验证失败',
                errors: errors.array(),
            });
        }

        const { identifier, password } = req.body;

        const user = await UserModel.findByUsernameOrEmail(identifier);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误',
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: '账户已被禁用，请联系管理员',
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误',
            });
        }

        await UserModel.updateLastLogin(user.id);

        const token = generateToken({ userId: user.id, username: user.username });
        const sessionId = uuidv4();
        const expiresIn = 7 * 24 * 60 * 60;
        await SessionStore.set(user.id, sessionId, { createdAt: Date.now() }, expiresIn);

        res.json({
            success: true,
            message: '登录成功',
            data: {
                user: formatUserResponse(user),
                token,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const token = req.token;
        const expiresIn = getTokenExpiry(token);

        if (expiresIn > 0) {
            await TokenBlacklist.add(token, expiresIn);
        }

        res.json({
            success: true,
            message: '退出登录成功',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await UserModel.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在',
            });
        }

        res.json({
            success: true,
            data: {
                user: formatUserResponse(user),
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const allowedFields = [
            'nickname', 'avatar', 'gender', 'identity', 'school',
            'grade', 'className', 'studentId', 'phone', 'bio', 'subject', 'aiApiKey'
        ];

        const dbFieldMap = {
            className: 'class_name',
            studentId: 'student_id',
            aiApiKey: 'ai_api_key',
        };

        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                const dbField = dbFieldMap[field] || field;
                updateData[dbField] = req.body[field];
            }
        }

        const user = await UserModel.updateProfile(req.user.userId, updateData);

        res.json({
            success: true,
            message: '资料更新成功',
            data: {
                user: formatUserResponse(user),
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

router.put('/password', authMiddleware, [
    body('oldPassword').notEmpty().withMessage('请输入原密码'),
    body('newPassword')
        .isLength({ min: 6, max: 100 })
        .withMessage('新密码长度必须在6-100个字符之间'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: '输入验证失败',
                errors: errors.array(),
            });
        }

        const { oldPassword, newPassword } = req.body;
        const user = await UserModel.findByUsername(req.user.username);

        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '原密码错误',
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await UserModel.updatePassword(user.id, hashedPassword);

        const token = req.token;
        const expiresIn = getTokenExpiry(token);
        if (expiresIn > 0) {
            await TokenBlacklist.add(token, expiresIn);
        }

        res.json({
            success: true,
            message: '密码修改成功，请重新登录',
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

export default router;

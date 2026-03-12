require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Rate Limiting ──────────────────────────────────────────────
// Max 10 login/register attempts per 15 min per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Demasiados intentos de acceso. Por favor espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Max 5 Google auth attempts per 15 min per IP
const googleLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiados intentos con Google. Por favor espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    try {
        const user = await db.user.findUnique({ where: { email: normalizedEmail } });

        // Use constant-time comparison to prevent timing attacks
        if (!user || !user.password) {
            // Compare against a dummy hash to prevent timing attacks
            await bcrypt.compare(password, '$2a$10$dummyhashfortimingprotection00000000000000000000000000');
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, role: user.role, email: user.email });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Password strength check
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            return res.status(400).json({ error: 'El email ya está en uso' });
        }

        const hashedPassword = await bcrypt.hash(password, 12); // stronger: 12 rounds
        const user = await db.user.create({
            data: { email: normalizedEmail, password: hashedPassword, role: 'user' }
        });

        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.status(201).json({ token, role: user.role, email: user.email });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// ── POST /api/auth/google ─────────────────────────────────────
router.post('/google', googleLimiter, async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.startsWith('TU_')) {
        return res.status(503).json({ error: 'Google OAuth no está configurado en el servidor' });
    }

    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Token requerido' });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        // Verify email is confirmed by Google
        if (!payload.email_verified) {
            return res.status(401).json({ error: 'Email de Google no verificado' });
        }

        const email = payload.email.trim().toLowerCase();
        let user = await db.user.findUnique({ where: { email } });

        if (!user) {
            user = await db.user.create({
                data: { email, google_id: payload.sub, role: 'user' }
            });
        } else if (!user.google_id) {
            user = await db.user.update({
                where: { id: user.id },
                data: { google_id: payload.sub }
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, role: user.role, email: user.email });
    } catch (err) {
        console.error('Google Auth Error:', err.message);
        res.status(401).json({ error: 'Token de Google inválido o expirado' });
    }
});

// ── POST /api/auth/verify ─────────────────────────────────────
router.post('/verify', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ valid: false });
    }
    try {
        const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        res.json({ valid: true, role: payload.role, email: payload.email, id: payload.id });
    } catch {
        res.status(401).json({ valid: false });
    }
});

module.exports = router;

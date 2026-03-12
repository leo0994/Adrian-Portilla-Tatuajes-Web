const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = auth.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere ser administrador' });
        }
        req.admin = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

function requireUser(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = auth.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

module.exports = { requireAdmin, requireUser };

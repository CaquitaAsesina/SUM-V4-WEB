const jwt = require('jsonwebtoken');
const pool = require('../config/database');

async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Acceso no autorizado' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [users] = await pool.query(
            'SELECT id, username, nombre_completo, rol, activo FROM usuarios WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0 || !users[0].activo) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Sesión expirada. Inicie sesión nuevamente.' });
        }
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
}

async function adminMiddleware(req, res, next) {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso restringido a administradores' });
    }
    next();
}

// El rol 'registrador' solo puede registrar y buscar, no editar ni eliminar
async function registrosEditorMiddleware(req, res, next) {
    if (req.user && req.user.rol === 'registrador') {
        return res.status(403).json({ success: false, message: 'Su rol solo permite registrar y buscar registros' });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware, registrosEditorMiddleware };

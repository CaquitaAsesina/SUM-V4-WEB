const authService = require('../service/authService');

class AuthController {
    async login(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
            }
            const ip = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'] || '';
            const result = await authService.login(username, password, ip, userAgent);

            if (!result.success) {
                return res.status(401).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async verifyToken(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ valid: false, message: 'Token no proporcionado' });
            }
            const token = authHeader.split(' ')[1];
            const result = await authService.verifyToken(token);
            return res.json(result);
        } catch (error) {
            return res.status(500).json({ valid: false, message: 'Error al verificar token' });
        }
    }

    async cambiarContrasena(req, res) {
        try {
            const { userId, passwordActual, nuevaPassword, esAdminCambiandoOtro } = req.body;
            if (!userId || !nuevaPassword) {
                return res.status(400).json({ success: false, message: 'Datos incompletos' });
            }
            const result = await authService.cambiarContrasena(userId, passwordActual, nuevaPassword, esAdminCambiandoOtro);
            const status = result.success ? 200 : 400;
            return res.status(status).json(result);
        } catch (error) {
            console.error('Cambiar contraseña error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async crearUsuario(req, res) {
        try {
            const { username, password, nombreCompleto, rol } = req.body;
            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
            }
            const result = await authService.crearUsuario(username, password, nombreCompleto, rol);
            const status = result.success ? 201 : 400;
            return res.status(status).json(result);
        } catch (error) {
            console.error('Crear usuario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarUsuario(req, res) {
        try {
            const { userId } = req.params;
            const adminId = req.user.id;
            const result = await authService.eliminarUsuario(parseInt(userId), adminId);
            const status = result.success ? 200 : 400;
            return res.status(status).json(result);
        } catch (error) {
            console.error('Eliminar usuario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async listarUsuarios(req, res) {
        try {
            const users = await authService.listarUsuarios();
            return res.json({ success: true, users });
        } catch (error) {
            console.error('Listar usuarios error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async toggleUsuario(req, res) {
        try {
            const { userId } = req.params;
            const adminId = req.user.id;
            const result = await authService.toggleUsuario(parseInt(userId), adminId);
            const status = result.success ? 200 : 400;
            return res.status(status).json(result);
        } catch (error) {
            console.error('Toggle usuario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new AuthController();

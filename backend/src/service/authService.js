const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 30;

class AuthService {
    // Login
    async login(username, password, ip, userAgent) {
        const conn = await pool.getConnection();
        try {
            const [users] = await conn.query(
                'SELECT * FROM usuarios WHERE username = ?',
                [username]
            );

            if (users.length === 0) {
                await this._registrarAuditoria(conn, username, false, ip, userAgent);
                return { success: false, message: 'Credenciales incorrectas' };
            }

            const user = users[0];

            // Verificar si está activo
            if (!user.activo) {
                return { success: false, message: 'Cuenta desactivada. Contacte al administrador.' };
            }

            // Verificar bloqueo
            if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
                const minutosRestantes = Math.ceil((new Date(user.bloqueado_hasta) - new Date()) / 60000);
                return {
                    success: false,
                    message: `Cuenta bloqueada. Intente de nuevo en ${minutosRestantes} minutos.`
                };
            }

            // Verificar contraseña
            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {
                const nuevosIntentos = user.intentos_fallidos + 1;
                let bloqueadoHasta = null;

                if (nuevosIntentos >= MAX_INTENTOS) {
                    bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000);
                    await conn.query(
                        'UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?',
                        [nuevosIntentos, bloqueadoHasta, user.id]
                    );
                    await this._registrarAuditoria(conn, username, false, ip, userAgent);
                    return {
                        success: false,
                        message: `Demasiados intentos. Cuenta bloqueada por ${BLOQUEO_MINUTOS} minutos.`
                    };
                }

                await conn.query(
                    'UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?',
                    [nuevosIntentos, user.id]
                );
                await this._registrarAuditoria(conn, username, false, ip, userAgent);
                return {
                    success: false,
                    message: `Credenciales incorrectas. Intentos restantes: ${MAX_INTENTOS - nuevosIntentos}`
                };
            }

            // Login exitoso - resetear intentos
            await conn.query(
                'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
                [user.id]
            );
            await this._registrarAuditoria(conn, username, true, ip, userAgent);

            // Generar JWT
            const token = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    rol: user.rol,
                    nombre_completo: user.nombre_completo
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
            );

            return {
                success: true,
                message: 'Inicio de sesión exitoso',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    nombre_completo: user.nombre_completo,
                    rol: user.rol
                }
            };
        } finally {
            conn.release();
        }
    }

    // Verificar token
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [users] = await pool.query(
                'SELECT id, username, nombre_completo, rol, activo FROM usuarios WHERE id = ?',
                [decoded.id]
            );

            if (users.length === 0 || !users[0].activo) {
                return { valid: false, message: 'Usuario no encontrado o inactivo' };
            }

            return { valid: true, user: users[0] };
        } catch (error) {
            return { valid: false, message: 'Token inválido o expirado' };
        }
    }

    // Cambiar contraseña (propia o admin cambia la de otro)
    async cambiarContrasena(userId, passwordActual, nuevaPassword, esAdminCambiandoOtro = false) {
        const conn = await pool.getConnection();
        try {
            const [users] = await conn.query('SELECT * FROM usuarios WHERE id = ?', [userId]);

            if (users.length === 0) {
                return { success: false, message: 'Usuario no encontrado' };
            }

            const user = users[0];

            // Si no es admin cambiando otro, verificar contraseña actual
            if (!esAdminCambiandoOtro) {
                if (!passwordActual) {
                    return { success: false, message: 'Debe ingresar su contraseña actual' };
                }
                const validPassword = await bcrypt.compare(passwordActual, user.password);
                if (!validPassword) {
                    return { success: false, message: 'La contraseña actual es incorrecta' };
                }
            }

            // Validar nueva contraseña
            if (!nuevaPassword || nuevaPassword.length < 4) {
                return { success: false, message: 'La nueva contraseña debe tener al menos 4 caracteres' };
            }

            const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
            await conn.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPassword, userId]);

            return { success: true, message: 'Contraseña actualizada correctamente' };
        } finally {
            conn.release();
        }
    }

    // Crear usuario (solo admin)
    async crearUsuario(username, password, nombreCompleto, rol) {
        const conn = await pool.getConnection();
        try {
            if (!username || username.length < 3) {
                return { success: false, message: 'El usuario debe tener al menos 3 caracteres' };
            }
            if (!password || password.length < 4) {
                return { success: false, message: 'La contraseña debe tener al menos 4 caracteres' };
            }

            const [existing] = await conn.query('SELECT id FROM usuarios WHERE username = ?', [username]);
            if (existing.length > 0) {
                return { success: false, message: 'El nombre de usuario ya existe' };
            }

            const rolesPermitidos = ['admin', 'usuario', 'registrador'];
            const rolFinal = rolesPermitidos.includes(rol) ? rol : 'usuario';

            const hashedPassword = await bcrypt.hash(password, 10);
            const [result] = await conn.query(
                'INSERT INTO usuarios (username, password, nombre_completo, rol, activo) VALUES (?, ?, ?, ?, 1)',
                [username, hashedPassword, nombreCompleto || username, rolFinal]
            );

            return {
                success: true,
                message: 'Usuario creado exitosamente',
                userId: result.insertId
            };
        } finally {
            conn.release();
        }
    }

    // Eliminar usuario (solo admin)
    async eliminarUsuario(userId, adminId) {
        const conn = await pool.getConnection();
        try {
            if (userId === adminId) {
                return { success: false, message: 'No puede eliminarse a sí mismo' };
            }

            const [users] = await conn.query('SELECT id, username FROM usuarios WHERE id = ?', [userId]);
            if (users.length === 0) {
                return { success: false, message: 'Usuario no encontrado' };
            }

            if (users[0].username === 'admin') {
                return { success: false, message: 'No se puede eliminar al usuario administrador principal' };
            }

            await conn.query('DELETE FROM usuarios WHERE id = ?', [userId]);
            return { success: true, message: 'Usuario eliminado correctamente' };
        } finally {
            conn.release();
        }
    }

    // Listar usuarios (solo admin)
    async listarUsuarios() {
        const [users] = await pool.query(
            'SELECT id, username, nombre_completo, rol, activo, created_at FROM usuarios ORDER BY created_at DESC'
        );
        return users;
    }

    // Toggle activar/desactivar usuario (solo admin)
    async toggleUsuario(userId, adminId) {
        const conn = await pool.getConnection();
        try {
            if (userId === adminId) {
                return { success: false, message: 'No puede desactivarse a sí mismo' };
            }

            const [users] = await conn.query('SELECT id, activo FROM usuarios WHERE id = ?', [userId]);
            if (users.length === 0) {
                return { success: false, message: 'Usuario no encontrado' };
            }

            const nuevoEstado = users[0].activo ? 0 : 1;
            await conn.query('UPDATE usuarios SET activo = ? WHERE id = ?', [nuevoEstado, userId]);

            return {
                success: true,
                message: nuevoEstado ? 'Usuario activado' : 'Usuario desactivado',
                activo: nuevoEstado
            };
        } finally {
            conn.release();
        }
    }

    // Auditoría
    async _registrarAuditoria(conn, username, exitoso, ip, userAgent) {
        try {
            await conn.query(
                'INSERT INTO login_auditoria (username, exitoso, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [username, exitoso ? 1 : 0, ip, userAgent]
            );
        } catch (e) {
            // No fallar por auditoría
        }
    }
}

module.exports = new AuthService();

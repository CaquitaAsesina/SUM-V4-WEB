const { Router } = require('express');
const authController = require('../controller/authController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

// Públicas
router.post('/login', (req, res) => authController.login(req, res));
router.post('/verify-token', (req, res) => authController.verifyToken(req, res));

// Protegidas (cualquier usuario logueado)
router.post('/cambiar-contrasena', authMiddleware, (req, res) => authController.cambiarContrasena(req, res));

// Solo admin
router.post('/usuarios', authMiddleware, adminMiddleware, (req, res) => authController.crearUsuario(req, res));
router.get('/usuarios', authMiddleware, adminMiddleware, (req, res) => authController.listarUsuarios(req, res));
router.delete('/usuarios/:userId', authMiddleware, adminMiddleware, (req, res) => authController.eliminarUsuario(req, res));
router.patch('/usuarios/:userId/toggle', authMiddleware, adminMiddleware, (req, res) => authController.toggleUsuario(req, res));

module.exports = router;

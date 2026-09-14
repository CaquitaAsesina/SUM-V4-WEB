const { Router } = require('express');
const auditController = require('../controller/auditController');
const { authMiddleware, adminMiddleware, registrosEditorMiddleware } = require('../middleware/auth');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// AREAS (solo admin)
router.get('/areas', (req, res) => auditController.listarAreas(req, res));
router.post('/areas', adminMiddleware, (req, res) => auditController.crearArea(req, res));
router.put('/areas/:id', adminMiddleware, (req, res) => { console.log('ROUTE editarArea params:', JSON.stringify(req.params), 'id raw:', req.params.id); auditController.editarArea(req, res); });
router.delete('/areas/:id', adminMiddleware, (req, res) => auditController.eliminarArea(req, res));

// PRODUCTOS (solo admin)
router.get('/productos', (req, res) => auditController.listarProductos(req, res));
router.post('/productos', adminMiddleware, (req, res) => auditController.crearProducto(req, res));
router.put('/productos/:id', adminMiddleware, (req, res) => auditController.editarProducto(req, res));
router.delete('/productos/:id', adminMiddleware, (req, res) => auditController.eliminarProducto(req, res));

// REGISTROS (cualquier usuario autenticado)
router.get('/registros', (req, res) => auditController.listarRegistros(req, res));
router.get('/registros/:id', (req, res) => auditController.obtenerRegistro(req, res));
router.post('/registros', (req, res) => auditController.crearRegistro(req, res));
// Crear varios registros a la vez (mismo área, N productos)
router.post('/registros/lote', (req, res) => auditController.crearRegistrosLote(req, res));
router.put('/registros/:id', registrosEditorMiddleware, (req, res) => auditController.editarRegistro(req, res));
router.delete('/registros/:id', registrosEditorMiddleware, (req, res) => auditController.eliminarRegistro(req, res));

module.exports = router;

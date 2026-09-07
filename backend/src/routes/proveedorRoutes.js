const { Router } = require('express');
const proveedorController = require('../controller/proveedorController');
const { authMiddleware, adminMiddleware, registrosEditorMiddleware } = require('../middleware/auth');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// PRODUCTOS DE PROVEEDOR (solo admin crea/edita/elimina)
router.get('/productos', (req, res) => proveedorController.listarProductos(req, res));
router.post('/productos', adminMiddleware, (req, res) => proveedorController.crearProducto(req, res));
router.put('/productos/:id', adminMiddleware, (req, res) => proveedorController.editarProducto(req, res));
router.delete('/productos/:id', adminMiddleware, (req, res) => proveedorController.eliminarProducto(req, res));

// PROVEEDORES (solo admin crea/edita/elimina)
router.get('/proveedores', (req, res) => proveedorController.listarProveedores(req, res));
router.post('/proveedores', adminMiddleware, (req, res) => proveedorController.crearProveedor(req, res));
router.put('/proveedores/:id', adminMiddleware, (req, res) => proveedorController.editarProveedor(req, res));
router.delete('/proveedores/:id', adminMiddleware, (req, res) => proveedorController.eliminarProveedor(req, res));

// REGISTROS (cualquiera registra/busca; edit/delete limitado)
router.get('/registros', (req, res) => proveedorController.listarRegistros(req, res));
router.get('/registros/:id', (req, res) => proveedorController.obtenerRegistro(req, res));
router.post('/registros', (req, res) => proveedorController.crearRegistro(req, res));
router.put('/registros/:id', registrosEditorMiddleware, (req, res) => proveedorController.editarRegistro(req, res));
router.delete('/registros/:id', registrosEditorMiddleware, (req, res) => proveedorController.eliminarRegistro(req, res));

module.exports = router;
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const proveedorRoutes = require('./src/routes/proveedorRoutes');
const inventarioRoutes = require('./src/routes/inventarioRoutes');
const codigoBarrasRoutes = require('./src/routes/codigoBarrasRoutes');
const initDatabase = require('./src/config/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// DEBUG: Log every request
app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.originalUrl} params:`, JSON.stringify(req.params));
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/codigos-barras', codigoBarrasRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, '..', 'frontend'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
    }
}));

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

async function start() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ No se pudo iniciar el servidor:', error.message);
        process.exit(1);
    }
}

start();

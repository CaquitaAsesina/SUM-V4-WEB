/* ============================================
   PROVEEDORES - JavaScript
   ============================================ */

window.addEventListener('error', (e) => {
    console.error('JS ERROR:', e.message, '| en:', e.filename, ':', e.lineno);
    const c = document.getElementById('toastContainer');
    if (c) showToast('Error JS: ' + e.message, 'error');
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('UNHANDLED REJECTION:', e.reason);
    showToast('Error JS (promesa): ' + ((e.reason && e.reason.message) || e.reason), 'error');
});

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
const esAdmin = user && user.rol === 'admin';
const puedeGestionarRegistros = !user || user.rol !== 'registrador';
let allProductos = [];
let allProveedores = [];
let allRegistros = [];

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', () => {
    if (!token || !user) { window.location.href = '../index.html'; return; }

    document.getElementById('userName').textContent = user.nombre_completo || user.username;
    setTimeout(() => document.getElementById('preloader').classList.add('loaded'), 600);

    window.addEventListener('scroll', () => {
        document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '../index.html';
    });

    // Tabs
    document.querySelectorAll('.module-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Productos
    document.getElementById('btnNuevoProducto').addEventListener('click', () => openProductoModal());
    document.getElementById('btnGuardarProducto').addEventListener('click', guardarProducto);

    // Proveedores
    document.getElementById('btnNuevoProveedor').addEventListener('click', () => openProveedorModal());
    document.getElementById('btnGuardarProveedor').addEventListener('click', guardarProveedor);

    // Registros
    document.getElementById('btnNuevoRegistro').addEventListener('click', () => openRegistroModal());
    document.getElementById('btnGuardarRegistro').addEventListener('click', guardarRegistro);
    document.getElementById('btnExportExcel').addEventListener('click', exportarExcel);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    document.getElementById('filterDesde').addEventListener('change', loadRegistros);
    document.getElementById('filterHasta').addEventListener('change', loadRegistros);
    document.getElementById('filterTipo').addEventListener('change', loadRegistros);
    document.getElementById('filterProveedor').addEventListener('change', loadRegistros);
    let searchTimer;
    document.getElementById('filterBuscar').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadRegistros, 300);
    });

    // Searchable selects
    initSearchableSelect('proveedorSearchInput', 'proveedorDropdown', 'registroProveedorId', () => allProveedores, 'nombre');
    initSearchableSelect('productoSearchInput', 'productoDropdown', 'registroProductoId', () => allProductos, 'nombre');

    if (!esAdmin) {
        document.getElementById('btnNuevoProducto').style.display = 'none';
        document.getElementById('btnNuevoProveedor').style.display = 'none';
        document.getElementById('thAccionesProductos').style.display = 'none';
        document.getElementById('thAccionesProveedores').style.display = 'none';
    }

    loadAll();
});

function switchTab(tab) {
    document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.module-tab[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.tab-content-section').forEach(s => s.classList.add('d-none'));
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.remove('d-none');

    if (tab === 'registros') loadRegistros(populateFilterProveedor);
}

async function api(url, options = {}) {
    console.log('[FRONTEND API] →', options.method || 'GET', url, options.body);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const fetchOptions = { ...options, headers };
    if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
    }
    const res = await fetch(url, fetchOptions);
    console.log('[FRONTEND API] ←', res.status, url);
    return res;
}

function cellTrunc(text) {
    const t = String(text ?? '');
    const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `<span class="cell-trunc" data-tooltip="${esc}">${esc}</span>`;
}

// ========================
// PRODUCTOS DE PROVEEDOR
// ========================
async function loadProductos() {
    try {
        const res = await api('/api/proveedores/productos');
        const data = await res.json();
        if (data.success) { allProductos = data.productos; renderProductos(allProductos); }
    } catch (e) { showToast('Error al cargar productos', 'error'); }
}

function renderProductos(productos) {
    const tbody = document.getElementById('productosTable');
    const empty = document.getElementById('emptyProductos');
    if (productos.length === 0) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');
    tbody.innerHTML = productos.map((p, i) => `
        <tr class="row-animate" style="animation-delay:${i * 0.05}s">
            <td><span class="badge bg-secondary">${p.id}</span></td>
            <td class="fw-semibold">${cellTrunc(p.nombre)}</td>
            <td class="text-secondary">${p.descripcion || '-'}</td>
            <td class="text-secondary">${new Date(p.created_at).toLocaleDateString()}</td>
            ${esAdmin ? `
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" title="Editar" onclick="editProducto(${p.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" title="Eliminar" onclick="deleteProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>` : ''}
        </tr>
    `).join('');
}

function openProductoModal(producto = null) {
    const isEdit = producto && typeof producto === 'object' && !(producto instanceof Event) && producto.id != null;
    document.getElementById('productoForm').reset();
    document.getElementById('productoId').value = '';
    if (isEdit) {
        document.getElementById('productoModalTitle').innerHTML = '<i class="bi bi-box-seam me-2"></i>Editar Producto';
        document.getElementById('productoId').value = producto.id;
        document.getElementById('productoNombre').value = producto.nombre;
        document.getElementById('productoDescripcion').value = producto.descripcion || '';
    } else {
        document.getElementById('productoModalTitle').innerHTML = '<i class="bi bi-box-seam me-2"></i>Nuevo Producto';
    }
    new bootstrap.Modal(document.getElementById('productoModal')).show();
}

function editProducto(id) {
    const prod = allProductos.find(p => p.id === id);
    if (prod) openProductoModal(prod);
}

async function guardarProducto() {
    const rawId = document.getElementById('productoId').value;
    const id = rawId && rawId !== 'undefined' && !isNaN(parseInt(rawId, 10)) ? parseInt(rawId, 10) : '';
    const nombre = document.getElementById('productoNombre').value.trim();
    const descripcion = document.getElementById('productoDescripcion').value.trim();

    if (nombre.length < 2) { showToast('El nombre debe tener al menos 2 caracteres', 'error'); return; }

    try {
        const url = id ? `/api/proveedores/productos/${id}` : '/api/proveedores/productos';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, { method, body: { nombre, descripcion } });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('productoModal')).hide();
            loadProductos();
        } else { showToast(data.message, 'error'); }
    } catch (e) { showToast('Error de conexión', 'error'); }
}

function deleteProducto(id, nombre) {
    openConfirm({
        title: '¿Eliminar producto?',
        message: `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        acceptText: 'Eliminar',
        acceptIcon: 'bi-trash',
        onConfirm: async () => {
            try {
                const res = await api(`/api/proveedores/productos/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) { showToast(data.message, 'success'); loadProductos(); }
                else { showToast(data.message, 'error'); }
            } catch (e) { showToast('Error de conexión', 'error'); }
        }
    });
}

// ========================
// PROVEEDORES
// ========================
async function loadProveedores() {
    try {
        const res = await api('/api/proveedores/proveedores');
        const data = await res.json();
        if (data.success) { allProveedores = data.proveedores; renderProveedores(allProveedores); populateFilterProveedor(); }
    } catch (e) { showToast('Error al cargar proveedores', 'error'); }
}

function renderProveedores(proveedores) {
    const tbody = document.getElementById('proveedoresTable');
    const empty = document.getElementById('emptyProveedores');
    if (proveedores.length === 0) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');
    tbody.innerHTML = proveedores.map((v, i) => `
        <tr class="row-animate" style="animation-delay:${i * 0.05}s">
            <td><span class="badge bg-secondary">${v.id}</span></td>
            <td class="fw-semibold">${v.nombre}</td>
            <td class="text-secondary">${v.descripcion || '-'}</td>
            <td class="text-secondary">${new Date(v.created_at).toLocaleDateString()}</td>
            ${esAdmin ? `
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" title="Editar" onclick="editProveedor(${v.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" title="Eliminar" onclick="deleteProveedor(${v.id}, '${v.nombre.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>` : ''}
        </tr>
    `).join('');
}

function openProveedorModal(proveedor = null) {
    const isEdit = proveedor && typeof proveedor === 'object' && !(proveedor instanceof Event) && proveedor.id != null;
    document.getElementById('proveedorForm').reset();
    document.getElementById('proveedorId').value = '';
    if (isEdit) {
        document.getElementById('proveedorModalTitle').innerHTML = '<i class="bi bi-truck me-2"></i>Editar Proveedor';
        document.getElementById('proveedorId').value = proveedor.id;
        document.getElementById('proveedorNombre').value = proveedor.nombre;
        document.getElementById('proveedorDescripcion').value = proveedor.descripcion || '';
    } else {
        document.getElementById('proveedorModalTitle').innerHTML = '<i class="bi bi-truck me-2"></i>Nuevo Proveedor';
    }
    new bootstrap.Modal(document.getElementById('proveedorModal')).show();
}

function editProveedor(id) {
    const prov = allProveedores.find(v => v.id === id);
    if (prov) openProveedorModal(prov);
}

async function guardarProveedor() {
    const rawId = document.getElementById('proveedorId').value;
    const id = rawId && rawId !== 'undefined' && !isNaN(parseInt(rawId, 10)) ? parseInt(rawId, 10) : '';
    const nombre = document.getElementById('proveedorNombre').value.trim();
    const descripcion = document.getElementById('proveedorDescripcion').value.trim();

    if (nombre.length < 2) { showToast('El nombre debe tener al menos 2 caracteres', 'error'); return; }

    try {
        const url = id ? `/api/proveedores/proveedores/${id}` : '/api/proveedores/proveedores';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, { method, body: { nombre, descripcion } });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('proveedorModal')).hide();
            loadProveedores();
        } else { showToast(data.message, 'error'); }
    } catch (e) { showToast('Error de conexión', 'error'); }
}

function deleteProveedor(id, nombre) {
    openConfirm({
        title: '¿Eliminar proveedor?',
        message: `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        acceptText: 'Eliminar',
        acceptIcon: 'bi-trash',
        onConfirm: async () => {
            try {
                const res = await api(`/api/proveedores/proveedores/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) { showToast(data.message, 'success'); loadProveedores(); }
                else { showToast(data.message, 'error'); }
            } catch (e) { showToast('Error de conexión', 'error'); }
        }
    });
}

// ========================
// REGISTROS
// ========================
function populateFilterProveedor() {
    const select = document.getElementById('filterProveedor');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Todos</option>' +
        allProveedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');
    select.value = current;
}

async function loadRegistros() {
    try {
        const params = new URLSearchParams();
        const desde = document.getElementById('filterDesde').value;
        const hasta = document.getElementById('filterHasta').value;
        const tipo = document.getElementById('filterTipo').value;
        const proveedorId = document.getElementById('filterProveedor').value;
        const buscar = document.getElementById('filterBuscar').value.trim();

        if (desde) params.set('fecha_desde', desde);
        if (hasta) params.set('fecha_hasta', hasta);
        if (tipo) params.set('tipo', tipo);
        if (proveedorId) params.set('proveedor_id', proveedorId);
        if (buscar) params.set('buscar', buscar);

        const res = await api(`/api/proveedores/registros?${params.toString()}`);
        const data = await res.json();
        if (data.success) { allRegistros = data.registros; renderRegistros(allRegistros); }
    } catch (e) { showToast('Error al cargar registros', 'error'); }
}

function tipoBadge(tipo) {
    if (tipo === 'entrega') return '<span class="badge badge-pill bg-success-soft text-success"><i class="bi bi-arrow-down-circle me-1"></i>Entrega</span>';
    return '<span class="badge badge-pill bg-danger-soft text-danger"><i class="bi bi-arrow-up-circle me-1"></i>Devolución</span>';
}

function renderRegistros(registros) {
    const tbody = document.getElementById('registrosTable');
    const empty = document.getElementById('emptyRegistros');
    if (registros.length === 0) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');
    tbody.innerHTML = registros.map((r, i) => `
        <tr class="row-animate" style="animation-delay:${i * 0.05}s">
            <td><span class="badge badge-pill bg-info-soft text-info">${r.guia}</span></td>
            <td class="fw-semibold">${r.placa}</td>
            <td class="fw-semibold">${r.proveedor_nombre}</td>
            <td>${cellTrunc(r.producto_nombre)}</td>
            <td class="text-center fw-bold">${r.cantidad}</td>
            <td>${tipoBadge(r.tipo)}</td>
            <td class="text-secondary">${formatDateTime(r.fecha)}</td>
            <td class="text-secondary">${formatDateTime(r.fecha_modificacion)}</td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" title="Ver" onclick="verRegistro(${r.id})"><i class="bi bi-eye"></i></button>
                    ${puedeGestionarRegistros ? `
                    <button class="btn btn-outline-warning" title="Editar" onclick="editRegistro(${r.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" title="Eliminar" onclick="deleteRegistro(${r.id}, '${r.guia}')"><i class="bi bi-trash"></i></button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function openRegistroModal(registro = null) {
    const isEdit = registro && typeof registro === 'object' && !(registro instanceof Event) && registro.id != null;
    document.getElementById('registroForm').reset();
    document.getElementById('registroId').value = '';
    document.getElementById('proveedorSearchInput').value = '';
    document.getElementById('productoSearchInput').value = '';
    document.getElementById('registroProveedorId').value = '';
    document.getElementById('registroProductoId').value = '';
    document.getElementById('registroTipo').value = 'entrega';

    if (isEdit) {
        document.getElementById('registroModalTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Registro';
        document.getElementById('registroId').value = registro.id;
        document.getElementById('registroProveedorId').value = registro.proveedor_id;
        document.getElementById('proveedorSearchInput').value = registro.proveedor_nombre;
        document.getElementById('registroProductoId').value = registro.producto_id;
        document.getElementById('productoSearchInput').value = registro.producto_nombre;
        document.getElementById('registroPlaca').value = registro.placa;
        document.getElementById('registroGuia').value = registro.guia;
        document.getElementById('registroCantidad').value = registro.cantidad;
        document.getElementById('registroTipo').value = registro.tipo;
    } else {
        document.getElementById('registroModalTitle').innerHTML = '<i class="bi bi-clipboard-plus me-2"></i>Nuevo Registro';
    }
    new bootstrap.Modal(document.getElementById('registroModal')).show();
}

async function editRegistro(id) {
    try {
        const res = await api(`/api/proveedores/registros/${id}`);
        const data = await res.json();
        if (data.success) openRegistroModal(data.registro);
        else showToast(data.message, 'error');
    } catch (e) { showToast('Error de conexión', 'error'); }
}

async function verRegistro(id) {
    try {
        const res = await api(`/api/proveedores/registros/${id}`);
        const data = await res.json();
        if (!data.success) { showToast(data.message, 'error'); return; }
        const r = data.registro;
        document.getElementById('verGuia').textContent = r.guia;
        document.getElementById('verPlaca').textContent = r.placa;
        document.getElementById('verProveedor').textContent = r.proveedor_nombre;
        document.getElementById('verProducto').textContent = r.producto_nombre;
        document.getElementById('verCantidad').textContent = r.cantidad;
        document.getElementById('verTipo').textContent = r.tipo === 'entrega' ? 'Entrega' : 'Devolución';
        document.getElementById('verFecha').textContent = formatDateTime(r.fecha);
        document.getElementById('verFechaMod').textContent = formatDateTime(r.fecha_modificacion);
        new bootstrap.Modal(document.getElementById('verRegistroModal')).show();
    } catch (e) { showToast('Error de conexión', 'error'); }
}

async function guardarRegistro() {
    const rawId = document.getElementById('registroId').value;
    const id = rawId && rawId !== 'undefined' && !isNaN(parseInt(rawId, 10)) ? parseInt(rawId, 10) : '';
    const proveedorId = parseInt(document.getElementById('registroProveedorId').value);
    const productoId = parseInt(document.getElementById('registroProductoId').value);
    const placa = document.getElementById('registroPlaca').value.trim().toUpperCase();
    const guia = document.getElementById('registroGuia').value.trim();
    const cantidad = parseInt(document.getElementById('registroCantidad').value);
    const tipo = document.getElementById('registroTipo').value;

    if (!proveedorId) { showToast('Seleccione un proveedor', 'error'); return; }
    if (!productoId) { showToast('Seleccione un producto', 'error'); return; }
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(placa)) { showToast('La placa debe tener el formato XXX-XXX', 'error'); return; }
    if (!/^\d+$/.test(guia)) { showToast('El número de guía debe contener solo números', 'error'); return; }
    if (!cantidad || cantidad < 1) { showToast('La cantidad debe ser al menos 1', 'error'); return; }

    try {
        const url = id ? `/api/proveedores/registros/${id}` : '/api/proveedores/registros';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, { method, body: { proveedor_id: proveedorId, producto_id: productoId, placa, guia, cantidad, tipo } });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('registroModal')).hide();
            loadRegistros();
        } else { showToast(data.message, 'error'); }
    } catch (e) { showToast('Error de conexión', 'error'); }
}

function deleteRegistro(id, guia) {
    openConfirm({
        title: '¿Eliminar registro?',
        message: `Se eliminará el registro de guía "${guia}". Esta acción no se puede deshacer.`,
        acceptText: 'Eliminar',
        acceptIcon: 'bi-trash',
        onConfirm: async () => {
            try {
                const res = await api(`/api/proveedores/registros/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) { showToast(data.message, 'success'); loadRegistros(); }
                else { showToast(data.message, 'error'); }
            } catch (e) { showToast('Error de conexión', 'error'); }
        }
    });
}

// ========================
// SEARCHABLE SELECTS
// ========================
function initSearchableSelect(inputId, dropdownId, hiddenId, getItemsFn, labelKey) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const hidden = document.getElementById(hiddenId);

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        const items = getItemsFn();
        if (q.length === 0) { dropdown.classList.add('d-none'); return; }

        const filtered = items.filter(item => item[labelKey].toLowerCase().includes(q));
        if (filtered.length === 0) { dropdown.classList.add('d-none'); return; }

        dropdown.innerHTML = filtered.map(item => `
            <div class="searchable-item" data-id="${item.id}" data-name="${item[labelKey]}">
                <span>${item[labelKey]}</span>
            </div>
        `).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.searchable-item').forEach(el => {
            el.addEventListener('click', () => {
                hidden.value = el.dataset.id;
                input.value = el.dataset.name;
                dropdown.classList.add('d-none');
            });
        });
    });

    input.addEventListener('focus', () => {
        if (input.value.trim().length > 0) {
            input.dispatchEvent(new Event('input'));
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('d-none');
        }
    });
}

// ========================
// FILTROS
// ========================
function limpiarFiltros() {
    document.getElementById('filterDesde').value = '';
    document.getElementById('filterHasta').value = '';
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterProveedor').value = '';
    document.getElementById('filterBuscar').value = '';
    loadRegistros();
}

// ========================
// EXCEL EXPORT
// ========================
function exportarExcel() {
    if (allRegistros.length === 0) { showToast('No hay registros para exportar', 'info'); return; }

    const data = allRegistros.map(r => ({
        'N° Guía': r.guia,
        'Placa': r.placa,
        'Proveedor': r.proveedor_nombre,
        'Producto': r.producto_nombre,
        'Cantidad': r.cantidad,
        'Tipo': r.tipo === 'entrega' ? 'Entrega' : 'Devolución',
        'Fecha': formatDateTime(r.fecha),
        'Modificado': formatDateTime(r.fecha_modificacion)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');

    ws['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 30 },
        { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 }
    ];

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    XLSX.writeFile(wb, `proveedores_registros_${dateStr}.xlsx`);
    showToast('Excel exportado correctamente', 'success');
}

// ========================
// UTILITIES
// ========================
function formatDateTime(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    if (isNaN(d)) return '-';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
}

function loadAll() {
    Promise.all([loadProductos(), loadProveedores()]).then(() => {
        loadRegistros();
    });
}

// Normaliza la placa mientras se escribe (auto-guion)
document.addEventListener('DOMContentLoaded', () => {
    const placaInput = document.getElementById('registroPlaca');
    if (placaInput) {
        placaInput.addEventListener('input', () => {
            let val = placaInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
            if (val.length > 3 && val[3] !== '-') val = val.slice(0, 3) + '-' + val.slice(3);
            placaInput.value = val.slice(0, 7);
        });
    }
});
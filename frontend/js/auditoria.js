/* ============================================
   AUDITORÍA - JavaScript
   ============================================ */

window.addEventListener('error', (e) => {
    console.error('JS ERROR:', e.message, '| en:', e.filename, ':', e.lineno);
    const c = document.getElementById('toastContainer');
    if (c) {
        showToast('Error JS: ' + e.message, 'error');
    }
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('UNHANDLED REJECTION:', e.reason);
    showToast('Error JS (promesa): ' + (e.reason && e.reason.message || e.reason), 'error');
});

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
const esAdmin = user && user.rol === 'admin';
const puedeGestionarRegistros = !user || user.rol !== 'registrador';
let allAreas = [];
let allProductos = [];
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

    // Áreas
    document.getElementById('btnNuevaArea').addEventListener('click', () => openAreaModal());
    document.getElementById('btnGuardarArea').addEventListener('click', guardarArea);

    // Productos
    document.getElementById('btnNuevoProducto').addEventListener('click', () => openProductoModal());
    document.getElementById('btnGuardarProducto').addEventListener('click', guardarProducto);

    // Registros
    document.getElementById('btnNuevoRegistro').addEventListener('click', () => openRegistroModal());
    document.getElementById('btnGuardarRegistro').addEventListener('click', guardarRegistro);
    document.getElementById('btnExportExcel').addEventListener('click', exportarExcel);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    document.getElementById('filterDesde').addEventListener('change', loadRegistros);
    document.getElementById('filterHasta').addEventListener('change', loadRegistros);
    document.getElementById('filterArea').addEventListener('change', loadRegistros);
    let searchTimer;
    document.getElementById('filterBuscar').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadRegistros, 300);
    });
    initSearchableSelect('areaSearchInput', 'areaDropdown', 'registroAreaId', () => allAreas, 'nombre');
    initSearchableSelect('productoSearchInput', 'productoDropdown', 'registroProductoId', () => allProductos, 'nombre', true);

    // Restricciones por rol
    if (!esAdmin) {
        document.getElementById('btnNuevaArea').style.display = 'none';
        document.getElementById('btnNuevoProducto').style.display = 'none';
        document.getElementById('thAccionesAreas').style.display = 'none';
        document.getElementById('thAccionesProductos').style.display = 'none';
    }

    // Load data
    loadAll();
});

function switchTab(tab) {
    document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.module-tab[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.tab-content-section').forEach(s => s.classList.add('d-none'));
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.remove('d-none');

    if (tab === 'registros') loadRegistros();
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
// ÁREAS
// ========================
async function loadAreas() {
    try {
        const res = await api('/api/audit/areas');
        const data = await res.json();
        if (data.success) {
            allAreas = data.areas;
            renderAreas(allAreas);
            populateAreaFilter(allAreas);
        }
    } catch (e) { showToast('Error al cargar áreas', 'error'); }
}

function renderAreas(areas) {
    const tbody = document.getElementById('areasTable');
    const empty = document.getElementById('emptyAreas');
    if (areas.length === 0) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');
    tbody.innerHTML = areas.map((a, i) => `
        <tr class="row-animate" style="animation-delay:${i * 0.05}s">
            <td><span class="badge bg-secondary">${a.id}</span></td>
            <td class="fw-semibold">${a.nombre}</td>
            <td class="text-secondary">${a.descripcion || '-'}</td>
            <td class="text-secondary">${new Date(a.created_at).toLocaleDateString()}</td>
            ${esAdmin ? `
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" title="Editar" onclick="editArea(${a.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" title="Eliminar" onclick="deleteArea(${a.id}, '${a.nombre.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>` : ''}
        </tr>
    `).join('');
}

function openAreaModal(area = null) {
    const isEdit = area && typeof area === 'object' && !(area instanceof Event) && area.id != null;
    document.getElementById('areaForm').reset();
    document.getElementById('areaId').value = '';
    if (isEdit) {
        document.getElementById('areaModalTitle').innerHTML = '<i class="bi bi-building me-2"></i>Editar Área';
        document.getElementById('areaId').value = area.id;
        document.getElementById('areaNombre').value = area.nombre;
        document.getElementById('areaDescripcion').value = area.descripcion || '';
    } else {
        document.getElementById('areaModalTitle').innerHTML = '<i class="bi bi-building me-2"></i>Nueva Área';
    }
    new bootstrap.Modal(document.getElementById('areaModal')).show();
}

function editArea(id) {
    const area = allAreas.find(a => a.id === id);
    if (area) openAreaModal(area);
}

async function guardarArea() {
    const rawId = document.getElementById('areaId').value;
    const id = rawId && rawId !== 'undefined' && !isNaN(parseInt(rawId, 10)) ? parseInt(rawId, 10) : '';
    const nombre = document.getElementById('areaNombre').value.trim();
    const descripcion = document.getElementById('areaDescripcion').value.trim();

    if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }

    try {
        const url = id ? `/api/audit/areas/${id}` : '/api/audit/areas';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, { method, body: { nombre, descripcion } });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('areaModal')).hide();
            loadAreas();
        } else { console.error('Crear area response:', data); showToast(data.detail || data.message, 'error'); }
    } catch (e) { console.error('Guardar area error:', e); showToast('Error al guardar: ' + e.message, 'error'); }
}

function deleteArea(id, nombre) {
    openConfirm({
        title: '¿Eliminar área?',
        message: `Se eliminará "${nombre}". Esta acción no se puede deshacer.`,
        acceptText: 'Eliminar',
        acceptIcon: 'bi-trash',
        onConfirm: async () => {
            try {
                const res = await api(`/api/audit/areas/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) { showToast(data.message, 'success'); loadAreas(); }
                else { showToast(data.message, 'error'); }
            } catch (e) { showToast('Error de conexión', 'error'); }
        }
    });
}

// ========================
// PRODUCTOS
// ========================
async function loadProductos() {
    try {
        const res = await api('/api/audit/productos');
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
            <td><span class="badge badge-pill bg-info-soft text-info">${p.sku}</span></td>
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
        document.getElementById('productoSku').value = producto.sku;
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
    const sku = document.getElementById('productoSku').value.trim();

    if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
    if (!sku) { showToast('El SKU es obligatorio', 'error'); return; }

    try {
        const url = id ? `/api/audit/productos/${id}` : '/api/audit/productos';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, { method, body: { nombre, sku } });
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
                const res = await api(`/api/audit/productos/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) { showToast(data.message, 'success'); loadProductos(); }
                else { showToast(data.message, 'error'); }
            } catch (e) { showToast('Error de conexión', 'error'); }
        }
    });
}

// ========================
// REGISTROS
// ========================
async function loadRegistros() {
    try {
        const params = new URLSearchParams();
        const desde = document.getElementById('filterDesde').value;
        const hasta = document.getElementById('filterHasta').value;
        const areaId = document.getElementById('filterArea').value;
        const buscar = document.getElementById('filterBuscar').value.trim();

        if (desde) params.set('fecha_desde', desde);
        if (hasta) params.set('fecha_hasta', hasta);
        if (areaId) params.set('area_id', areaId);
        if (buscar) params.set('buscar', buscar);

        const res = await api(`/api/audit/registros?${params.toString()}`);
        const data = await res.json();
        if (data.success) { allRegistros = data.registros; renderRegistros(allRegistros); }
    } catch (e) { showToast('Error al cargar registros', 'error'); }
}

function renderRegistros(registros) {
    const tbody = document.getElementById('registrosTable');
    const empty = document.getElementById('emptyRegistros');
    if (registros.length === 0) { tbody.innerHTML = ''; empty.classList.remove('d-none'); return; }
    empty.classList.add('d-none');
    tbody.innerHTML = registros.map((r, i) => `
        <tr class="row-animate" style="animation-delay:${i * 0.05}s">
            <td><span class="badge badge-pill bg-info-soft text-info">${r.codigo}</span></td>
            <td class="fw-semibold">${r.area_nombre}</td>
            <td><span class="badge bg-secondary">${r.sku}</span></td>
            <td>${cellTrunc(r.producto_nombre)}</td>
            <td class="text-center fw-bold">${r.cantidad}</td>
            <td class="text-secondary">${formatDateTime(r.fecha)}</td>
            <td class="text-secondary">${formatDateTime(r.fecha_modificacion)}</td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" title="Ver" onclick="verRegistro(${r.id})"><i class="bi bi-eye"></i></button>
                    ${puedeGestionarRegistros ? `
                    <button class="btn btn-outline-warning" title="Editar" onclick="editRegistro(${r.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" title="Eliminar" onclick="deleteRegistro(${r.id}, '${r.codigo}')"><i class="bi bi-trash"></i></button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function openRegistroModal(registro = null) {
    const isEdit = registro && typeof registro === 'object' && !(registro instanceof Event) && registro.id != null;
    document.getElementById('registroForm').reset();
    document.getElementById('registroId').value = '';
    document.getElementById('registroSku').value = '';
    document.getElementById('areaSearchInput').value = '';
    document.getElementById('productoSearchInput').value = '';
    document.getElementById('registroAreaId').value = '';
    document.getElementById('registroProductoId').value = '';

    if (isEdit) {
        document.getElementById('registroModalTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Registro';
        document.getElementById('registroId').value = registro.id;
        document.getElementById('registroAreaId').value = registro.area_id;
        document.getElementById('areaSearchInput').value = registro.area_nombre;
        document.getElementById('registroProductoId').value = registro.producto_id;
        document.getElementById('productoSearchInput').value = registro.producto_nombre;
        document.getElementById('registroSku').value = registro.sku;
        document.getElementById('registroCantidad').value = registro.cantidad;
    } else {
        document.getElementById('registroModalTitle').innerHTML = '<i class="bi bi-clipboard-plus me-2"></i>Nuevo Registro';
    }
    new bootstrap.Modal(document.getElementById('registroModal')).show();
}

async function editRegistro(id) {
    try {
        const res = await api(`/api/audit/registros/${id}`);
        const data = await res.json();
        if (data.success) openRegistroModal(data.registro);
        else showToast(data.message, 'error');
    } catch (e) { showToast('Error de conexión', 'error'); }
}

async function verRegistro(id) {
    try {
        const res = await api(`/api/audit/registros/${id}`);
        const data = await res.json();
        if (!data.success) { showToast(data.message, 'error'); return; }
        const r = data.registro;
        document.getElementById('verCodigo').textContent = r.codigo;
        document.getElementById('verArea').textContent = r.area_nombre;
        document.getElementById('verSku').textContent = r.sku;
        document.getElementById('verProducto').textContent = r.producto_nombre;
        document.getElementById('verCantidad').textContent = r.cantidad;
        document.getElementById('verFecha').textContent = formatDateTime(r.fecha);
        document.getElementById('verFechaMod').textContent = formatDateTime(r.fecha_modificacion);
        new bootstrap.Modal(document.getElementById('verRegistroModal')).show();
    } catch (e) { showToast('Error de conexión', 'error'); }
}

async function guardarRegistro() {
    const rawId = document.getElementById('registroId').value;
    const id = rawId && rawId !== 'undefined' && !isNaN(parseInt(rawId, 10)) ? parseInt(rawId, 10) : '';
    const areaId = parseInt(document.getElementById('registroAreaId').value);
    const productoId = parseInt(document.getElementById('registroProductoId').value);
    const cantidad = parseInt(document.getElementById('registroCantidad').value);

    if (!areaId) { showToast('Seleccione un área', 'error'); return; }
    if (!productoId) { showToast('Seleccione un producto', 'error'); return; }
    if (!cantidad || cantidad < 1) { showToast('La cantidad debe ser al menos 1', 'error'); return; }

    try {
        const url = id ? `/api/audit/registros/${id}` : '/api/audit/registros';
        const method = id ? 'PUT' : 'POST';
        const res = await api(url, { method, body: { area_id: areaId, producto_id: productoId, cantidad } });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('registroModal')).hide();
            loadRegistros();
        } else { showToast(data.message, 'error'); }
    } catch (e) { showToast('Error de conexión', 'error'); }
}

function deleteRegistro(id, codigo) {
    openConfirm({
        title: '¿Eliminar registro?',
        message: `Se eliminará el registro "${codigo}". Esta acción no se puede deshacer.`,
        acceptText: 'Eliminar',
        acceptIcon: 'bi-trash',
        onConfirm: async () => {
            try {
                const res = await api(`/api/audit/registros/${id}`, { method: 'DELETE' });
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
function initSearchableSelect(inputId, dropdownId, hiddenId, getItemsFn, labelKey, autoSku = false) {
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
            <div class="searchable-item" data-id="${item.id}" data-name="${item[labelKey]}" data-sku="${item.sku || ''}">
                <span>${item[labelKey]}</span>
                ${item.sku ? `<small class="text-secondary">${item.sku}</small>` : ''}
            </div>
        `).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.searchable-item').forEach(el => {
            el.addEventListener('click', () => {
                hidden.value = el.dataset.id;
                input.value = el.dataset.name;
                dropdown.classList.add('d-none');
                if (autoSku) {
                    document.getElementById('registroSku').value = el.dataset.sku;
                }
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
function populateAreaFilter(areas) {
    const select = document.getElementById('filterArea');
    const current = select.value;
    select.innerHTML = '<option value="">Todas las áreas</option>' +
        areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
    select.value = current;
}

function limpiarFiltros() {
    document.getElementById('filterDesde').value = '';
    document.getElementById('filterHasta').value = '';
    document.getElementById('filterArea').value = '';
    document.getElementById('filterBuscar').value = '';
    loadRegistros();
}

// ========================
// EXCEL EXPORT
// ========================
function exportarExcel() {
    if (allRegistros.length === 0) { showToast('No hay registros para exportar', 'info'); return; }

    const data = allRegistros.map(r => ({
        'Código': r.codigo,
        'Área': r.area_nombre,
        'SKU': r.sku,
        'Producto': r.producto_nombre,
        'Cantidad': r.cantidad,
        'Fecha': formatDateTime(r.fecha),
        'Modificado': formatDateTime(r.fecha_modificacion)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');

    ws['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
        { wch: 10 }, { wch: 20 }, { wch: 20 }
    ];

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
    XLSX.writeFile(wb, `auditoria_registros_${dateStr}.xlsx`);
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
    Promise.all([loadAreas(), loadProductos()]).then(() => {
        loadRegistros();
    });
}

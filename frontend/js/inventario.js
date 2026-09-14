/* ============================================
   INVENTARIO - JavaScript
   Importar CSV (cabeceras dinámicas, cualquier cantidad de columnas),
   editar/eliminar registros, cerrar inventario y exportar CSV.
   ============================================ */

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
const puedeGestionarRegistros = !user || user.rol !== 'registrador';

let allRegistros = [];
let inventarioActual = null;
let archivoSeleccionado = null; // File (Excel o CSV)
let activeFilters = {};     // { índiceColumna: texto } filtros por columna
let filteredRegistros = []; // registros que cumplen los filtros activos

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

    document.querySelectorAll('.module-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.getElementById('btnImportar').addEventListener('click', openImportModal);
    document.getElementById('csvFile').addEventListener('change', onFileSelected);
    document.getElementById('btnConfirmImport').addEventListener('click', importarCSV);
    document.getElementById('btnCerrar').addEventListener('click', cerrarInventario);
    document.getElementById('btnExportar').addEventListener('click', exportarCSV);
    document.getElementById('btnGuardarEdicion').addEventListener('click', guardarEdicion);

    // Filtros por columna (delegación de eventos sobre el thead)
    document.getElementById('inventarioHead').addEventListener('input', onFilterInput);
    document.getElementById('inventarioHead').addEventListener('click', (e) => {
        if (e.target.closest('[data-action="clear-filters"]')) clearFilters();
    });

    cargarInventario();
});

function switchTab(tab) {
    document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.module-tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (target) target.classList.remove('d-none');
}

async function api(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const fetchOptions = { ...options, headers };
    if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
    }
    const res = await fetch(url, fetchOptions);
    return res;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function cellTrunc(text) {
    const t = String(text ?? '');
    const esc = escapeHtml(t);
    return `<span class="cell-trunc" data-tooltip="${esc}">${esc}</span>`;
}

// ========================
// CABECERAS DINÁMICAS
// ========================
function getHeaders() {
    if (!inventarioActual) return [];
    let cols = inventarioActual.columnas;
    if (typeof cols === 'string') {
        try { cols = JSON.parse(cols); } catch (e) { cols = []; }
    }
    return Array.isArray(cols) ? cols : [];
}

// ========================
// CARGA PRINCIPAL
// ========================
async function cargarInventario() {
    try {
        const res = await api('/api/inventario');
        const data = await res.json();
        if (data.success) {
            inventarioActual = data.inventario;
            allRegistros = data.registros || [];
            renderHead();
            applyFilters(); // aplica los filtros activos y renderiza
        } else {
            showToast(data.message || 'Error al cargar inventario', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

function actualizarBarra() {
    const countBadge = document.getElementById('invCount');
    const colsBadge = document.getElementById('invCols');
    const statusBadge = document.getElementById('invStatus');
    const btnCerrar = document.getElementById('btnCerrar');
    const btnExportar = document.getElementById('btnExportar');
    const btnImportar = document.getElementById('btnImportar');
    const hint = document.getElementById('invHint');

    const cerrado = inventarioActual && inventarioActual.estado === 'cerrado';
    const hayInventario = !!inventarioActual;
    const headers = getHeaders();

    const hayFiltros = Object.keys(activeFilters).length > 0;
    countBadge.textContent = hayFiltros
        ? `${filteredRegistros.length} de ${allRegistros.length} registros`
        : `${allRegistros.length} registros`;

    if (hayInventario && headers.length > 0) {
        colsBadge.classList.remove('d-none');
        colsBadge.textContent = `${headers.length} columnas`;
    } else {
        colsBadge.classList.add('d-none');
    }

    if (cerrado) {
        statusBadge.classList.remove('d-none');
        statusBadge.className = 'badge badge-pill ms-1 bg-danger-soft text-danger';
        statusBadge.textContent = 'CERRADO';
    } else if (hayInventario) {
        statusBadge.classList.remove('d-none');
        statusBadge.className = 'badge badge-pill ms-1 bg-success-soft text-success';
        statusBadge.textContent = 'ABIERTO';
    } else {
        statusBadge.classList.add('d-none');
    }

    btnCerrar.disabled = !(hayInventario && !cerrado);
    btnExportar.disabled = !cerrado;
    btnImportar.disabled = hayInventario && !cerrado;

    if (!hayInventario) {
        hint.innerHTML = '<i class="bi bi-info-circle me-1"></i>Importe un archivo Excel o CSV: la primera fila será la cabecera (cualquier cantidad de columnas). La exportación se habilita al cerrar el inventario.';
    } else if (cerrado) {
        hint.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Inventario cerrado. Puede exportarlo en CSV o importar uno nuevo.';
    } else {
        hint.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Inventario abierto: puede editar o eliminar registros. Al presionar "Cerrar Inventario" se habilitará la exportación.';
    }
}

// ========================
// RENDER TABLA
// ========================
function renderHead() {
    const thead = document.getElementById('inventarioHead');
    const headers = getHeaders();
    if (headers.length === 0) {
        thead.innerHTML = '';
        return;
    }
    const ths = headers.map(h => `<th>${escapeHtml(h).toUpperCase()}</th>`).join('');
    const thAcciones = `<th class="text-center">ACCIONES</th>`;

    // Fila de filtros: un input por columna dinámica
    const filterInputs = headers.map((h, idx) => {
        const val = escapeHtml(activeFilters[idx] ?? '');
        const active = activeFilters[idx] ? ' has-value' : '';
        return `<th><input type="text" class="filter-input${active}" data-col="${idx}" value="${val}" placeholder="Filtrar..." spellcheck="false" autocomplete="off"></th>`;
    }).join('');

    const hayFiltros = Object.keys(activeFilters).length > 0;
    const clearCell = `<th class="text-center th-filter-clear">
        <button class="btn btn-outline-celeste btn-sm py-0 px-2${hayFiltros ? '' : ' d-none'}" data-action="clear-filters" title="Limpiar todos los filtros">
            <i class="bi bi-x-lg me-1"></i>Limpiar
        </button>
    </th>`;

    thead.innerHTML = `
        <tr><th class="th-rownum">#</th>${ths}${thAcciones}</tr>
        <tr class="tr-filters">
            <th class="th-rownum" title="Filtros por columna"><i class="bi bi-funnel"></i></th>
            ${filterInputs}
            ${clearCell}
        </tr>`;

    // Fijar la fila de filtros justo debajo de la cabecera (altura real medida)
    requestAnimationFrame(() => {
        const firstRow = thead.rows[0];
        const filterRow = thead.rows[1];
        if (firstRow && filterRow) {
            filterRow.style.top = `${firstRow.offsetHeight}px`;
        }
    });
}

// ========================
// FILTROS POR COLUMNA
// ========================
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
const debouncedApplyFilters = debounce(applyFilters, 250);

function onFilterInput(e) {
    const input = e.target.closest('.filter-input');
    if (!input) return;

    const col = input.dataset.col;
    const val = input.value;
    if (val.trim() === '') delete activeFilters[col];
    else activeFilters[col] = val;

    input.classList.toggle('has-value', val.trim() !== '');
    toggleClearButton();
    debouncedApplyFilters();
}

function applyFilters() {
    const filtros = Object.entries(activeFilters)
        .filter(([, v]) => String(v).trim() !== '')
        .map(([idx, v]) => ({ idx: Number(idx), val: String(v).trim().toLowerCase() }));

    if (filtros.length === 0) {
        filteredRegistros = [...allRegistros];
    } else {
        filteredRegistros = allRegistros.filter(r => {
            let datos = r.datos;
            if (typeof datos === 'string') {
                try { datos = JSON.parse(datos); } catch (e) { datos = []; }
            }
            if (!Array.isArray(datos)) datos = [];
            // Todas las condiciones deben cumplirse (AND entre columnas)
            return filtros.every(f =>
                String(datos[f.idx] ?? '').toLowerCase().includes(f.val)
            );
        });
    }

    renderRegistros(filteredRegistros);
    actualizarBarra();
}

function toggleClearButton() {
    const btn = document.querySelector('[data-action="clear-filters"]');
    if (btn) btn.classList.toggle('d-none', Object.keys(activeFilters).length === 0);
}

function clearFilters() {
    activeFilters = {};
    renderHead();
    applyFilters();
}

function renderRegistros(registros) {
    const tbody = document.getElementById('inventarioTable');
    const empty = document.getElementById('emptyInventario');
    const headers = getHeaders();

    if (registros.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('d-none');
        const emptyText = document.getElementById('emptyText');
        if (allRegistros.length > 0) {
            emptyText.innerHTML = 'Ningún registro coincide con los filtros aplicados. <a href="#" onclick="clearFilters(); return false;">Limpiar filtros</a>';
        } else {
            emptyText.textContent = 'No hay inventario importado';
        }
        actualizarBarra();
        return;
    }
    empty.classList.add('d-none');

    const cerrado = inventarioActual && inventarioActual.estado === 'cerrado';
    const puedeGestionar = !cerrado && puedeGestionarRegistros;

    tbody.innerHTML = registros.map((r, i) => {
        let datos = r.datos;
        if (typeof datos === 'string') {
            try { datos = JSON.parse(datos); } catch (e) { datos = []; }
        }
        if (!Array.isArray(datos)) datos = [];

        const tds = datos.map(d => {
            const esNumero = /^-?\s*[\d.,]+\s*$/.test(String(d ?? '').trim()) && /\d/.test(String(d ?? ''));
            return `<td class="${esNumero ? 'cell-num' : ''}">${cellTrunc(d)}</td>`;
        }).join('');
        const acciones = puedeGestionar ? `
            <td class="text-center td-acciones">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" title="Ver" onclick="verRegistro(${r.id})"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-outline-warning" title="Editar" onclick="editRegistro(${r.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" title="Eliminar" onclick="deleteRegistro(${r.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>` : `
            <td class="text-center td-acciones">
                <button class="btn btn-outline-info btn-sm" title="Ver" onclick="verRegistro(${r.id})"><i class="bi bi-eye"></i></button>
            </td>`;
        return `<tr class="row-animate" style="animation-delay:${Math.min(i, 20) * 0.03}s">
            <td class="td-rownum">${i + 1}</td>${tds}${acciones}
        </tr>`;
    }).join('');
}

// ========================
// IMPORTAR (Excel o CSV, cualquier cantidad de columnas)
// ========================
function openImportModal() {
    archivoSeleccionado = null;
    document.getElementById('csvFile').value = '';
    document.getElementById('csvFileInfo').textContent = '';
    document.getElementById('btnConfirmImport').disabled = true;
    document.getElementById('importError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('importModal')).show();
}

function onFileSelected(e) {
    const file = e.target.files[0];
    const info = document.getElementById('csvFileInfo');
    const errorDiv = document.getElementById('importError');
    errorDiv.classList.add('d-none');

    if (!file) {
        archivoSeleccionado = null;
        document.getElementById('btnConfirmImport').disabled = true;
        info.textContent = '';
        return;
    }

    archivoSeleccionado = file;
    document.getElementById('btnConfirmImport').disabled = false;
    info.textContent = `${file.name} — ${(file.size / 1024).toFixed(1)} KB`;
}

// Convierte cualquier Excel (.xlsx/.xls/.xlsm/.xlsb) o CSV a texto CSV
// usando la primera hoja. El backend detecta el delimitador automáticamente.
async function fileToCsvText(file) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Librería de Excel no disponible (revisar conexión).');
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('El archivo no contiene hojas con datos.');
    // Salida con separador coma; el backend lo detecta y las celdas con coma van entre comillas
    return XLSX.utils.sheet_to_csv(ws, { blankrows: false });
}

async function importarCSV() {
    if (!archivoSeleccionado) {
        showToast('Seleccione un archivo Excel o CSV', 'error');
        return;
    }

    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Procesando...';

    try {
        const contenido = await fileToCsvText(archivoSeleccionado);
        if (!contenido || contenido.trim() === '') {
            const errorDiv = document.getElementById('importError');
            document.getElementById('importErrorText').textContent = 'El archivo no contiene datos en su primera hoja.';
            errorDiv.classList.remove('d-none');
            return;
        }

        const res = await api('/api/inventario/importar', {
            method: 'POST',
            body: { archivo: archivoSeleccionado.name, contenido }
        });
        const data = await res.json();
        const errorDiv = document.getElementById('importError');
        const errorText = document.getElementById('importErrorText');

        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
            showToast(data.message, 'success');
            cargarInventario();
        } else {
            errorText.textContent = data.message;
            errorDiv.classList.remove('d-none');
        }
    } catch (e) {
        const errorDiv = document.getElementById('importError');
        document.getElementById('importErrorText').textContent = 'No se pudo leer el archivo. Verifique que sea un Excel o CSV válido.';
        errorDiv.classList.remove('d-none');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-upload me-1"></i>Importar';
    }
}

// ========================
// EDITAR REGISTRO (campos dinámicos)
// ========================
function editRegistro(id) {
    const r = allRegistros.find(x => x.id === id);
    if (!r) return;

    let datos = r.datos;
    if (typeof datos === 'string') {
        try { datos = JSON.parse(datos); } catch (e) { datos = []; }
    }
    if (!Array.isArray(datos)) datos = [];

    const headers = getHeaders();
    const container = document.getElementById('editCamposContainer');
    document.getElementById('editRegistroId').value = r.id;

    container.innerHTML = headers.map((h, idx) => `
        <div class="col-md-6 ${headers.length <= 3 ? 'col-12' : ''}">
            <label for="editCampo${idx}" class="form-label">${escapeHtml(h)}</label>
            <input type="text" class="form-control" id="editCampo${idx}" value="${escapeHtml(datos[idx] ?? '')}">
        </div>
    `).join('');

    new bootstrap.Modal(document.getElementById('editarRegistroModal')).show();
}

async function guardarEdicion() {
    const id = document.getElementById('editRegistroId').value;
    if (!id) return;

    const headers = getHeaders();
    const datos = headers.map((h, idx) => {
        const input = document.getElementById(`editCampo${idx}`);
        return input ? input.value.trim() : '';
    });

    try {
        const res = await api(`/api/inventario/registros/${id}`, { method: 'PUT', body: datos });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('editarRegistroModal')).hide();
            cargarInventario();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

// ========================
// VER / ELIMINAR REGISTRO
// ========================
function verRegistro(id) {
    const r = allRegistros.find(x => x.id === id);
    if (!r) return;

    let datos = r.datos;
    if (typeof datos === 'string') {
        try { datos = JSON.parse(datos); } catch (e) { datos = []; }
    }
    if (!Array.isArray(datos)) datos = [];

    const headers = getHeaders();
    const container = document.getElementById('verCamposContainer');

    container.innerHTML = headers.map((h, idx) => `
        <div class="col-md-6">
            <div class="detail-item">
                <span class="detail-label">${escapeHtml(h)}</span>
                <span class="detail-value">${escapeHtml(datos[idx] ?? '-')}</span>
            </div>
        </div>
    `).join('');

    new bootstrap.Modal(document.getElementById('verRegistroModal')).show();
}

function deleteRegistro(id) {
    openConfirm({
        title: '¿Eliminar registro?',
        message: 'Se eliminará esta fila del inventario. Esta acción no se puede deshacer.',
        acceptText: 'Eliminar',
        acceptIcon: 'bi-trash',
        onConfirm: async () => {
            try {
                const res = await api(`/api/inventario/registros/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    cargarInventario();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (e) {
                showToast('Error de conexión', 'error');
            }
        }
    });
}

// ========================
// CERRAR INVENTARIO
// ========================
function cerrarInventario() {
    openConfirm({
        title: '¿Cerrar inventario?',
        message: 'Una vez cerrado no podrá editar ni eliminar registros. Solo podrá exportarlo en CSV.',
        acceptText: 'Cerrar Inventario',
        acceptIcon: 'bi-lock-fill',
        acceptClass: 'btn-danger',
        onConfirm: async () => {
            try {
                const res = await api('/api/inventario/cerrar', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    cargarInventario();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (e) {
                showToast('Error de conexión', 'error');
            }
        }
    });
}

// ========================
// EXPORTAR CSV
// ========================
async function exportarCSV() {
    if (!inventarioActual || inventarioActual.estado !== 'cerrado') {
        showToast('Debe cerrar el inventario antes de exportar', 'error');
        return;
    }
    try {
        const res = await api('/api/inventario/exportar');
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showToast(data.message || 'No se pudo exportar el inventario', 'error');
            return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : `inventario_${Date.now()}.csv`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Inventario exportado correctamente', 'success');
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

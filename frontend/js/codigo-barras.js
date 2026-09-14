/* ============================================
   CÓDIGOS DE BARRAS - JavaScript
   Importar Excel de CUALQUIER estructura (todas las
   columnas se muestran), elegir con un clic qué columna
   se usa para generar códigos CODE128 (JsBarcode),
   exportar PDF (jsPDF) y Excel (ExcelJS con imágenes).
   Los registros se PERSISTEN en el backend
   (/api/codigos-barras): sobreviven a recargas de página
   y cada importación REEMPLAZA al lote anterior.
   ============================================ */

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

let headers = [];        // cabeceras de las columnas del archivo
let codigoRows = [];     // [{ datos: [...], codigo: '', barDataUrl: 'data:image/png...' | null, error: null | 'msg' }]
let colCodigo = 0;       // índice de la columna usada para generar los códigos
let archivoNombre = null; // nombre original del archivo importado

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
    document.getElementById('excelFile').addEventListener('change', onFileSelected);
    document.getElementById('btnConfirmImport').addEventListener('click', cargarExcel);
    document.getElementById('btnGenerar').addEventListener('click', generarCodigos);
    document.getElementById('btnExportarPdf').addEventListener('click', exportarPDF);
    document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
    document.getElementById('btnLimpiar').addEventListener('click', limpiarCodigos);

    // Clic en una cabecera = usar esa columna para los códigos de barras
    document.getElementById('barrasHead').addEventListener('click', (e) => {
        const th = e.target.closest('th.th-col');
        if (!th) return;
        const idx = Number(th.dataset.col);
        if (isNaN(idx) || idx === colCodigo) return;
        selectColumna(idx);
    });

    // Cargar el lote persistido en el backend (sobrevive recargas)
    cargarCodigos();
});

async function api(url, options = {}) {
    const headersOpt = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    const fetchOptions = { ...options, headers: headersOpt };
    if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
    }
    const res = await fetch(url, fetchOptions);
    return res;
}

// ========================
// CARGA DESDE EL BACKEND (lote persistido)
// ========================
async function cargarCodigos() {
    try {
        const res = await api('/api/codigos-barras');
        const data = await res.json();
        if (data.success) {
            headers = [];
            colCodigo = 0;
            archivoNombre = null;
            codigoRows = [];

            if (data.lote) {
                let cols = data.lote.columnas;
                if (typeof cols === 'string') {
                    try { cols = JSON.parse(cols); } catch (e) { cols = []; }
                }
                headers = Array.isArray(cols) ? cols : [];
                colCodigo = data.lote.col_codigo || 0;
                archivoNombre = data.lote.nombre || null;

                codigoRows = (data.registros || []).map(r => {
                    let datos = r.datos;
                    if (typeof datos === 'string') {
                        try { datos = JSON.parse(datos); } catch (e) { datos = []; }
                    }
                    if (!Array.isArray(datos)) datos = [];
                    return { id: r.id, datos, codigo: r.codigo ?? datos[colCodigo] ?? '', barDataUrl: null, barBigUrl: null, error: null };
                });
            }

            // Los códigos de barras se regeneran con "Generar" (no se persisten las imágenes)
            document.getElementById('btnExportarPdf').disabled = true;
            document.getElementById('btnExportarExcel').disabled = true;
            render();
        } else {
            showToast(data.message || 'Error al cargar los códigos', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

// ========================
// LIMPIAR: elimina todo el lote (backend + vista)
// ========================
function limpiarCodigos() {
    if (codigoRows.length === 0) {
        showToast('No hay códigos que limpiar', 'info');
        return;
    }
    openConfirm({
        title: '¿Limpiar códigos?',
        message: `Se eliminarán los ${codigoRows.length} registros importados. Esta acción no se puede deshacer.`,
        acceptText: 'Limpiar',
        acceptIcon: 'bi-eraser-fill',
        onConfirm: async () => {
            try {
                const res = await api('/api/codigos-barras', { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                    await cargarCodigos();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (e) {
                showToast('Error de conexión', 'error');
            }
        }
    });
}

function switchTab(tab) {
    document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.module-tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (target) target.classList.remove('d-none');
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ========================
// IMPORTAR EXCEL (cualquier cantidad de columnas)
// ========================
function openImportModal() {
    document.getElementById('excelFile').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('btnConfirmImport').disabled = true;
    document.getElementById('importError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('importModal')).show();
}

function onFileSelected(e) {
    const file = e.target.files[0];
    const info = document.getElementById('fileInfo');

    document.getElementById('importError').classList.add('d-none');
    if (!file) {
        document.getElementById('btnConfirmImport').disabled = true;
        info.textContent = '';
        return;
    }
    info.textContent = `${file.name} — ${(file.size / 1024).toFixed(1)} KB`;
    document.getElementById('btnConfirmImport').disabled = false;
}

async function cargarExcel() {
    const input = document.getElementById('excelFile');
    const file = input.files[0];
    if (!file) return;

    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Cargando...';

    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // Todas las filas como arrays de celdas
        const filas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });

        const dataRows = filas.filter(f => f.some(c => c !== null && String(c).trim() !== ''));
        if (dataRows.length === 0) {
            showImportError('El archivo no contiene datos.');
            return;
        }

        // Normalizar celdas: números sin notación científica (ej. EAN leídos como número)
        const normalizar = v => typeof v === 'number'
            ? (Number.isInteger(v) ? v.toFixed(0) : String(v))
            : String(v ?? '').trim();
        const filasNorm = dataRows.map(f => f.map(normalizar));

        const maxCols = Math.max(...filasNorm.map(f => f.length));

        // Cabeceras: si la primera fila no tiene dígitos en ninguna celda, es cabecera
        const primera = filasNorm[0];
        const esCabecera = !primera.some(c => /\d/.test(c));
        headers = esCabecera
            ? primera.map((c, i) => c || `COLUMNA ${i + 1}`)
            : primera.map((_, i) => `COLUMNA ${i + 1}`);
        while (headers.length < maxCols) headers.push(`COLUMNA ${headers.length + 1}`);

        const filasDatos = (esCabecera ? filasNorm.slice(1) : filasNorm).map(f => {
            const a = [...f];
            while (a.length < maxCols) a.push('');
            return a;
        });

        if (filasDatos.length === 0) {
            showImportError('El archivo solo contiene una cabecera, sin datos.');
            return;
        }

        // Enviar al backend: cada importación REEMPLAZA el lote anterior
        const res = await api('/api/codigos-barras/importar', {
            method: 'POST',
            body: { archivo: file.name.replace(/\.(xlsx|xls|csv)$/i, ''), filas: filasDatos, headers }
        });
        const data = await res.json();
        if (!data.success) {
            showImportError(data.message || 'No se pudo importar el archivo.');
            return;
        }

        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
        await cargarCodigos(); // recargar desde el backend (lote nuevo)
        showToast(`${codigoRows.length} filas y ${headers.length} columnas cargadas de ${file.name}. Presione "Generar".`, 'success');
    } catch (err) {
        showImportError('No se pudo leer el archivo. Verifique que sea un Excel o CSV válido.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-upload me-1"></i>Cargar';
    }
}

function showImportError(msg) {
    document.getElementById('importErrorText').textContent = msg;
    document.getElementById('importError').classList.remove('d-none');
}

// ========================
// SELECCIÓN DE COLUMNA PARA EL CÓDIGO
// ========================
async function selectColumna(idx) {
    // Persistir la columna elegida en el backend
    try {
        const res = await api('/api/codigos-barras/columna', {
            method: 'PUT',
            body: { col: idx }
        });
        const data = await res.json();
        if (!data.success) {
            showToast(data.message, 'error');
            return;
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
        return;
    }

    colCodigo = idx;
    // Cambiar de columna invalida los códigos ya generados
    codigoRows.forEach(r => {
        r.codigo = r.datos[colCodigo] ?? '';
        r.barDataUrl = null;
        r.barBigUrl = null;
        r.error = null;
    });
    document.getElementById('btnExportarPdf').disabled = true;
    document.getElementById('btnExportarExcel').disabled = true;
    render();
    showToast(`Columna "${headers[colCodigo]}" seleccionada para generar los códigos. Presione "Generar".`, 'info');
}

// ========================
// GENERAR CÓDIGOS DE BARRAS
// ========================
async function generarCodigos() {
    if (codigoRows.length === 0) return;

    const btn = document.getElementById('btnGenerar');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Generando...';

    const progress = document.getElementById('genProgress');
    const progressBar = document.getElementById('genProgressBar');
    progress.classList.remove('d-none');

    let errores = 0;
    for (let i = 0; i < codigoRows.length; i++) {
        const row = codigoRows[i];
        if (!row.codigo) {
            row.barDataUrl = null;
            row.error = 'Vacío';
            errores++;
        } else {
            try {
                // Generar el código como SVG y convertirlo a PNG para poder embeberlo en PDF/Excel
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                JsBarcode(svg, row.codigo, {
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 14,
                    margin: 4
                });
                row.barDataUrl = await svgToPngDataUrl(svg);
                row.error = null;
            } catch (e) {
                row.barDataUrl = null;
                row.error = 'No válido';
                errores++;
            }
        }

        // Actualizar progreso cada 10 filas o al final
        if (i % 10 === 0 || i === codigoRows.length - 1) {
            progressBar.style.width = `${((i + 1) / codigoRows.length) * 100}%`;
            renderTableRows();
            await new Promise(r => setTimeout(r, 0)); // ceder el hilo para que la UI respire
        }
    }

    progress.classList.add('d-none');
    progressBar.style.width = '0%';
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-magic me-1"></i>Generar';

    document.getElementById('btnExportarPdf').disabled = false;
    document.getElementById('btnExportarExcel').disabled = false;

    if (errores > 0) {
        showToast(`${codigoRows.length - errores} códigos generados. ${errores} celdas vacías o no válidas para CODE128.`, 'info');
    } else {
        showToast(`${codigoRows.length} códigos generados correctamente`, 'success');
    }
}

// Convierte el SVG generado por JsBarcode a PNG data URL (necesario para PDF/Excel)
function svgToPngDataUrl(svg) {
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    return new Promise((resolve, reject) => {
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2; // 2x para nitidez en impresión
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;base64,' + svg64;
    });
}

// ========================
// RENDER
// ========================
function render() {
    renderHead();
    renderTableRows();
    actualizarBarra();
}

function renderHead() {
    const thead = document.getElementById('barrasHead');
    if (headers.length === 0) {
        thead.innerHTML = '';
        return;
    }
    const ths = headers.map((h, idx) => {
        const sel = idx === colCodigo ? ' th-col-selected' : '';
        return `<th class="th-col text-nowrap${sel}" data-col="${idx}" title="Clic para usar esta columna como código de barras">
            <i class="bi bi-upc-scan col-pick-icon${idx === colCodigo ? ' text-info' : ' opacity-25'}"></i>${escapeHtml(h).toUpperCase()}
        </th>`;
    }).join('');
    thead.innerHTML = `
        <tr>
            <th class="th-rownum">#</th>
            ${ths}
            <th class="text-center">CÓDIGO DE BARRAS</th>
        </tr>`;
}

function renderTableRows() {
    const tbody = document.getElementById('barrasTable');
    const empty = document.getElementById('emptyBarras');

    if (codigoRows.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('d-none');
        return;
    }
    empty.classList.add('d-none');

    tbody.innerHTML = codigoRows.map((r, i) => {
        const tds = r.datos.map((d, ci) => {
            const esNumero = /^-?\s*[\d.,]+\s*$/.test(String(d ?? '').trim()) && /\d/.test(String(d ?? ''));
            const sel = ci === colCodigo ? ' td-col-selected' : '';
            return `<td class="${esNumero ? 'cell-num' : ''}${sel}">${escapeHtml(d)}</td>`;
        }).join('');
        const barCell = r.barDataUrl
            ? `<div class="barcode-cell"><img src="${r.barDataUrl}" alt="${escapeHtml(r.codigo)}" style="height:44px"></div>`
            : (r.error
                ? `<span class="badge bg-danger-soft text-danger" title="${escapeHtml(r.error)}">${escapeHtml(r.error)}</span>`
                : `<span class="barcode-pending"><i class="bi bi-hourglass-split me-1"></i>Pendiente</span>`);
        return `<tr>
            <td class="td-rownum">${i + 1}</td>
            ${tds}
            <td class="text-center">${barCell}</td>
        </tr>`;
    }).join('');
}

function actualizarBarra() {
    const countBadge = document.getElementById('barCount');
    const sourceBadge = document.getElementById('barSource');
    const btnGenerar = document.getElementById('btnGenerar');
    const btnLimpiar = document.getElementById('btnLimpiar');

    const generados = codigoRows.filter(r => r.barDataUrl).length;
    countBadge.textContent = codigoRows.length === 0
        ? '0 códigos'
        : (generados > 0 ? `${generados} de ${codigoRows.length} generados` : `${codigoRows.length} filas`);

    if (archivoNombre) {
        sourceBadge.classList.remove('d-none');
        sourceBadge.textContent = archivoNombre;
    } else {
        sourceBadge.classList.add('d-none');
    }

    btnGenerar.disabled = codigoRows.length === 0;
    btnLimpiar.disabled = codigoRows.length === 0;
}

// ========================
// ETIQUETAS: código de barras GRANDE + su código debajo
// (como etiqueta física: barcode arriba, texto grande abajo)
// ========================
// PNG grande de alta resolución para etiquetas (se genera bajo demanda y se cachea)
async function getBigBarcode(row) {
    if (row.barBigUrl) return row.barBigUrl;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, row.codigo, {
        format: 'CODE128',
        width: 3,
        height: 110,
        displayValue: false, // el texto se dibuja aparte, grande y en negrita
        margin: 6
    });
    row.barBigUrl = await svgToPngDataUrl(svg);
    return row.barBigUrl;
}

function cargarImagen(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// ========================
// EXPORTAR PDF — etiquetas: 2 columnas × 4 filas por A4,
// cada etiqueta con el código de barras grande y su código debajo en negrita
// ========================
async function exportarPDF() {
    if (codigoRows.length === 0) return;
    const validos = codigoRows.filter(r => r.barDataUrl);
    if (validos.length === 0) {
        showToast('No hay códigos generados. Presione "Generar" primero.', 'info');
        return;
    }

    const btn = document.getElementById('btnExportarPdf');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Exportando...';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const pageW = 210, pageH = 297;
        const mx = 8, my = 10;            // márgenes de página
        const cols = 2, rowsPage = 4;      // 8 etiquetas por página
        const gapX = 4, gapY = 4;
        const labelW = (pageW - mx * 2 - gapX * (cols - 1)) / cols;   // ~95 mm
        const labelH = (pageH - my * 2 - gapY * (rowsPage - 1)) / rowsPage; // ~68 mm

        let enPagina = 0;
        let primera = true;

        for (let i = 0; i < validos.length; i++) {
            const row = validos[i];
            const bigUrl = await getBigBarcode(row);
            const img = await cargarImagen(bigUrl);
            if (!img) continue;

            if (enPagina === 0) {
                if (!primera) doc.addPage();
                primera = false;
            }

            const col = enPagina % cols;
            const fil = Math.floor(enPagina / cols);
            const x = mx + col * (labelW + gapX);
            const y = my + fil * (labelH + gapY);

            // Bordes de corte de la etiqueta
            doc.setDrawColor(180);
            doc.setLineWidth(0.2);
            doc.rect(x, y, labelW, labelH);

            // Imagen del código: ancho casi total de la etiqueta, respetando proporción
            const ratio = img.naturalWidth / img.naturalHeight;
            const imgW = labelW - 12;
            let imgH = imgW / ratio;
            const maxImgH = labelH - 26;
            if (imgH > maxImgH) { imgH = maxImgH; }
            const imgX = x + (labelW - imgW) / 2;
            const imgY = y + 5;
            doc.addImage(img, 'PNG', imgX, imgY, imgW, imgH);

            // Código debajo, grande y en negrita (como la etiqueta física)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(0);
            doc.text(row.codigo, x + labelW / 2, y + 5 + imgH + 10, { align: 'center' });

            enPagina++;
            if (enPagina >= cols * rowsPage) enPagina = 0;
            if (i % 8 === 7) await new Promise(r => setTimeout(r, 0)); // no congelar la UI
        }

        doc.save(`codigos_barras_${archivoNombre || Date.now()}.pdf`);
        showToast(`PDF con ${validos.length} etiquetas exportado (8 por página)`, 'success');
    } catch (e) {
        showToast('Error al generar el PDF', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>Exportar PDF';
    }
}

// ========================
// EXPORTAR EXCEL — una etiqueta por fila:
// código en letra grande y negrita + imagen del código de barras grande al lado
// ========================
async function exportarExcel() {
    if (codigoRows.length === 0) return;
    const validos = codigoRows.filter(r => r.barDataUrl);
    if (validos.length === 0) {
        showToast('No hay códigos generados. Presione "Generar" primero.', 'info');
        return;
    }

    const btn = document.getElementById('btnExportarExcel');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Exportando...';

    try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Códigos de Barras');

        ws.columns = [
            { header: 'CÓDIGO', key: 'codigo', width: 38 },
            { header: 'CÓDIGO DE BARRAS', key: 'barcode', width: 75 }
        ];
        ws.getRow(1).font = { bold: true, size: 12, color: { argb: 'FF0369A1' } };
        ws.getRow(1).height = 24;

        for (let i = 0; i < validos.length; i++) {
            const r = validos[i];
            const row = ws.addRow({ codigo: r.codigo });
            row.height = 100;

            // Código en grande y negrita, centrado vertical y horizontal
            const cell = row.getCell('codigo');
            cell.font = { bold: true, size: 18, color: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Imagen grande del código de barras, manteniendo proporción
            const bigUrl = await getBigBarcode(r);
            const img = await cargarImagen(bigUrl);
            if (img) {
                const ratio = img.naturalWidth / img.naturalHeight;
                const h = 95;
                let w = h * ratio;
                if (w > 520) w = 520;
                const imgId = wb.addImage({ base64: bigUrl, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: 1.05, colOff: 0, row: row.number - 1 + 0.06, rowOff: 0 },
                    ext: { width: Math.round(w), height: Math.round(h) }
                });
            }
            // Ceder el hilo cada 10 filas para no congelar la UI
            if (i % 10 === 0) await new Promise(res => setTimeout(res, 0));
        }

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codigos_barras_${archivoNombre || Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Excel con ${validos.length} etiquetas exportado correctamente`, 'success');
    } catch (e) {
        showToast('Error al generar el Excel', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-file-earmark-excel me-1"></i>Exportar Excel';
    }
}

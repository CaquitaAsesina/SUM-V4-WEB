const pool = require('../config/database');

// Delimitadores soportados: coma, punto y coma, tabulador y pipe
const DELIMITADORES = [',', ';', '\t', '|'];

// Detecta el delimitador real del archivo analizando las primeras líneas:
// cuenta cuántas veces aparece cada candidato FUERA de comillas y elige el más frecuente
function detectarDelimitador(text) {
    const src = String(text).replace(/^\uFEFF/, '');
    const lineas = src.split(/\r?\n/).filter(l => l.trim() !== '').slice(0, 5);
    const conteo = {};
    for (const d of DELIMITADORES) conteo[d] = 0;

    for (const linea of lineas) {
        let inQuotes = false;
        for (let i = 0; i < linea.length; i++) {
            const ch = linea[i];
            if (ch === '"') {
                if (inQuotes && linea[i + 1] === '"') i++;
                else inQuotes = !inQuotes;
            } else if (!inQuotes && conteo.hasOwnProperty(ch)) {
                conteo[ch]++;
            }
        }
    }

    let mejor = ',';
    let maxCount = 0;
    for (const d of DELIMITADORES) {
        if (conteo[d] > maxCount) {
            maxCount = conteo[d];
            mejor = d;
        }
    }
    return mejor;
}

// Parseador CSV robusto: soporta comillas dobles, delimitadores dentro de comillas,
// comillas escapadas ("") y saltos de línea dentro de celdas
function parseCSV(text, delimiter = ',') {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const src = String(text).replace(/^\uFEFF/, ''); // quitar BOM

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];

        if (inQuotes) {
            if (ch === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                row.push(field); field = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && src[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.length > 1 || row[0] !== '') rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        if (row.length > 1 || row[0] !== '') rows.push(row);
    }
    return rows;
}

class InventarioService {
    // ========================
    // IMPORTAR CSV (cualquier cantidad de columnas,
    // delimitador detectado automáticamente: , ; tab |)
    // La primera fila del archivo se usa como cabeceras
    // ========================
    async importarCSV(nombreArchivo, csvText, usuario) {
        if (!csvText || !csvText.trim()) {
            return { success: false, message: 'El archivo está vacío' };
        }

        // Regla de negocio: mientras haya un inventario abierto no se importa otro
        const [abiertos] = await pool.query(
            "SELECT id FROM inv_inventarios WHERE estado = 'abierto' LIMIT 1"
        );
        if (abiertos.length > 0) {
            return {
                success: false,
                message: 'Ya existe un inventario abierto. Debe cerrarlo antes de importar otro.'
            };
        }

        const delimitador = detectarDelimitador(csvText);
        const rows = parseCSV(csvText, delimitador);
        if (rows.length === 0) {
            return { success: false, message: 'El archivo no contiene filas' };
        }

        // Cabeceras: primera fila del archivo, tal como viene (solo se recorta espacios)
        let headers = rows[0].map(h => String(h ?? '').trim());
        // Cabeceras vacías se renombran automáticamente
        headers = headers.map((h, idx) => h !== '' ? h : `COLUMNA ${idx + 1}`);

        const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
        if (dataRows.length === 0) {
            return { success: false, message: 'El archivo no contiene registros de datos' };
        }

        // Si alguna fila de datos tiene más celdas que la cabecera,
        // se agregan cabeceras extra para no perder información
        const maxCells = dataRows.reduce((max, r) => Math.max(max, r.length), headers.length);
        while (headers.length < maxCells) {
            headers.push(`COLUMNA ${headers.length + 1}`);
        }

        // Normalizar filas: siempre exactamente headers.length celdas
        let datos = dataRows.map(r => {
            const fila = [];
            for (let i = 0; i < headers.length; i++) {
                fila.push(String(r[i] ?? '').trim());
            }
            return fila;
        });

        // Limpieza: si la última columna quedó vacía en TODAS las filas
        // (típico cuando el archivo termina con el delimitador), se descarta
        while (headers.length > 1) {
            const last = headers.length - 1;
            const headerAuto = headers[last] === `COLUMNA ${last + 1}`;
            const todaVacia = datos.every(f => f[last] === '');
            if (headerAuto && todaVacia) {
                headers.pop();
                datos = datos.map(f => f.slice(0, -1));
            } else {
                break;
            }
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [invResult] = await conn.query(
                'INSERT INTO inv_inventarios (nombre, columnas, total_columnas, total_registros, importado_por, estado, delimitador) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    nombreArchivo || `Inventario ${new Date().toLocaleDateString()}`,
                    JSON.stringify(headers),
                    headers.length,
                    datos.length,
                    usuario || null,
                    'abierto',
                    delimitador === '\t' ? '\\t' : delimitador
                ]
            );
            const inventarioId = invResult.insertId;

            const values = datos.map((fila, idx) => [inventarioId, idx + 1, JSON.stringify(fila)]);
            await conn.query(
                'INSERT INTO inv_registros (inventario_id, fila, datos) VALUES ?',
                [values]
            );

            await conn.commit();
            return {
                success: true,
                message: `Inventario importado: ${datos.length} registros, ${headers.length} columnas`,
                inventarioId,
                total: datos.length,
                columnas: headers.length
            };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    // ========================
    // INVENTARIO ACTUAL
    // ========================
    async obtenerActual() {
        const [invs] = await pool.query(
            'SELECT * FROM inv_inventarios ORDER BY id DESC LIMIT 1'
        );
        return invs.length > 0 ? invs[0] : null;
    }

    // ========================
    // REGISTROS DEL INVENTARIO ACTIVO
    // ========================
    async listarRegistros() {
        const inventario = await this.obtenerActual();
        if (!inventario) return { inventario: null, registros: [] };

        const [registros] = await pool.query(
            'SELECT * FROM inv_registros WHERE inventario_id = ? ORDER BY fila ASC, id ASC',
            [inventario.id]
        );

        // mysql2 devuelve la columna JSON ya parseada; normalizar a array
        const normalizados = registros.map(r => {
            let datos = r.datos;
            if (typeof datos === 'string') {
                try { datos = JSON.parse(datos); } catch (e) { datos = []; }
            }
            if (!Array.isArray(datos)) datos = [];
            return { ...r, datos };
        });

        return { inventario, registros: normalizados };
    }

    // ========================
    // EDITAR UN REGISTRO (fila completa como array)
    // ========================
    async editarRegistro(id, datos) {
        const [reg] = await pool.query('SELECT id, inventario_id FROM inv_registros WHERE id = ?', [id]);
        if (reg.length === 0) {
            return { success: false, message: 'Registro no encontrado' };
        }

        const [inv] = await pool.query('SELECT estado, total_columnas FROM inv_inventarios WHERE id = ?', [reg[0].inventario_id]);
        if (inv.length === 0) {
            return { success: false, message: 'Inventario no encontrado' };
        }
        if (inv[0].estado === 'cerrado') {
            return { success: false, message: 'El inventario está cerrado. No se pueden editar registros.' };
        }

        if (!Array.isArray(datos)) {
            return { success: false, message: 'Datos inválidos' };
        }

        // Ajustar a la cantidad de columnas del inventario
        const totalCols = inv[0].total_columnas || 0;
        const fila = [];
        for (let i = 0; i < totalCols; i++) {
            fila.push(String(datos[i] ?? '').trim());
        }

        await pool.query('UPDATE inv_registros SET datos = ? WHERE id = ?', [JSON.stringify(fila), id]);
        return { success: true, message: 'Registro actualizado correctamente' };
    }

    // ========================
    // ELIMINAR UN REGISTRO
    // ========================
    async eliminarRegistro(id) {
        const [reg] = await pool.query('SELECT id, inventario_id FROM inv_registros WHERE id = ?', [id]);
        if (reg.length === 0) {
            return { success: false, message: 'Registro no encontrado' };
        }

        const [inv] = await pool.query('SELECT estado FROM inv_inventarios WHERE id = ?', [reg[0].inventario_id]);
        if (inv.length === 0) {
            return { success: false, message: 'Inventario no encontrado' };
        }
        if (inv[0].estado === 'cerrado') {
            return { success: false, message: 'El inventario está cerrado. No se pueden eliminar registros.' };
        }

        await pool.query('DELETE FROM inv_registros WHERE id = ?', [id]);

        // Recalcular total del inventario
        await pool.query(
            'UPDATE inv_inventarios SET total_registros = (SELECT COUNT(*) FROM inv_registros WHERE inventario_id = ?) WHERE id = ?',
            [reg[0].inventario_id, reg[0].inventario_id]
        );

        return { success: true, message: 'Registro eliminado correctamente' };
    }

    // ========================
    // CERRAR INVENTARIO
    // ========================
    async cerrarInventario() {
        const inventario = await this.obtenerActual();
        if (!inventario) {
            return { success: false, message: 'No hay ningún inventario para cerrar' };
        }
        if (inventario.estado === 'cerrado') {
            return { success: false, message: 'El inventario ya está cerrado' };
        }

        await pool.query(
            "UPDATE inv_inventarios SET estado = 'cerrado', fecha_cierre = NOW() WHERE id = ?",
            [inventario.id]
        );
        return { success: true, message: 'Inventario cerrado correctamente. Ya puede exportarlo.' };
    }

    // ========================
    // EXPORTAR CSV (solo si está cerrado)
    // Usa las cabeceras y el delimitador del propio inventario
    // ========================
    async exportarCSV() {
        const inventario = await this.obtenerActual();
        if (!inventario) {
            return { success: false, message: 'No hay ningún inventario para exportar' };
        }
        if (inventario.estado !== 'cerrado') {
            return { success: false, message: 'Debe cerrar el inventario antes de poder exportarlo' };
        }

        let headers = inventario.columnas;
        if (typeof headers === 'string') {
            try { headers = JSON.parse(headers); } catch (e) { headers = []; }
        }
        if (!Array.isArray(headers)) headers = [];

        const delimitador = inventario.delimitador === '\\t' ? '\t' : (inventario.delimitador || ',');

        const [registros] = await pool.query(
            'SELECT datos FROM inv_registros WHERE inventario_id = ? ORDER BY fila ASC, id ASC',
            [inventario.id]
        );

        const esc = (v) => {
            const s = String(v ?? '');
            if (s.includes('"') || s.includes(delimitador) || /[\n\r]/.test(s)) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };

        const lines = [headers.map(h => esc(h)).join(delimitador)];
        for (const r of registros) {
            let datos = r.datos;
            if (typeof datos === 'string') {
                try { datos = JSON.parse(datos); } catch (e) { datos = []; }
            }
            if (!Array.isArray(datos)) datos = [];
            lines.push(datos.map(d => esc(d)).join(delimitador));
        }

        // BOM UTF-8 para que Excel respete acentos
        const csv = '\uFEFF' + lines.join('\n');
        return {
            success: true,
            csv,
            filename: `inventario_${inventario.id}_${new Date().toISOString().slice(0, 10)}.csv`
        };
    }
}

module.exports = new InventarioService();

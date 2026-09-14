const pool = require('../config/database');

// Delimitadores soportados: coma, punto y coma, tabulador y pipe
const DELIMITADORES = [',', ';', '\t', '|'];

// Detecta el delimitador real del CSV (mismo criterio que inventarioService)
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

// Parseador CSV robusto (mismo criterio que inventarioService)
function parseCSV(text, delimiter = ',') {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const src = String(text).replace(/^\uFEFF/, '');

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

// Normaliza valores del Excel a texto (sin notación científica)
function normalizar(v) {
    if (typeof v === 'number') {
        return Number.isInteger(v) ? v.toFixed(0) : String(v);
    }
    return String(v ?? '').trim();
}

class CodigoBarrasService {
    // ========================
    // IMPORTAR: reemplaza SIEMPRE el lote anterior
    // (borra el anterior y guarda el nuevo en una transacción)
    // ========================
    async importar(nombreArchivo, filas, headersEntrada, usuario) {
        if (!Array.isArray(filas) || filas.length === 0) {
            return { success: false, message: 'El archivo no contiene filas de datos' };
        }

        // Cabeceras: vienen del cliente (detectadas del archivo) o se autogeneran
        const maxCols = filas.reduce((m, f) => Math.max(m, f.length), 0);
        let headers = Array.isArray(headersEntrada) && headersEntrada.length > 0
            ? headersEntrada.map((h, i) => String(h ?? '').trim() || `COLUMNA ${i + 1}`)
            : [];
        while (headers.length < maxCols) headers.push(`COLUMNA ${headers.length + 1}`);
        headers = headers.slice(0, maxCols);

        // Normalizar filas al ancho de cabeceras
        const datos = filas.map(f => {
            const fila = [];
            for (let i = 0; i < headers.length; i++) fila.push(normalizar(f[i]));
            return fila;
        });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Cada importación reemplaza al lote anterior
            await conn.query('DELETE FROM cod_registros');
            await conn.query('DELETE FROM cod_codigos');

            const [result] = await conn.query(
                'INSERT INTO cod_codigos (nombre, columnas, total_columnas, total_registros, col_codigo, importado_por) VALUES (?, ?, ?, ?, 0, ?)',
                [
                    nombreArchivo || `Códigos ${new Date().toLocaleDateString()}`,
                    JSON.stringify(headers),
                    headers.length,
                    datos.length,
                    usuario || null
                ]
            );
            const loteId = result.insertId;

            const values = datos.map((fila, idx) => [loteId, idx + 1, fila[0] || '', JSON.stringify(fila)]);
            await conn.query(
                'INSERT INTO cod_registros (lote_id, fila, codigo, datos) VALUES ?',
                [values]
            );

            await conn.commit();
            return {
                success: true,
                message: `Importado: ${datos.length} filas, ${headers.length} columnas (lote anterior reemplazado)`,
                loteId,
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
    // LOTE ACTUAL + REGISTROS
    // ========================
    async obtenerActual() {
        const [lotes] = await pool.query('SELECT * FROM cod_codigos ORDER BY id DESC LIMIT 1');
        return lotes.length > 0 ? lotes[0] : null;
    }

    async listar() {
        const lote = await this.obtenerActual();
        if (!lote) return { lote: null, registros: [] };

        const [registros] = await pool.query(
            'SELECT id, fila, codigo, datos FROM cod_registros WHERE lote_id = ? ORDER BY fila ASC, id ASC',
            [lote.id]
        );

        const normalizados = registros.map(r => {
            let datos = r.datos;
            if (typeof datos === 'string') {
                try { datos = JSON.parse(datos); } catch (e) { datos = []; }
            }
            if (!Array.isArray(datos)) datos = [];
            return { ...r, datos };
        });

        return { lote, registros: normalizados };
    }

    // ========================
    // CAMBIAR LA COLUMNA USADA PARA LOS CÓDIGOS
    // ========================
    async actualizarColumna(colCodigo, usuario) {
        const idx = parseInt(colCodigo, 10);
        if (isNaN(idx) || idx < 0) {
            return { success: false, message: 'Índice de columna inválido' };
        }

        const lote = await this.obtenerActual();
        if (!lote) return { success: false, message: 'No hay códigos importados' };

        if (idx >= lote.total_columnas) {
            return { success: false, message: 'La columna seleccionada no existe en el archivo importado' };
        }

        // Actualizar el campo codigo de cada registro según la nueva columna
        // El path JSON ($[idx]) se pasa como parámetro para evitar CONCAT frágil
        await pool.query(
            `UPDATE cod_registros
             SET codigo = TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(datos, ?)), ''))
             WHERE lote_id = ?`,
            [`$[${idx}]`, lote.id]
        );
        await pool.query('UPDATE cod_codigos SET col_codigo = ? WHERE id = ?', [idx, lote.id]);

        return { success: true, message: 'Columna de códigos actualizada' };
    }

    // ========================
    // LIMPIAR: elimina todo el lote
    // ========================
    async limpiar() {
        const lote = await this.obtenerActual();
        if (!lote) return { success: true, message: 'No hay códigos que limpiar' };

        await pool.query('DELETE FROM cod_registros');
        await pool.query('DELETE FROM cod_codigos');
        return { success: true, message: 'Códigos eliminados correctamente' };
    }
}

module.exports = new CodigoBarrasService();

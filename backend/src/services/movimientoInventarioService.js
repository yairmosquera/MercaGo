
/**
 * ============================================
 * MERCAGO
 * SERVICIO DE MOVIMIENTOS DE INVENTARIO
 * ============================================
 *
 * Registra movimientos utilizando una
 * transacción SQL Server existente.
 *
 * IMPORTANTE:
 * Este servicio no actualiza el stock.
 * Solo registra la auditoría.
 *
 * La actualización de Productos.Stock y
 * el registro deben ocurrir en la misma
 * transacción para mantener consistencia.
 */

const { sql } = require("../config/database");

// ============================================
// TIPOS PERMITIDOS
// ============================================

const TIPOS_MOVIMIENTO = Object.freeze({
    COMPRA: "SALIDA_COMPRA",
    CANCELACION: "DEVOLUCION",
    INVENTARIO_INICIAL: "INVENTARIO_INICIAL",
    AJUSTE: "AJUSTE_MANUAL"
});

// ============================================
// VALIDACIONES
// ============================================

function validarEntero(valor, campo, minimo = 0) {
    const numero = Number(valor);

    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === "" ||
        !Number.isSafeInteger(numero) ||
        numero < minimo ||
        numero > 2147483647
    ) {
        throw new Error(`${campo} inválido`);
    }

    return numero;
}

// ============================================
// REGISTRAR MOVIMIENTO
// ============================================

async function registrarMovimientoInventario(
    transaccion,
    datos
) {

    if (!transaccion) {
        throw new Error(
            "Se requiere una transacción SQL activa"
        );
    }

    const idProducto = validarEntero(
        datos.idProducto,
        "IdProducto",
        1
    );

    const idUsuario = validarEntero(
        datos.idUsuario,
        "IdUsuario",
        1
    );

    const stockAnterior = validarEntero(
        datos.stockAnterior,
        "Stock anterior"
    );

    const stockNuevo = validarEntero(
        datos.stockNuevo,
        "Stock nuevo"
    );

    const tipo = String(datos.tipo ?? "").trim();

    if (
        !Object.values(TIPOS_MOVIMIENTO).includes(tipo)
    ) {
        throw new Error(
            "Tipo de movimiento no permitido"
        );
    }

    const motivo = String(
        datos.motivo ?? ""
    ).trim();

    if (
        motivo.length < 1 ||
        motivo.length > 300
    ) {
        throw new Error(
            "El motivo debe tener entre 1 y 300 caracteres"
        );
    }

    if (stockAnterior === stockNuevo) {
        return null;
    }

    const diferencia = stockNuevo - stockAnterior;

    if (
        tipo === TIPOS_MOVIMIENTO.COMPRA &&
        diferencia >= 0
    ) {
        throw new Error(
            "Una compra debe descontar existencias"
        );
    }

    if (
        tipo === TIPOS_MOVIMIENTO.CANCELACION &&
        diferencia <= 0
    ) {
        throw new Error(
            "Una cancelación debe devolver existencias"
        );
    }

    if (
        tipo === TIPOS_MOVIMIENTO.INVENTARIO_INICIAL &&
        stockAnterior !== 0
    ) {
        throw new Error(
            "El inventario inicial debe partir de cero"
        );
    }

    const resultado = await new sql.Request(transaccion)
        .input(
            "producto",
            sql.Int,
            idProducto
        )
        .input(
            "usuario",
            sql.Int,
            idUsuario
        )
        .input(
            "anterior",
            sql.Int,
            stockAnterior
        )
        .input(
            "nuevo",
            sql.Int,
            stockNuevo
        )
        .input(
            "tipo",
            sql.VarChar(30),
            tipo
        )
        .input(
            "motivo",
            sql.NVarChar(300),
            motivo
        )
        .query(`
            INSERT INTO dbo.MovimientosInventarioMercaGo
            (
                IdProducto,
                IdUsuario,
                StockAnterior,
                StockNuevo,
                TipoMovimiento,
                Motivo
            )
            OUTPUT
                INSERTED.IdMovimiento AS id,
                INSERTED.IdProducto AS idProducto,
                INSERTED.StockAnterior AS stockAnterior,
                INSERTED.StockNuevo AS stockNuevo,
                INSERTED.Diferencia AS diferencia,
                INSERTED.TipoMovimiento AS tipo
            VALUES
            (
                @producto,
                @usuario,
                @anterior,
                @nuevo,
                @tipo,
                @motivo
            )
        `);

    return resultado.recordset[0];
}

module.exports = {
    TIPOS_MOVIMIENTO,
    registrarMovimientoInventario
};

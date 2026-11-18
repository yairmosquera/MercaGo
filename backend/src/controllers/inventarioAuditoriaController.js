
/**
 * ============================================
 * MERCAGO - AUDITORÍA DE INVENTARIO
 * ============================================
 *
 * Registra ajustes manuales de stock.
 * Cada ajuste y su auditoría utilizan
 * la misma transacción de SQL Server.
 */

const {
    sql,
    conectarDB
} = require("../config/database");

function errorHttp(status, mensaje) {
    return Object.assign(
        new Error(mensaje),
        { status }
    );
}

function manejarError(res, error) {
    if (!error.status) {
        console.error("Auditoría de inventario:", error);
    }

    return res.status(error.status || 500).json({
        mensaje: error.status
            ? error.message
            : "Error del servidor al gestionar inventario"
    });
}

function validarEnteroPositivo(valor, nombre) {
    const numero = Number(valor);

    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === "" ||
        !Number.isSafeInteger(numero) ||
        numero <= 0 ||
        numero > 2147483647
    ) {
        throw errorHttp(400, `${nombre} inválido`);
    }

    return numero;
}

// ============================================
// AJUSTAR STOCK Y REGISTRAR AUDITORÍA
// ============================================

async function actualizarStockConAuditoria(req, res) {

    let tx = null;
    let transaccionIniciada = false;

    try {
        const idProducto = validarEnteroPositivo(
            req.params.id,
            "Identificador de producto"
        );

        const idUsuario = validarEnteroPositivo(
            req.auth?.sub,
            "Usuario autenticado"
        );

        if (req.auth?.rol !== "ADMINISTRADOR") {
            throw errorHttp(403, "Acceso no autorizado");
        }

        const stock = Number(req.body?.stock);

        if (
            req.body?.stock === undefined ||
            req.body?.stock === null ||
            String(req.body.stock).trim() === "" ||
            !Number.isSafeInteger(stock) ||
            stock < 0 ||
            stock > 2147483647
        ) {
            throw errorHttp(
                400,
                "El stock debe ser un entero no negativo"
            );
        }

        const motivo = String(
            req.body?.motivo ??
            "Ajuste manual de inventario"
        ).trim();

        if (!motivo || motivo.length > 300) {
            throw errorHttp(
                400,
                "El motivo debe tener entre 1 y 300 caracteres"
            );
        }

        const pool = await conectarDB();

        tx = new sql.Transaction(pool);

        await tx.begin();
        transaccionIniciada = true;

        // Bloqueo de la fila para evitar
        // leer existencias desactualizadas.
        const consulta = await new sql.Request(tx)
            .input("id", sql.Int, idProducto)
            .query(`
                SELECT
                    IdProducto,
                    Nombre,
                    Stock
                FROM dbo.Productos WITH (UPDLOCK, HOLDLOCK)
                WHERE IdProducto = @id
            `);

        const producto = consulta.recordset[0];

        if (!producto) {
            throw errorHttp(
                404,
                "Producto no encontrado"
            );
        }

        const stockAnterior = Number(producto.Stock);

        // No registrar movimientos sin cambios.
        if (stockAnterior === stock) {
            await tx.commit();
            transaccionIniciada = false;

            return res.json({
                mensaje: "Las existencias no cambiaron",
                movimientoRegistrado: false,
                stockAnterior,
                stockNuevo: stock,
                diferencia: 0
            });
        }

        // Actualizar existencias.
        await new sql.Request(tx)
            .input("id", sql.Int, idProducto)
            .input("stock", sql.Int, stock)
            .query(`
                UPDATE dbo.Productos
                SET Stock = @stock
                WHERE IdProducto = @id
            `);

        // Registrar movimiento en la misma
        // transacción de la actualización.
        const auditoria = await new sql.Request(tx)
            .input("producto", sql.Int, idProducto)
            .input("usuario", sql.Int, idUsuario)
            .input("anterior", sql.Int, stockAnterior)
            .input("nuevo", sql.Int, stock)
            .input("motivo", sql.NVarChar(300), motivo)
            .query(`
                INSERT INTO dbo.MovimientosInventarioMercaGo
                (
                    IdProducto,
                    IdUsuario,
                    StockAnterior,
                    StockNuevo,
                    Motivo,
                    TipoMovimiento
                )
                OUTPUT
                    INSERTED.IdMovimiento AS idMovimiento
                VALUES
                (
                    @producto,
                    @usuario,
                    @anterior,
                    @nuevo,
                    @motivo,
                    'AJUSTE_MANUAL'
                )
            `);

        await tx.commit();
        transaccionIniciada = false;

        return res.json({
            mensaje: "Stock actualizado y auditado",
            movimientoRegistrado: true,
            idMovimiento:
                auditoria.recordset[0].idMovimiento,
            idProducto,
            stockAnterior,
            stockNuevo: stock,
            diferencia: stock - stockAnterior,
            motivo
        });

    } catch (error) {

        if (transaccionIniciada && tx) {
            try {
                await tx.rollback();
            } catch (rollbackError) {
                console.error(
                    "Error en rollback de inventario:",
                    rollbackError
                );
            }
        }

        return manejarError(res, error);
    }
}

// ============================================
// CONSULTAR HISTORIAL
// ============================================

async function listarMovimientos(req, res) {
    try {

        if (req.auth?.rol !== "ADMINISTRADOR") {
            throw errorHttp(403, "Acceso no autorizado");
        }

        const idProductoTexto = req.query.idProducto;

        let idProducto = null;

        if (
            idProductoTexto !== undefined &&
            idProductoTexto !== ""
        ) {
            idProducto = validarEnteroPositivo(
                idProductoTexto,
                "Identificador de producto"
            );
        }

        const limite = 200;

        const pool = await conectarDB();

        const request = pool.request()
            .input("limite", sql.Int, limite);

        let filtro = "";

        if (idProducto !== null) {
            request.input(
                "producto",
                sql.Int,
                idProducto
            );

            filtro = "WHERE m.IdProducto = @producto";
        }

        const resultado = await request.query(`
            SELECT TOP (@limite)
                m.IdMovimiento AS id,
                m.IdProducto AS idProducto,
                p.Nombre AS producto,
                m.IdUsuario AS idUsuario,
                u.Nombre AS administrador,
                m.StockAnterior AS stockAnterior,
                m.StockNuevo AS stockNuevo,
                m.Diferencia AS diferencia,
                m.Motivo AS motivo,
                m.TipoMovimiento AS tipo,
                m.Fecha AS fecha
            FROM dbo.MovimientosInventarioMercaGo m
            INNER JOIN dbo.Productos p
                ON p.IdProducto = m.IdProducto
            INNER JOIN dbo.UsuariosMercaGo u
                ON u.IdUsuario = m.IdUsuario
            ${filtro}
            ORDER BY
                m.Fecha DESC,
                m.IdMovimiento DESC
        `);

        return res.json(resultado.recordset);

    } catch (error) {
        return manejarError(res, error);
    }
}

module.exports = {
    actualizarStockConAuditoria,
    listarMovimientos
};

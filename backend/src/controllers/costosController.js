
/**
 * ============================================
 * MERCAGO - COSTOS Y AUDITORÍA
 * FASE 15
 * ============================================
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

function validarAdmin(req) {

    if (req.auth?.rol !== "ADMINISTRADOR") {
        throw errorHttp(
            403,
            "Acceso exclusivo para administradores"
        );
    }
}

function manejarError(res, error) {

    if (!error.status) {
        console.error("Error de costos:", error);
    }

    return res.status(error.status || 500).json({
        mensaje: error.status
            ? error.message
            : "Error al gestionar costos"
    });
}

// ============================================
// LISTAR COSTOS ACTUALES
// ============================================

async function listarCostos(req, res) {

    try {

        validarAdmin(req);

        const pool = await conectarDB();

        const resultado = await pool.request().query(`
            SELECT
                p.IdProducto AS id,
                p.Nombre AS nombre,
                c.Nombre AS categoria,
                p.Precio AS precio,
                p.CostoUnitario AS costo,
                p.Stock AS stock,
                p.Activo AS activo,

                CASE
                    WHEN p.CostoUnitario IS NULL
                        THEN NULL
                    ELSE p.Precio - p.CostoUnitario
                END AS margenUnitario,

                CASE
                    WHEN p.CostoUnitario IS NOT NULL
                         AND p.Precio > 0
                    THEN ROUND(
                        (p.Precio - p.CostoUnitario)
                        * 100.0 / p.Precio,
                        2
                    )
                    ELSE NULL
                END AS porcentajeMargen

            FROM dbo.Productos p

            INNER JOIN dbo.Categorias c
                ON c.IdCategoria = p.IdCategoria

            ORDER BY p.Nombre;
        `);

        return res.json(resultado.recordset);

    } catch (error) {

        return manejarError(res, error);
    }
}

// ============================================
// ACTUALIZAR COSTO CON AUDITORÍA
// ============================================

async function actualizarCosto(req, res) {

    let transaccion = null;
    let iniciada = false;

    try {

        validarAdmin(req);

        const id = Number(req.params.id);

        const usuario = Number(req.auth.sub);

        if (!Number.isSafeInteger(id) || id < 1) {
            throw errorHttp(
                400,
                "Identificador de producto inválido"
            );
        }

        if (
            !Number.isSafeInteger(usuario) ||
            usuario < 1
        ) {
            throw errorHttp(
                401,
                "Sesión de usuario inválida"
            );
        }

        const valor = req.body?.costo;

        if (
            valor === undefined ||
            valor === null ||
            String(valor).trim() === ""
        ) {
            throw errorHttp(
                400,
                "Debes indicar el costo de adquisición"
            );
        }

        const costo = Number(valor);

        if (
            !Number.isFinite(costo) ||
            costo < 0 ||
            costo > 999999999 ||
            Math.abs(
                costo * 100 - Math.round(costo * 100)
            ) > 0.000001
        ) {
            throw errorHttp(
                400,
                "Costo inválido. Máximo dos decimales"
            );
        }

        const costoRedondeado = Number(
            costo.toFixed(2)
        );

        const motivo = String(
            req.body?.motivo ??
            "Actualización desde Administración de costos"
        ).trim();

        if (
            motivo.length === 0 ||
            motivo.length > 300
        ) {
            throw errorHttp(
                400,
                "El motivo debe tener entre 1 y 300 caracteres"
            );
        }

        const pool = await conectarDB();

        transaccion = new sql.Transaction(pool);

        await transaccion.begin();
        iniciada = true;

        // Bloquear el producto durante el ajuste.
        // Evita modificaciones simultáneas que
        // produzcan una auditoría inconsistente.

        const actual = await new sql.Request(
            transaccion
        )
            .input("id", sql.Int, id)
            .query(`
                SELECT
                    IdProducto AS id,
                    Nombre AS nombre,
                    Precio AS precio,
                    CostoUnitario AS costoAnterior

                FROM dbo.Productos
                    WITH (UPDLOCK, HOLDLOCK)

                WHERE IdProducto = @id;
            `);

        if (!actual.recordset.length) {
            throw errorHttp(
                404,
                "Producto no encontrado"
            );
        }

        const producto = actual.recordset[0];

        const costoAnterior =
            producto.costoAnterior === null
                ? null
                : Number(producto.costoAnterior);

        if (costoAnterior === costoRedondeado) {
            throw errorHttp(
                400,
                "El costo no ha cambiado"
            );
        }

        // Actualizar el costo actual.

        await new sql.Request(transaccion)
            .input("id", sql.Int, id)
            .input(
                "costo",
                sql.Decimal(18, 2),
                costoRedondeado
            )
            .query(`
                UPDATE dbo.Productos
                SET CostoUnitario = @costo
                WHERE IdProducto = @id;
            `);

        // Registrar el mismo cambio en auditoría.

        const auditoria = await new sql.Request(
            transaccion
        )
            .input("idProducto", sql.Int, id)
            .input("idUsuario", sql.Int, usuario)
            .input(
                "anterior",
                sql.Decimal(18, 2),
                costoAnterior
            )
            .input(
                "nuevo",
                sql.Decimal(18, 2),
                costoRedondeado
            )
            .input(
                "motivo",
                sql.NVarChar(300),
                motivo
            )
            .query(`
                INSERT INTO dbo.HistorialCostosMercaGo
                (
                    IdProducto,
                    IdUsuario,
                    CostoAnterior,
                    CostoNuevo,
                    Motivo
                )

                OUTPUT
                    INSERTED.IdHistorial AS id,
                    INSERTED.Fecha AS fecha

                VALUES
                (
                    @idProducto,
                    @idUsuario,
                    @anterior,
                    @nuevo,
                    @motivo
                );
            `);

        await transaccion.commit();
        iniciada = false;

        const precio = Number(producto.precio);
        const margen = precio - costoRedondeado;

        return res.json({
            mensaje:
                "Costo actualizado y auditado correctamente",

            producto: {
                id,
                nombre: producto.nombre,
                precio,
                costo: costoRedondeado,
                margenUnitario: margen,
                porcentajeMargen: precio > 0
                    ? Number(
                        (margen / precio * 100).toFixed(2)
                    )
                    : null
            },

            movimiento: {
                id: auditoria.recordset[0].id,
                fecha: auditoria.recordset[0].fecha,
                costoAnterior,
                costoNuevo: costoRedondeado,
                motivo
            }
        });

    } catch (error) {

        if (iniciada) {
            try {
                await transaccion.rollback();
            } catch (rollbackError) {
                console.error(
                    "Error revirtiendo cambio de costo:",
                    rollbackError
                );
            }
        }

        return manejarError(res, error);
    }
}

// ============================================
// CONSULTAR HISTORIAL DE COSTOS
// ============================================

async function listarHistorialCostos(req, res) {

    try {

        validarAdmin(req);

        const pool = await conectarDB();

        const resultado = await pool.request().query(`
            SELECT TOP (200)
                h.IdHistorial AS id,

                h.IdProducto AS idProducto,

                p.Nombre AS producto,

                h.IdUsuario AS idUsuario,

                u.Nombre AS administrador,

                h.CostoAnterior AS costoAnterior,

                h.CostoNuevo AS costoNuevo,

                CASE
                    WHEN h.CostoAnterior IS NULL
                        THEN NULL
                    ELSE
                        h.CostoNuevo - h.CostoAnterior
                END AS diferencia,

                h.Motivo AS motivo,

                h.Fecha AS fecha

            FROM dbo.HistorialCostosMercaGo h

            INNER JOIN dbo.Productos p
                ON p.IdProducto = h.IdProducto

            INNER JOIN dbo.UsuariosMercaGo u
                ON u.IdUsuario = h.IdUsuario

            ORDER BY
                h.Fecha DESC,
                h.IdHistorial DESC;
        `);

        return res.json(resultado.recordset);

    } catch (error) {

        return manejarError(res, error);
    }
}

module.exports = {
    listarCostos,
    actualizarCosto,
    listarHistorialCostos
};


/**
 * ============================================
 * MERCAGO - REPORTE DE VENTAS
 * ============================================
 *
 * Consulta pedidos y sus detalles.
 * Solo los pedidos entregados cuentan
 * como ventas efectivas.
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

function fechaValida(texto) {

    if (
        typeof texto !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(texto)
    ) {
        return false;
    }

    const fecha = new Date(texto + "T00:00:00Z");

    return (
        !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === texto
    );
}

function controlarError(res, error) {

    if (!error.status) {
        console.error(
            "Error en reporte de ventas:",
            error
        );
    }

    return res.status(error.status || 500).json({
        mensaje: error.status
            ? error.message
            : "No fue posible generar el reporte"
    });
}

// ============================================
// REPORTE ADMINISTRATIVO
// ============================================

async function obtenerReporteVentas(req, res) {

    try {

        if (req.auth?.rol !== "ADMINISTRADOR") {
            throw errorHttp(
                403,
                "Acceso exclusivo para administradores"
            );
        }

        const desde = req.query.desde;
        const hasta = req.query.hasta;

        if (
            !fechaValida(desde) ||
            !fechaValida(hasta)
        ) {
            throw errorHttp(
                400,
                "Utiliza fechas válidas AAAA-MM-DD"
            );
        }

        const inicio = new Date(
            desde + "T00:00:00Z"
        );

        const fin = new Date(
            hasta + "T00:00:00Z"
        );

        const dias =
            (fin.getTime() - inicio.getTime()) /
            86400000;

        if (dias < 0 || dias > 365) {
            throw errorHttp(
                400,
                "Selecciona un período de 1 a 366 días"
            );
        }

        const pool = await conectarDB();

        // Las fechas se comparan contra
        // FechaCreacion tal como está almacenada
        // en SQL Server.
        const crearRequest = () =>
            pool.request()
                .input("desde", sql.Date, desde)
                .input("hasta", sql.Date, hasta);

        // ====================================
        // RESUMEN GENERAL
        // ====================================

        const resumenResult =
            await crearRequest().query(`
                SELECT
                    COUNT(*) AS pedidos,

                    SUM(
                        CASE WHEN UPPER(LTRIM(RTRIM(Estado)))
                            = 'ENTREGADO'
                        THEN 1 ELSE 0 END
                    ) AS entregados,

                    SUM(
                        CASE WHEN UPPER(LTRIM(RTRIM(Estado)))
                            = 'CANCELADO'
                        THEN 1 ELSE 0 END
                    ) AS cancelados,

                    SUM(
                        CASE WHEN UPPER(LTRIM(RTRIM(Estado)))
                            NOT IN ('ENTREGADO', 'CANCELADO')
                        THEN 1 ELSE 0 END
                    ) AS otros,

                    COALESCE(
                        SUM(
                            CASE WHEN UPPER(LTRIM(RTRIM(Estado)))
                                = 'ENTREGADO'
                            THEN Total ELSE 0 END
                        ),
                        0
                    ) AS ingresos,

                    COALESCE(
                        SUM(
                            CASE WHEN UPPER(LTRIM(RTRIM(Estado)))
                                = 'ENTREGADO'
                            THEN Subtotal ELSE 0 END
                        ),
                        0
                    ) AS subtotalVentas,

                    COALESCE(
                        SUM(
                            CASE WHEN UPPER(LTRIM(RTRIM(Estado)))
                                = 'ENTREGADO'
                            THEN CostoDomicilio ELSE 0 END
                        ),
                        0
                    ) AS domicilios

                FROM dbo.PedidosMercaGo
                WHERE FechaCreacion >= @desde
                  AND FechaCreacion <
                      DATEADD(DAY, 1, @hasta)
            `);

        // ====================================
        // PEDIDOS POR ESTADO
        // ====================================

        const estadosResult =
            await crearRequest().query(`
                SELECT
                    Estado AS estado,
                    COUNT(*) AS cantidad
                FROM dbo.PedidosMercaGo
                WHERE FechaCreacion >= @desde
                  AND FechaCreacion <
                      DATEADD(DAY, 1, @hasta)
                GROUP BY Estado
                ORDER BY cantidad DESC
            `);

        // ====================================
        // VENTAS DIARIAS ENTREGADAS
        // ====================================

        const ventasDiariasResult =
            await crearRequest().query(`
                SELECT
                    CONVERT(
                        VARCHAR(10),
                        CAST(FechaCreacion AS DATE),
                        23
                    ) AS fecha,

                    COUNT(*) AS pedidos,

                    SUM(Total) AS ingresos

                FROM dbo.PedidosMercaGo

                WHERE FechaCreacion >= @desde
                  AND FechaCreacion <
                      DATEADD(DAY, 1, @hasta)
                  AND UPPER(LTRIM(RTRIM(Estado)))
                      = 'ENTREGADO'

                GROUP BY CAST(FechaCreacion AS DATE)
                ORDER BY fecha ASC
            `);

        // ====================================
        // PRODUCTOS MÁS VENDIDOS
        // ====================================

        const productosResult =
            await crearRequest().query(`
                SELECT TOP (20)
                    d.IdProducto AS idProducto,
                    MAX(d.NombreProducto) AS producto,

                    SUM(
                        CAST(d.Cantidad AS BIGINT)
                    ) AS unidades,

                    SUM(d.Subtotal) AS importe

                FROM dbo.DetallesPedidoMercaGo d

                INNER JOIN dbo.PedidosMercaGo p
                    ON p.IdPedido = d.IdPedido

                WHERE p.FechaCreacion >= @desde
                  AND p.FechaCreacion <
                      DATEADD(DAY, 1, @hasta)
                  AND UPPER(LTRIM(RTRIM(p.Estado)))
                      = 'ENTREGADO'

                GROUP BY d.IdProducto

                ORDER BY unidades DESC
            `);

        // ====================================
        // PEDIDOS RECIENTES DEL PERÍODO
        // ====================================

        const pedidosResult =
            await crearRequest().query(`
                SELECT TOP (100)
                    p.IdPedido AS id,
                    u.Nombre AS cliente,
                    p.Estado AS estado,
                    p.Subtotal AS subtotal,
                    p.CostoDomicilio AS domicilio,
                    p.Total AS total,
                    p.FechaCreacion AS fecha

                FROM dbo.PedidosMercaGo p

                INNER JOIN dbo.UsuariosMercaGo u
                    ON u.IdUsuario = p.IdUsuario

                WHERE p.FechaCreacion >= @desde
                  AND p.FechaCreacion <
                      DATEADD(DAY, 1, @hasta)

                ORDER BY
                    p.FechaCreacion DESC,
                    p.IdPedido DESC
            `);

        return res.json({
            periodo: {
                desde,
                hasta
            },

            resumen:
                resumenResult.recordset[0],

            estados:
                estadosResult.recordset,

            ventasDiarias:
                ventasDiariasResult.recordset,

            productos:
                productosResult.recordset,

            pedidos:
                pedidosResult.recordset
        });

    } catch (error) {

        return controlarError(res, error);
    }
}

module.exports = {
    obtenerReporteVentas
};

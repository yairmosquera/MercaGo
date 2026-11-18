
/**
 * MERCAGO - RENTABILIDAD HISTÓRICA
 * FASE 14.4
 */

const {
    sql,
    conectarDB
} = require("../config/database");

// ============================================
// VALIDAR FECHAS
// ============================================

const fechaValida = valor => {

    if (
        typeof valor !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(valor)
    ) {
        return false;
    }

    const fecha = new Date(
        `${valor}T00:00:00Z`
    );

    return (
        Number.isFinite(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === valor
    );
};

// ============================================
// CONSULTAR RENTABILIDAD
// ============================================

async function obtenerRentabilidad(req, res) {

    if (req.auth?.rol !== "ADMINISTRADOR") {
        return res.status(403).json({
            mensaje: "Acceso exclusivo para administradores"
        });
    }

    const { desde, hasta } = req.query;

    if (
        !fechaValida(desde) ||
        !fechaValida(hasta)
    ) {
        return res.status(400).json({
            mensaje: "Fechas inválidas. Usa AAAA-MM-DD"
        });
    }

    const diferencia = (
        Date.parse(`${hasta}T00:00:00Z`) -
        Date.parse(`${desde}T00:00:00Z`)
    ) / 86400000;

    if (diferencia < 0 || diferencia > 365) {
        return res.status(400).json({
            mensaje: "El rango permitido es de 1 a 366 días"
        });
    }

    try {

        const pool = await conectarDB();

        const request = () => pool.request()
            .input("desde", sql.Date, desde)
            .input("hasta", sql.Date, hasta);

        // ====================================
        // RESUMEN GENERAL
        // ====================================

        const resumen = await request().query(`
            WITH lineas AS (
                SELECT
                    d.IdPedido,
                    d.IdProducto,
                    d.NombreProducto,
                    d.Cantidad,
                    d.Subtotal AS venta,
                    d.CostoUnitario,

                    CASE
                        WHEN d.CostoUnitario IS NULL
                            THEN NULL
                        ELSE
                            CAST(
                                d.Cantidad AS DECIMAL(18,2)
                            ) * d.CostoUnitario
                    END AS costo

                FROM dbo.DetallesPedidoMercaGo d

                INNER JOIN dbo.PedidosMercaGo p
                    ON p.IdPedido = d.IdPedido

                WHERE p.FechaCreacion >= @desde
                  AND p.FechaCreacion <
                      DATEADD(DAY, 1, @hasta)

                  AND UPPER(
                      LTRIM(RTRIM(p.Estado))
                  ) = 'ENTREGADO'
            )

            SELECT
                COUNT(*) AS lineas,

                COALESCE(
                    SUM(
                        CASE
                            WHEN CostoUnitario IS NULL
                                THEN 1
                            ELSE 0
                        END
                    ), 0
                ) AS lineasSinCosto,

                COALESCE(
                    SUM(
                        CASE
                            WHEN CostoUnitario IS NOT NULL
                                THEN 1
                            ELSE 0
                        END
                    ), 0
                ) AS lineasConCosto,

                COALESCE(
                    SUM(venta), 0
                ) AS ventasProductos,

                COALESCE(
                    SUM(
                        CASE
                            WHEN CostoUnitario IS NULL
                                THEN venta
                            ELSE 0
                        END
                    ), 0
                ) AS ventasSinCosto,

                COALESCE(
                    SUM(
                        CASE
                            WHEN CostoUnitario IS NOT NULL
                                THEN venta
                            ELSE 0
                        END
                    ), 0
                ) AS ventasConCosto,

                COALESCE(
                    SUM(costo), 0
                ) AS costoConocido,

                COALESCE(
                    SUM(
                        CASE
                            WHEN CostoUnitario IS NOT NULL
                                THEN venta - costo
                            ELSE 0
                        END
                    ), 0
                ) AS margenConocido,

                COALESCE(
                    SUM(Cantidad), 0
                ) AS unidades

            FROM lineas;
        `);

        // ====================================
        // RENTABILIDAD POR PRODUCTO
        // ====================================

        const productos = await request().query(`
            SELECT TOP (100)

                d.IdProducto AS idProducto,

                MAX(d.NombreProducto) AS producto,

                SUM(
                    CAST(d.Cantidad AS BIGINT)
                ) AS unidades,

                SUM(
                    CASE
                        WHEN d.CostoUnitario IS NULL
                            THEN 1
                        ELSE 0
                    END
                ) AS lineasSinCosto,

                SUM(
                    CASE
                        WHEN d.CostoUnitario IS NOT NULL
                            THEN 1
                        ELSE 0
                    END
                ) AS lineasConCosto,

                SUM(
                    d.Subtotal
                ) AS ventasProductos,

                SUM(
                    CASE
                        WHEN d.CostoUnitario IS NULL
                            THEN d.Subtotal
                        ELSE 0
                    END
                ) AS ventasSinCosto,

                SUM(
                    CASE
                        WHEN d.CostoUnitario IS NOT NULL
                            THEN d.Subtotal
                        ELSE 0
                    END
                ) AS ventasConCosto,

                COALESCE(
                    SUM(
                        CAST(
                            d.Cantidad AS DECIMAL(18,2)
                        ) * d.CostoUnitario
                    ), 0
                ) AS costoConocido,

                COALESCE(
                    SUM(
                        CASE
                            WHEN d.CostoUnitario IS NOT NULL
                                THEN d.Subtotal -
                                     CAST(
                                         d.Cantidad AS DECIMAL(18,2)
                                     ) * d.CostoUnitario
                            ELSE 0
                        END
                    ), 0
                ) AS margenConocido

            FROM dbo.DetallesPedidoMercaGo d

            INNER JOIN dbo.PedidosMercaGo p
                ON p.IdPedido = d.IdPedido

            WHERE p.FechaCreacion >= @desde
              AND p.FechaCreacion <
                  DATEADD(DAY, 1, @hasta)

              AND UPPER(
                  LTRIM(RTRIM(p.Estado))
              ) = 'ENTREGADO'

            GROUP BY d.IdProducto

            ORDER BY ventasProductos DESC;
        `);

        return res.json({
            periodo: {
                desde,
                hasta
            },

            resumen: resumen.recordset[0],

            productos: productos.recordset
        });

    } catch (error) {

        console.error(
            "Error consultando rentabilidad:",
            error
        );

        return res.status(500).json({
            mensaje:
                "No fue posible consultar la rentabilidad"
        });
    }
}

module.exports = {
    obtenerRentabilidad
};


/**
 * ============================================
 * MERCAGO - ANÁLISIS COMPARATIVO DE VENTAS
 * FASE 13
 * ============================================
 *
 * - Comparación entre dos períodos
 * - Ventas efectivas por categoría
 * - Productos vendidos
 * - Variación porcentual
 *
 * Solo lectura.
 */

const {
    sql,
    conectarDB
} = require("../config/database");

function crearError(status, mensaje) {
    return Object.assign(
        new Error(mensaje),
        { status }
    );
}

function validarFecha(valor) {

    if (
        typeof valor !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(valor)
    ) {
        return false;
    }

    const fecha = new Date(valor + "T00:00:00Z");

    return (
        !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === valor
    );
}

function variacion(actual, anterior) {

    actual = Number(actual) || 0;
    anterior = Number(anterior) || 0;

    if (anterior === 0) {
        return actual === 0 ? 0 : null;
    }

    return Number(
        (
            (actual - anterior) /
            anterior * 100
        ).toFixed(2)
    );
}

async function obtenerAnalisisVentas(req, res) {

    try {

        if (req.auth?.rol !== "ADMINISTRADOR") {
            throw crearError(
                403,
                "Acceso exclusivo para administradores"
            );
        }

        const { desde, hasta } = req.query;

        if (
            !validarFecha(desde) ||
            !validarFecha(hasta)
        ) {
            throw crearError(
                400,
                "Indica fechas válidas AAAA-MM-DD"
            );
        }

        const inicio = Date.parse(
            desde + "T00:00:00Z"
        );

        const fin = Date.parse(
            hasta + "T00:00:00Z"
        );

        const dias = (fin - inicio) / 86400000;

        if (dias < 0 || dias > 365) {
            throw crearError(
                400,
                "El rango debe ser de 1 a 366 días"
            );
        }

        const pool = await conectarDB();

        const parametros = () =>
            pool.request()
                .input("desde", sql.Date, desde)
                .input("hasta", sql.Date, hasta);

        // ====================================
        // COMPARACIÓN ENTRE PERÍODOS
        // ====================================

        const comparacion = await parametros().query(`
            DECLARE @dias INT =
                DATEDIFF(DAY, @desde, @hasta) + 1;

            DECLARE @inicioAnterior DATE =
                DATEADD(DAY, -@dias, @desde);

            SELECT
                CASE
                    WHEN FechaCreacion >= @desde
                    THEN 'actual'
                    ELSE 'anterior'
                END AS periodo,

                COUNT(*) AS pedidosEntregados,

                COALESCE(SUM(Total), 0)
                    AS ingresos,

                COALESCE(SUM(Subtotal), 0)
                    AS subtotalProductos,

                COALESCE(SUM(CostoDomicilio), 0)
                    AS domicilios

            FROM dbo.PedidosMercaGo

            WHERE FechaCreacion >= @inicioAnterior
              AND FechaCreacion <
                  DATEADD(DAY, 1, @hasta)

              AND UPPER(LTRIM(RTRIM(Estado)))
                  = 'ENTREGADO'

            GROUP BY
                CASE
                    WHEN FechaCreacion >= @desde
                    THEN 'actual'
                    ELSE 'anterior'
                END;
        `);

        // ====================================
        // VENTAS POR CATEGORÍA
        // ====================================

        const categorias = await parametros().query(`
            SELECT
                COALESCE(
                    c.Nombre,
                    'Sin categoría'
                ) AS categoria,

                SUM(
                    CAST(d.Cantidad AS BIGINT)
                ) AS unidades,

                COALESCE(
                    SUM(d.Subtotal),
                    0
                ) AS importe,

                COUNT(DISTINCT p.IdPedido)
                    AS pedidos

            FROM dbo.DetallesPedidoMercaGo d

            INNER JOIN dbo.PedidosMercaGo p
                ON p.IdPedido = d.IdPedido

            LEFT JOIN dbo.Productos pr
                ON pr.IdProducto = d.IdProducto

            LEFT JOIN dbo.Categorias c
                ON c.IdCategoria = pr.IdCategoria

            WHERE p.FechaCreacion >= @desde
              AND p.FechaCreacion <
                  DATEADD(DAY, 1, @hasta)

              AND UPPER(LTRIM(RTRIM(p.Estado)))
                  = 'ENTREGADO'

            GROUP BY
                COALESCE(
                    c.Nombre,
                    'Sin categoría'
                )

            ORDER BY importe DESC;
        `);

        const base = {
            pedidosEntregados: 0,
            ingresos: 0,
            subtotalProductos: 0,
            domicilios: 0
        };

        const filas = comparacion.recordset;

        const actual = {
            ...base,
            ...filas.find(
                fila => fila.periodo === "actual"
            )
        };

        const anterior = {
            ...base,
            ...filas.find(
                fila => fila.periodo === "anterior"
            )
        };

        const ingresosActuales =
            Number(actual.ingresos) || 0;

        const ingresosAnteriores =
            Number(anterior.ingresos) || 0;

        const pedidosActuales =
            Number(actual.pedidosEntregados) || 0;

        const pedidosAnteriores =
            Number(anterior.pedidosEntregados) || 0;

        const sumaCategorias =
            categorias.recordset.reduce(
                (total, categoria) =>
                    total + Number(
                        categoria.importe || 0
                    ),
                0
            );

        const categoriasConParticipacion =
            categorias.recordset.map(
                categoria => ({
                    ...categoria,

                    participacion:
                        sumaCategorias > 0
                            ? Number(
                                (
                                    Number(
                                        categoria.importe
                                    ) /
                                    sumaCategorias * 100
                                ).toFixed(2)
                            )
                            : 0
                })
            );

        return res.json({
            periodo: {
                desde,
                hasta,
                dias: dias + 1
            },

            comparacion: {
                actual,
                anterior,

                variacionIngresos:
                    variacion(
                        ingresosActuales,
                        ingresosAnteriores
                    ),

                variacionPedidos:
                    variacion(
                        pedidosActuales,
                        pedidosAnteriores
                    )
            },

            categorias:
                categoriasConParticipacion
        });

    } catch (error) {

        if (!error.status) {
            console.error(
                "Error en análisis de ventas:",
                error
            );
        }

        return res.status(
            error.status || 500
        ).json({
            mensaje: error.status
                ? error.message
                : "Error al consultar análisis de ventas"
        });
    }
}

module.exports = {
    obtenerAnalisisVentas
};

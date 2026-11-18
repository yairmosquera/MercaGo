
/**
 * ============================================
 * MERCAGO - CONTROLADOR DE PEDIDOS
 * ============================================
 *
 * Funcionalidades:
 * - Confirmar pedidos (Facade)
 * - Listar pedidos
 * - Consultar detalles
 * - Cambiar estados (State)
 * - Publicar eventos (Observer)
 * - Devolver inventario al cancelar
 * - Auditar devoluciones de inventario
 * - Consultar notificaciones
 * - Marcar notificaciones como leídas
 */

const {
    sql,
    conectarDB
} = require("../config/database");

const checkout = require(
    "../patterns/facade/checkoutFacade"
);

const {
    siguienteEstado
} = require("../patterns/state/estadoPedido");

const {
    publicarCambio
} = require("../patterns/observer/eventosPedido");

const {
    TIPOS_MOVIMIENTO,
    registrarMovimientoInventario
} = require(
    "../services/movimientoInventarioService"
);

// ============================================
// MANEJO DE ERRORES
// ============================================

const fail = (status, mensaje) =>
    Object.assign(
        new Error(mensaje),
        { status }
    );

function manejar(res, error) {

    const status = error.status || 500;

    if (status === 500) {
        console.error(
            "Error en pedidos:",
            error
        );
    }

    return res.status(status).json({
        mensaje: error.status
            ? error.message
            : "Error del servidor"
    });
}

// ============================================
// CONFIRMAR PEDIDO
// PATRÓN FACADE
// ============================================

async function confirmar(req, res) {

    try {

        const pedido = await checkout.confirmar({
            ...req.body,
            idUsuario: req.auth.sub
        });

        return res.status(201).json({
            pedido
        });

    } catch (error) {

        return manejar(res, error);
    }
}

// ============================================
// LISTAR PEDIDOS
// ============================================

async function listar(req, res) {

    try {

        const pool = await conectarDB();

        const esAdmin =
            req.auth.rol === "ADMINISTRADOR";

        const request = new sql.Request(pool);

        let filtro = "";

        if (!esAdmin) {

            request.input(
                "usuario",
                sql.Int,
                req.auth.sub
            );

            filtro =
                "WHERE p.IdUsuario = @usuario";
        }

        const resultado = await request.query(`
            SELECT
                p.IdPedido AS id,
                p.IdUsuario AS idUsuario,
                u.Nombre AS cliente,
                p.DireccionEntrega AS direccion,
                p.Estado AS estado,
                p.Subtotal AS subtotal,
                p.CostoDomicilio AS costoDomicilio,
                p.Total AS total,
                p.TiempoEstimadoMin AS tiempoEstimadoMin,
                p.FechaCreacion AS fecha
            FROM dbo.PedidosMercaGo p
            INNER JOIN dbo.UsuariosMercaGo u
                ON u.IdUsuario = p.IdUsuario
            ${filtro}
            ORDER BY p.IdPedido DESC
        `);

        return res.json(
            resultado.recordset
        );

    } catch (error) {

        return manejar(res, error);
    }
}

// ============================================
// DETALLE DE PEDIDO
// ============================================

async function detalle(req, res) {

    try {

        const id = Number(req.params.id);

        if (
            !Number.isSafeInteger(id) ||
            id < 1
        ) {
            throw fail(
                400,
                "Identificador inválido"
            );
        }

        const pool = await conectarDB();

        const request = pool.request()
            .input(
                "id",
                sql.Int,
                id
            );

        const esAdmin =
            req.auth.rol === "ADMINISTRADOR";

        if (!esAdmin) {

            request.input(
                "usuario",
                sql.Int,
                req.auth.sub
            );
        }

        const resultado = await request.query(`
            SELECT
                IdPedido AS id,
                Estado AS estado,
                Total AS total,
                DireccionEntrega AS direccion
            FROM dbo.PedidosMercaGo
            WHERE IdPedido = @id
            ${esAdmin
                ? ""
                : "AND IdUsuario = @usuario"}
        `);

        if (!resultado.recordset.length) {

            throw fail(
                404,
                "Pedido no encontrado"
            );
        }

        const detalles = await pool.request()
            .input(
                "id",
                sql.Int,
                id
            )
            .query(`
                SELECT
                    NombreProducto AS nombre,
                    Cantidad AS cantidad,
                    PrecioUnitario AS precio,
                    Subtotal AS subtotal
                FROM dbo.DetallesPedidoMercaGo
                WHERE IdPedido = @id
            `);

        return res.json({
            pedido: resultado.recordset[0],
            items: detalles.recordset
        });

    } catch (error) {

        return manejar(res, error);
    }
}

// ============================================
// CAMBIAR ESTADO DEL PEDIDO
// PATRÓN STATE
// ============================================

async function cambiar(req, res) {

    const id = Number(req.params.id);

    const accion = req.params.accion;

    if (
        !Number.isSafeInteger(id) ||
        id < 1
    ) {
        return res.status(400).json({
            mensaje: "Identificador inválido"
        });
    }

    const accionesPermitidas = [
        "cancelar",
        "despachar",
        "entregar"
    ];

    if (
        !accionesPermitidas.includes(accion)
    ) {
        return res.status(400).json({
            mensaje: "Acción inválida"
        });
    }

    // Despachar y entregar son acciones
    // exclusivas del administrador.

    if (
        accion !== "cancelar" &&
        req.auth.rol !== "ADMINISTRADOR"
    ) {
        return res.status(403).json({
            mensaje: "Solo administradores"
        });
    }

    let tiempo = null;

    // ========================================
    // VALIDAR TIEMPO DE ENTREGA
    // ========================================

    if (accion === "despachar") {

        tiempo = Number(
            req.body?.tiempoEstimadoMin
        );

        if (
            !Number.isInteger(tiempo) ||
            tiempo < 1 ||
            tiempo > 1440
        ) {
            return res.status(400).json({
                mensaje: "Tiempo estimado inválido"
            });
        }
    }

    let tx = null;
    let iniciada = false;

    try {

        const pool = await conectarDB();

        tx = new sql.Transaction(pool);

        await tx.begin();

        iniciada = true;

        // ====================================
        // BLOQUEAR Y CONSULTAR PEDIDO
        // ====================================

        const resultado = await new sql.Request(tx)
            .input(
                "id",
                sql.Int,
                id
            )
            .query(`
                SELECT
                    IdUsuario,
                    Estado
                FROM dbo.PedidosMercaGo
                WITH (UPDLOCK, HOLDLOCK)
                WHERE IdPedido = @id
            `);

        const pedido = resultado.recordset[0];

        if (!pedido) {

            throw fail(
                404,
                "Pedido no encontrado"
            );
        }

        // Clientes solo pueden acceder
        // a sus propios pedidos.

        if (
            req.auth.rol !== "ADMINISTRADOR" &&
            pedido.IdUsuario !== req.auth.sub
        ) {
            throw fail(
                404,
                "Pedido no encontrado"
            );
        }

        // ====================================
        // PATRÓN STATE
        // VALIDAR TRANSICIÓN
        // ====================================

        const nuevo = siguienteEstado(
            pedido.Estado,
            accion
        );

        // ====================================
        // CANCELACIÓN DEL PEDIDO
        // DEVOLUCIÓN DE INVENTARIO
        // REGISTRO AUTOMÁTICO DE AUDITORÍA
        // ====================================

        if (accion === "cancelar") {

            // Agrupar por producto evita crear
            // movimientos separados cuando el
            // mismo producto está repetido
            // en el detalle del pedido.

            const detalles = await new sql.Request(tx)
                .input(
                    "id",
                    sql.Int,
                    id
                )
                .query(`
                    SELECT
                        IdProducto,
                        SUM(Cantidad) AS Cantidad
                    FROM dbo.DetallesPedidoMercaGo
                    WHERE IdPedido = @id
                    GROUP BY IdProducto
                `);

            // Cada devolución utiliza la misma
            // transacción del cambio de estado.

            for (const item of detalles.recordset) {

                const cantidad = Number(
                    item.Cantidad
                );

                if (
                    !Number.isSafeInteger(cantidad) ||
                    cantidad <= 0
                ) {
                    throw fail(
                        500,
                        "Cantidad inválida en detalle del pedido"
                    );
                }

                // =================================
                // DEVOLVER EXISTENCIAS
                // =================================

                const resultadoStock =
                    await new sql.Request(tx)
                        .input(
                            "producto",
                            sql.Int,
                            item.IdProducto
                        )
                        .input(
                            "cantidad",
                            sql.Int,
                            cantidad
                        )
                        .query(`
                            UPDATE dbo.Productos
                            SET
                                Stock = Stock + @cantidad
                            OUTPUT
                                DELETED.Stock
                                    AS stockAnterior,
                                INSERTED.Stock
                                    AS stockNuevo
                            WHERE
                                IdProducto = @producto
                        `);

                if (
                    resultadoStock.recordset.length !== 1
                ) {
                    throw fail(
                        500,
                        "No fue posible devolver las existencias"
                    );
                }

                const movimiento =
                    resultadoStock.recordset[0];

                // =================================
                // REGISTRAR AUDITORÍA
                // =================================

                await registrarMovimientoInventario(
                    tx,
                    {
                        idProducto:
                            Number(item.IdProducto),

                        // Usuario que realizó
                        // la cancelación.
                        idUsuario:
                            Number(req.auth.sub),

                        stockAnterior:
                            Number(
                                movimiento.stockAnterior
                            ),

                        stockNuevo:
                            Number(
                                movimiento.stockNuevo
                            ),

                        tipo:
                            TIPOS_MOVIMIENTO.CANCELACION,

                        motivo:
                            `Devolución por cancelación ` +
                            `del pedido #${id}`
                    }
                );
            }
        }

        // ====================================
        // ACTUALIZAR ESTADO DEL PEDIDO
        // ====================================

        await new sql.Request(tx)
            .input(
                "id",
                sql.Int,
                id
            )
            .input(
                "nuevo",
                sql.VarChar(20),
                nuevo
            )
            .input(
                "tiempo",
                sql.Int,
                tiempo
            )
            .query(`
                UPDATE dbo.PedidosMercaGo
                SET
                    Estado = @nuevo,

                    TiempoEstimadoMin =
                        COALESCE(
                            @tiempo,
                            TiempoEstimadoMin
                        ),

                    FechaActualizacion =
                        SYSUTCDATETIME()

                WHERE IdPedido = @id
            `);

        // ====================================
        // PATRÓN OBSERVER
        // REGISTRAR EVENTOS Y NOTIFICACIONES
        // ====================================

        await publicarCambio(
            tx,
            sql,
            {
                idPedido: id,

                idUsuario:
                    pedido.IdUsuario,

                anterior:
                    pedido.Estado,

                nuevo
            }
        );

        // ====================================
        // CONFIRMAR TRANSACCIÓN
        // ====================================

        await tx.commit();

        iniciada = false;

        return res.json({
            pedido: {
                id,
                estado: nuevo
            }
        });

    } catch (error) {

        // Si ocurre un error, también se
        // revierten los movimientos y la
        // devolución de existencias.

        if (iniciada && tx) {

            try {

                await tx.rollback();

            } catch (rollbackError) {

                console.error(
                    "Error al revertir pedido:",
                    rollbackError
                );
            }
        }

        return manejar(res, error);
    }
}

// ============================================
// CONSULTAR NOTIFICACIONES DEL CLIENTE
// ============================================

async function notificaciones(req, res) {

    try {

        if (
            req.auth.rol !== "CLIENTE"
        ) {
            throw fail(
                403,
                "Solo clientes pueden consultar notificaciones"
            );
        }

        const pool = await conectarDB();

        const resultado = await pool.request()
            .input(
                "usuario",
                sql.Int,
                req.auth.sub
            )
            .query(`
                SELECT
                    IdNotificacion AS idNotificacion,
                    IdPedido AS idPedido,
                    Mensaje AS mensaje,
                    Fecha AS fecha,
                    Leida AS leida
                FROM dbo.NotificacionesMercaGo
                WHERE IdUsuario = @usuario
                ORDER BY
                    Fecha DESC,
                    IdNotificacion DESC
            `);

        return res.json(
            resultado.recordset
        );

    } catch (error) {

        return manejar(res, error);
    }
}

// ============================================
// MARCAR UNA NOTIFICACIÓN COMO LEÍDA
// ============================================

async function marcarNotificacionLeida(req, res) {

    try {

        if (
            req.auth.rol !== "CLIENTE"
        ) {
            throw fail(
                403,
                "Solo clientes pueden marcar notificaciones"
            );
        }

        const id = Number(req.params.id);

        if (
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            throw fail(
                400,
                "Identificador de notificación inválido"
            );
        }

        const pool = await conectarDB();

        // El usuario se toma de la sesión
        // autenticada, no del cliente.

        const resultado = await pool.request()
            .input(
                "notificacion",
                sql.Int,
                id
            )
            .input(
                "usuario",
                sql.Int,
                req.auth.sub
            )
            .query(`
                UPDATE dbo.NotificacionesMercaGo
                SET Leida = 1

                OUTPUT
                    INSERTED.IdNotificacion
                        AS idNotificacion,

                    INSERTED.IdPedido
                        AS idPedido,

                    INSERTED.Leida
                        AS leida

                WHERE
                    IdNotificacion = @notificacion
                    AND IdUsuario = @usuario
            `);

        if (
            !resultado.recordset.length
        ) {
            throw fail(
                404,
                "Notificación no encontrada"
            );
        }

        return res.json({
            mensaje:
                "Notificación marcada como leída",

            notificacion:
                resultado.recordset[0]
        });

    } catch (error) {

        return manejar(res, error);
    }
}

// ============================================
// MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
// ============================================

async function marcarTodasNotificacionesLeidas(req, res) {

    try {

        if (
            req.auth.rol !== "CLIENTE"
        ) {
            throw fail(
                403,
                "Solo clientes pueden marcar notificaciones"
            );
        }

        const pool = await conectarDB();

        const resultado = await pool.request()
            .input(
                "usuario",
                sql.Int,
                req.auth.sub
            )
            .query(`
                UPDATE dbo.NotificacionesMercaGo
                SET Leida = 1
                WHERE
                    IdUsuario = @usuario
                    AND Leida = 0;

                SELECT
                    COUNT(*) AS pendientes
                FROM dbo.NotificacionesMercaGo
                WHERE
                    IdUsuario = @usuario
                    AND Leida = 0;
            `);

        const pendientes =
            resultado.recordsets?.[0]?.[0]
                ?.pendientes ?? 0;

        return res.json({
            mensaje:
                "Todas las notificaciones fueron marcadas como leídas",

            pendientes
        });

    } catch (error) {

        return manejar(res, error);
    }
}

// ============================================
// EXPORTACIONES
// ============================================

module.exports = {
    confirmar,
    listar,
    detalle,
    cambiar,
    notificaciones,
    marcarNotificacionLeida,
    marcarTodasNotificacionesLeidas
};

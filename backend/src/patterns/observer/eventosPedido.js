
/**
 * ============================================
 * MERCAGO - PATRÓN OBSERVER
 * ============================================
 *
 * Responsabilidades:
 * - Registrar cambios de estado de pedidos.
 * - Generar notificaciones para el cliente.
 * - Informar cuando el pedido:
 *      1. Sale en camino.
 *      2. Es entregado.
 *      3. Es cancelado.
 *
 * Las notificaciones se guardan en SQL Server.
 * ============================================
 */

async function publicarCambio(tx, sql, evento) {

    const {
        idPedido,
        idUsuario,
        anterior,
        nuevo
    } = evento;

    // ========================================
    // 1. REGISTRAR CAMBIO DE ESTADO
    // ========================================

    await new sql.Request(tx)
        .input("id", sql.Int, idPedido)
        .input("anterior", sql.VarChar(20), anterior)
        .input("nuevo", sql.VarChar(20), nuevo)
        .query(`
            INSERT INTO dbo.EventosPedidoMercaGo (
                IdPedido,
                EstadoAnterior,
                EstadoNuevo
            )
            VALUES (
                @id,
                @anterior,
                @nuevo
            )
        `);

    // ========================================
    // 2. DEFINIR MENSAJE SEGÚN ESTADO
    // ========================================

    let mensaje = null;

    switch (nuevo) {

        case "En camino":

            mensaje =
                `🚚 Tu pedido #MG-${idPedido} ` +
                `va en camino. Pronto llegará ` +
                `a tu dirección de entrega.`;

            break;

        case "Entregado":

            mensaje =
                `✅ Tu pedido #MG-${idPedido} ` +
                `ha sido entregado correctamente. ` +
                `¡Gracias por comprar en MercaGo!`;

            break;

        case "Cancelado":

            mensaje =
                `❌ Tu pedido #MG-${idPedido} ` +
                `fue cancelado. Las unidades ` +
                `reservadas regresaron al inventario.`;

            break;

        default:
            // Otros estados no generan notificación
            break;
    }

    // ========================================
    // 3. GUARDAR NOTIFICACIÓN EN SQL SERVER
    // ========================================

    if (mensaje !== null) {

        await new sql.Request(tx)
            .input("usuario", sql.Int, idUsuario)
            .input("pedido", sql.Int, idPedido)
            .input(
                "mensaje",
                sql.NVarChar(300),
                mensaje
            )
            .query(`
                INSERT INTO dbo.NotificacionesMercaGo (
                    IdUsuario,
                    IdPedido,
                    Mensaje,
                    Fecha,
                    Leida
                )
                VALUES (
                    @usuario,
                    @pedido,
                    @mensaje,
                    SYSUTCDATETIME(),
                    0
                )
            `);

        console.log(
            `[OBSERVER] Pedido ${idPedido}: ${anterior} -> ${nuevo}`
        );

        console.log(
            `[OBSERVER] Notificación registrada para usuario ${idUsuario}`
        );
    }
}

// ============================================
// EXPORTAR FUNCIONES
// ============================================

module.exports = {
    publicarCambio
};

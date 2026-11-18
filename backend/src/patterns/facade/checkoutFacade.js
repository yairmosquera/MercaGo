/**
 * MERCAGO - FACADE DE CHECKOUT
 * Fase 14.3: costo historico por linea de pedido.
 * Conserva la salida de inventario auditada en la misma transaccion.
 */

const { sql, conectarDB } = require("../../config/database");
const { limpiarItems } = require("./validarCarrito");
const {
    registrarMovimientoInventario,
    TIPOS_MOVIMIENTO
} = require("../../services/movimientoInventarioService");

const DOMICILIO = 4000;
const fail = (status, mensaje) =>
    Object.assign(new Error(mensaje), { status });

async function confirmar({ idUsuario, items, direccion, telefono }) {
    const lineas = limpiarItems(items);

    if (
        !Number.isSafeInteger(Number(idUsuario)) ||
        Number(idUsuario) < 1
    ) {
        throw fail(401, "Usuario invalido");
    }

    if (
        typeof direccion !== "string" ||
        !direccion.trim() ||
        direccion.trim().length > 300 ||
        typeof telefono !== "string" ||
        !telefono.trim() ||
        telefono.trim().length > 40
    ) {
        throw fail(400, "Direccion y telefono son obligatorios");
    }

    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    let commitRealizado = false;

    try {
        const detalles = [];

        // Bloqueo transaccional para evitar compras simultaneas
        // que superen las existencias disponibles.
        for (const item of lineas) {
            const resultado = await new sql.Request(tx)
                .input("id", sql.Int, item.id)
                .query(`
                    SELECT
                        IdProducto,
                        Nombre,
                        Precio,
                        CostoUnitario,
                        Stock
                    FROM dbo.Productos WITH (UPDLOCK, HOLDLOCK)
                    WHERE IdProducto = @id AND Activo = 1
                `);

            const producto = resultado.recordset[0];

            if (!producto) {
                throw fail(409, `Producto ${item.id} no disponible`);
            }

            if (producto.Stock < item.qty) {
                throw fail(409, `Stock insuficiente para ${producto.Nombre}`);
            }

            const precio = Number(producto.Precio);
            if (!Number.isFinite(precio) || precio < 0) {
                throw fail(500, "Precio invalido en base de datos");
            }

            // NULL significa costo aun no registrado.
            // NO reemplazar por cero: eso inflaria la utilidad.
            const costo = producto.CostoUnitario == null
                ? null
                : Number(producto.CostoUnitario);

            if (costo !== null && (!Number.isFinite(costo) || costo < 0)) {
                throw fail(500, "Costo invalido en base de datos");
            }

            detalles.push({
                id: item.id,
                nombre: producto.Nombre,
                cantidad: item.qty,
                precio,
                costo,
                subtotal: precio * item.qty
            });
        }

        const subtotal = detalles.reduce(
            (acumulado, detalle) => acumulado + detalle.subtotal,
            0
        );
        const total = subtotal + DOMICILIO;

        const pedidoResult = await new sql.Request(tx)
            .input("usuario", sql.Int, Number(idUsuario))
            .input("direccion", sql.NVarChar(300), direccion.trim())
            .input("telefono", sql.NVarChar(40), telefono.trim())
            .input("subtotal", sql.Decimal(18, 2), subtotal)
            .input("domicilio", sql.Decimal(18, 2), DOMICILIO)
            .input("total", sql.Decimal(18, 2), total)
            .query(`
                INSERT INTO dbo.PedidosMercaGo
                    (IdUsuario, DireccionEntrega, Telefono,
                     Subtotal, CostoDomicilio, Total)
                OUTPUT INSERTED.IdPedido
                VALUES
                    (@usuario, @direccion, @telefono,
                     @subtotal, @domicilio, @total)
            `);

        const idPedido = pedidoResult.recordset[0].IdPedido;

        for (const detalle of detalles) {
            // La actualizacion y la auditoria deben estar
            // dentro de ESTA MISMA transaccion.
            const stockResult = await new sql.Request(tx)
                .input("id", sql.Int, detalle.id)
                .input("cantidad", sql.Int, detalle.cantidad)
                .query(`
                    UPDATE dbo.Productos
                    SET Stock = Stock - @cantidad
                    OUTPUT
                        DELETED.Stock AS stockAnterior,
                        INSERTED.Stock AS stockNuevo
                    WHERE IdProducto = @id
                      AND Activo = 1
                      AND Stock >= @cantidad
                `);

            const movimiento = stockResult.recordset[0];
            if (!movimiento) {
                throw fail(409, `Stock insuficiente para ${detalle.nombre}`);
            }

            // El precio y el costo se congelan en el detalle.
            // Cambiar Productos.CostoUnitario mas adelante no
            // modifica la informacion historica de esta compra.
            await new sql.Request(tx)
                .input("pedido", sql.Int, idPedido)
                .input("producto", sql.Int, detalle.id)
                .input("nombre", sql.NVarChar(255), detalle.nombre)
                .input("cantidad", sql.Int, detalle.cantidad)
                .input("precio", sql.Decimal(18, 2), detalle.precio)
                .input("costo", sql.Decimal(18, 2), detalle.costo)
                .input("subtotal", sql.Decimal(18, 2), detalle.subtotal)
                .query(`
                    INSERT INTO dbo.DetallesPedidoMercaGo
                        (IdPedido, IdProducto, NombreProducto,
                         Cantidad, PrecioUnitario, CostoUnitario, Subtotal)
                    VALUES
                        (@pedido, @producto, @nombre,
                         @cantidad, @precio, @costo, @subtotal)
                `);

            await registrarMovimientoInventario(tx, {
                idProducto: detalle.id,
                idUsuario: Number(idUsuario),
                stockAnterior: movimiento.stockAnterior,
                stockNuevo: movimiento.stockNuevo,
                tipo: TIPOS_MOVIMIENTO.COMPRA,
                motivo: `Salida por compra del pedido #${idPedido}`
            });
        }

        await tx.commit();
        commitRealizado = true;

        return {
            id: idPedido,
            estado: "Pendiente",
            subtotal,
            costoDomicilio: DOMICILIO,
            total
        };
    } catch (error) {
        if (!commitRealizado) {
            try {
                await tx.rollback();
            } catch (rollbackError) {
                console.error("No se pudo revertir el checkout:", rollbackError);
            }
        }
        throw error;
    }
}

module.exports = { confirmar, limpiarItems };

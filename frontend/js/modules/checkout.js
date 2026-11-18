
/**
 * MERCAGO - CHECKOUT
 * Confirmación de pedidos reales
 */

function updateCheckout() {
    const subtotal = calcularSubtotal();

    document.getElementById("checkoutSubtotal").textContent =
        money(subtotal);

    document.getElementById("checkoutDomicilio").textContent =
        money(COSTO_DOMICILIO);

    document.getElementById("checkoutTotal").textContent =
        money(subtotal + COSTO_DOMICILIO);
}

// ============================================
// CONFIRMAR PEDIDO
// ============================================

async function confirmOrder() {

    if (procesandoPedido) return;

    const boton = document.getElementById("btnConfirmarPedido");
    const mensaje = document.getElementById("checkoutMensaje");

    const direccion = document.getElementById(
        "checkoutDireccion"
    ).value.trim();

    const telefono = document.getElementById(
        "checkoutTelefono"
    ).value.trim();

    mensaje.textContent = "";

    if (!authToken || !currentUser) {
        toast("Debes iniciar sesión");
        await go("login");
        return;
    }

    if (currentUser.rol !== "CLIENTE") {
        mensaje.textContent =
            "Debes ingresar con una cuenta de cliente.";
        return;
    }

    if (cart.length === 0) {
        mensaje.textContent = "Tu carrito está vacío.";
        return;
    }

    if (!direccion || direccion.length > 300) {
        mensaje.textContent =
            "Ingresa una dirección válida (máximo 300 caracteres).";
        return;
    }

    if (!telefono || telefono.length > 40) {
        mensaje.textContent =
            "Ingresa un teléfono válido.";
        return;
    }

    const datosPedido = {
        direccion,
        telefono,
        items: cart.map(item => ({
            id: item.id,
            qty: item.qty
        }))
    };

    procesandoPedido = true;

    boton.disabled = true;
    boton.textContent = "Procesando pedido...";

    let registrado = false;

    try {
        const resultado = await apiRequest("/pedidos", {
            method: "POST",
            body: JSON.stringify(datosPedido)
        });

        const pedido = resultado.pedido;

        if (!pedido || !pedido.id) {
            throw new Error(
                "El servidor no devolvió el número del pedido."
            );
        }

        registrado = true;
        ultimoPedido = pedido;
        pedidoSeleccionado = pedido.id;

        sessionStorage.setItem(
            "mercago_ultimo_pedido",
            String(pedido.id)
        );

        cart = [];
        updateCartCount();

        mostrarPedidoConfirmado(pedido);

        await go("confirmed");

        toast("¡Pedido registrado correctamente!");

        // El pedido ya existe. No se vuelve a enviar.
        await cargarProductos();

    } catch (error) {
        console.error("Error al confirmar pedido:", error);

        if (registrado) {
            toast(
                "Pedido registrado; no se pudo actualizar el catálogo."
            );
        } else {
            mensaje.textContent = error.message;

            if (
                error.message.includes("conectar") ||
                error.message.includes("servidor")
            ) {
                mensaje.textContent +=
                    " Comprueba Mis pedidos antes de reintentar.";
            }

            toast("No se pudo confirmar el pedido");
        }

    } finally {
        procesandoPedido = false;
        boton.disabled = false;
        boton.textContent = "Confirmar pedido";
    }
}

// ============================================
// MOSTRAR CONFIRMACIÓN
// ============================================

function mostrarPedidoConfirmado(pedido) {

    const numero = "#MG-" + pedido.id;

    document.getElementById(
        "numeroPedidoConfirmado"
    ).textContent = numero;

    document.getElementById(
        "confirmNumero"
    ).textContent = numero;

    document.getElementById(
        "confirmEstado"
    ).textContent = pedido.estado;

    document.getElementById(
        "confirmSubtotal"
    ).textContent = money(pedido.subtotal);

    document.getElementById(
        "confirmDomicilio"
    ).textContent = money(pedido.costoDomicilio);

    document.getElementById(
        "confirmTotal"
    ).textContent = money(pedido.total);
}

console.log("MercaGo: checkout.js cargado");

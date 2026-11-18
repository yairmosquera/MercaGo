
const error = (status, message) =>
    Object.assign(new Error(message), { status });

function limpiarItems(items) {

    if (
        !Array.isArray(items) ||
        items.length < 1 ||
        items.length > 100
    ) {
        throw error(400, "El carrito no es válido");
    }

    const cantidades = new Map();

    for (const item of items) {

        if (
            !Number.isSafeInteger(item.id) ||
            item.id < 1 ||
            !Number.isSafeInteger(item.qty) ||
            item.qty < 1 ||
            item.qty > 1000
        ) {
            throw error(
                400,
                "Hay productos o cantidades inválidas"
            );
        }

        const total =
            (cantidades.get(item.id) || 0) + item.qty;

        if (total > 1000) {
            throw error(400, "Cantidad máxima superada");
        }

        cantidades.set(item.id, total);
    }

    return [...cantidades].map(([id, qty]) => ({
        id,
        qty
    })).sort((a, b) => a.id - b.id);
}

module.exports = { limpiarItems };

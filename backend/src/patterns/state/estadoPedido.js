
const transiciones = Object.freeze({

    "Pendiente": {
        despachar: "En camino",
        cancelar: "Cancelado"
    },

    "En camino": {
        entregar: "Entregado"
    },

    "Entregado": {},

    "Cancelado": {}
});

function siguienteEstado(actual, accion) {

    const nuevo = transiciones[actual]?.[accion];

    if (!nuevo) {
        const error = new Error(
            `No se puede ${accion} un pedido ${actual}`
        );

        error.status = 409;
        throw error;
    }

    return nuevo;
}

module.exports = {
    siguienteEstado
};

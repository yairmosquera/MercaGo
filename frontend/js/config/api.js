
/**
 * MERCAGO - COMUNICACIÓN CON LA API REST
 * Este archivo debe cargarse antes de auth.js y app.js
 */

const API_BASE = "http://localhost:3000/api";

async function apiRequest(ruta, opciones = {}) {

    const headers = {
        ...opciones.headers
    };

    // Agregar token si existe
    const token = sessionStorage.getItem("mercago_token");

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // Agregar Content-Type para JSON
    if (opciones.body != null) {
        headers["Content-Type"] = "application/json";
    }

    let respuesta;

    try {
        respuesta = await fetch(API_BASE + ruta, {
            ...opciones,
            headers
        });
    } catch (error) {
        console.error("Error de conexión:", error);

        throw new Error(
            "No fue posible conectar con la API de MercaGo en localhost:3000."
        );
    }

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
        throw new Error(
            datos.mensaje || `Error HTTP ${respuesta.status}`
        );
    }

    return datos;
}

console.log("MercaGo: api.js cargado correctamente");

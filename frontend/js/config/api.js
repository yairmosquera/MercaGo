
/**
 * ============================================
 * MERCAGO - COMUNICACIÓN API REST
 * DESARROLLO + PRODUCCIÓN
 * ============================================
 *
 * En MonsterASP.NET:
 *     https://tu-sitio/api
 *
 * En desarrollo con Express:
 *     http://localhost:3000/api
 *
 * En desarrollo con Live Server (5500):
 *     http://localhost:3000/api
 */

// ============================================
// DIRECCIÓN DE LA API
// ============================================

const API_BASE = (() => {

    const hostname = window.location.hostname;

    const puerto = window.location.port;

    const desarrolloLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1";

    // Cuando utilizamos Live Server,
    // la API sigue ejecutándose en el 3000.

    if (
        desarrolloLocal &&
        puerto !== "3000"
    ) {
        return "http://localhost:3000/api";
    }

    // Producción o desarrollo servido
    // directamente desde Express.

    return "/api";

})();

// ============================================
// PETICIONES A LA API
// ============================================

async function apiRequest(
    ruta,
    opciones = {}
) {

    const headers = {
        ...opciones.headers
    };

    // ========================================
    // AUTENTICACIÓN
    // ========================================

    const token = sessionStorage.getItem(
        "mercago_token"
    );

    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }

    // ========================================
    // CONTENIDO JSON
    // ========================================

    if (
        opciones.body != null &&
        !(opciones.body instanceof FormData)
    ) {

        headers["Content-Type"] =
            "application/json";
    }

    // ========================================
    // EJECUTAR PETICIÓN
    // ========================================

    let respuesta;

    try {

        respuesta = await fetch(
            API_BASE + ruta,
            {
                ...opciones,
                headers
            }
        );

    } catch (error) {

        console.error(
            "Error de conexión con MercaGo:",
            error
        );

        throw new Error(
            "No fue posible conectar con el servidor de MercaGo."
        );
    }

    // ========================================
    // LEER RESPUESTA
    // ========================================

    const datos = await respuesta
        .json()
        .catch(() => ({}));

    // ========================================
    // ERRORES HTTP
    // ========================================

    if (!respuesta.ok) {

        throw new Error(
            datos.mensaje ||
            `Error HTTP ${respuesta.status}`
        );
    }

    return datos;
}

// ============================================
// INFORMACIÓN DE INICIO
// ============================================

console.log(
    "MercaGo: api.js cargado correctamente"
);

console.log(
    "API configurada:",
    API_BASE
);


/**
 * MERCAGO - AUTENTICACIÓN
 * Control de inicio de sesión, roles y cierre de sesión.
 */

// Estado compartido con app.js
let authToken = sessionStorage.getItem("mercago_token");
let currentUser = null;

// ============================================
// ACTUALIZAR BOTÓN DE SESIÓN
// ============================================

function updateSessionUI() {

    const boton = document.getElementById("sessionButton");

    if (!boton) return;

    boton.textContent = currentUser
        ? `Salir (${currentUser.nombre})`
        : "Ingresar";
}

// ============================================
// BOTÓN INGRESAR / SALIR
// ============================================

function sessionAction() {

    if (currentUser) {
        logout();
    } else {
        go("login");
    }
}

// ============================================
// CERRAR SESIÓN
// ============================================

function logout() {

    sessionStorage.removeItem("mercago_token");
    sessionStorage.removeItem("mercago_ultimo_pedido");

    authToken = null;
    currentUser = null;

    // Limpiar información del usuario anterior
    cart = [];
    pedidos = [];
    pedidoSeleccionado = null;
    ultimoPedido = null;

    updateCartCount();
    updateSessionUI();

    go("home");
    toast("Sesión cerrada correctamente");
}

// ============================================
// RECUPERAR SESIÓN
// ============================================

async function restoreSession() {

    authToken = sessionStorage.getItem("mercago_token");

    if (!authToken) {
        currentUser = null;
        updateSessionUI();
        return;
    }

    try {

        const respuesta = await apiRequest("/auth/perfil");

        if (!respuesta.usuario) {
            throw new Error("Perfil inválido");
        }

        currentUser = respuesta.usuario;

    } catch (error) {

        console.warn(
            "No se pudo restaurar la sesión:",
            error.message
        );

        authToken = null;
        currentUser = null;

        sessionStorage.removeItem("mercago_token");
    }

    updateSessionUI();
}

// ============================================
// INICIAR SESIÓN
// ============================================

async function login(event) {

    if (event) {
        event.preventDefault();
    }

    const correo = document.getElementById(
        "loginCorreo"
    ).value.trim();

    const contrasena = document.getElementById(
        "loginContrasena"
    ).value;

    const errorElement = document.getElementById(
        "loginError"
    );

    const boton = document.getElementById(
        "loginSubmit"
    );

    errorElement.textContent = "";

    boton.disabled = true;
    boton.textContent = "Validando...";

    try {

        // 1. Autenticar credenciales
        const datos = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                correo,
                contrasena
            })
        });

        if (!datos.token || !datos.usuario) {
            throw new Error(
                "El servidor devolvió una respuesta de autenticación inválida."
            );
        }

        // 2. Guardar temporalmente el token
        const tokenAnterior = authToken;

        authToken = datos.token;

        sessionStorage.setItem(
            "mercago_token",
            authToken
        );

        // 3. Validar token y obtener perfil
        try {

            const perfil = await apiRequest("/auth/perfil");

            if (!perfil.usuario) {
                throw new Error(
                    "No se pudo obtener el perfil del usuario."
                );
            }

            currentUser = perfil.usuario;

        } catch (error) {

            authToken = tokenAnterior;
            currentUser = null;

            if (tokenAnterior) {
                sessionStorage.setItem(
                    "mercago_token",
                    tokenAnterior
                );
            } else {
                sessionStorage.removeItem("mercago_token");
            }

            throw error;
        }

        // 4. Actualizar interfaz
        document.getElementById(
            "loginContrasena"
        ).value = "";

        updateSessionUI();

        toast(`Bienvenido, ${currentUser.nombre}`);

        // 5. Navegación según rol
        if (currentUser.rol === "ADMINISTRADOR") {
            await go("admin");
        } else {
            await go("home");
        }

    } catch (error) {

        console.error("Error en inicio de sesión:", error);

        errorElement.textContent = error.message;

    } finally {

        boton.disabled = false;
        boton.textContent = "Ingresar";
    }
}

console.log("MercaGo: auth.js cargado correctamente");


/**
 * ============================================
 * MERCAGO - SERVIDOR PRINCIPAL
 * NODE.JS + EXPRESS
 * DESARROLLO LOCAL + MONSTERASP.NET
 * ============================================
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// ============================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ============================================

// Localiza .env dentro de backend,
// independientemente de dónde ejecutes npm.

const envPath = path.join(
    __dirname,
    ".env"
);

// MonsterASP.NET utiliza variables
// configuradas desde el panel.
// dotenv no sobrescribe variables existentes.

require("dotenv").config({
    path: envPath,
    override: false
});

// ============================================
// VALIDACIÓN DE CONFIGURACIÓN
// ============================================

const esProduccion =
    process.env.NODE_ENV === "production";

const PORT = Number(
    process.env.PORT || 3000
);

if (
    !Number.isInteger(PORT) ||
    PORT < 1 ||
    PORT > 65535
) {
    throw new Error(
        "El puerto configurado no es válido"
    );
}

const variablesNecesarias = [
    "DB_SERVER",
    "DB_DATABASE",
    "DB_USER",
    "DB_PASSWORD",
    "AUTH_SECRET"
];

const faltantes = variablesNecesarias.filter(
    nombre => !process.env[nombre]
);

if (faltantes.length > 0) {

    console.error(
        "❌ Variables de entorno faltantes:",
        faltantes.join(", ")
    );

    throw new Error(
        "Configuración incompleta de MercaGo"
    );
}

if (process.env.AUTH_SECRET.length < 32) {

    throw new Error(
        "AUTH_SECRET debe tener al menos 32 caracteres"
    );
}

// ============================================
// IMPORTACIÓN DE RUTAS
// ============================================

// Se importan después de cargar .env.

const productoRoutes = require(
    "./src/routes/productoRoutes"
);

const authRoutes = require(
    "./src/routes/authRoutes"
);

const pedidoRoutes = require(
    "./src/routes/pedidoRoutes"
);

// ============================================
// CONFIGURACIÓN DE EXPRESS
// ============================================

const app = express();

// Carpeta frontend ubicada al mismo
// nivel que backend.

const frontendPath = path.resolve(
    __dirname,
    "../frontend"
);

// ============================================
// MIDDLEWARES
// ============================================

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: "1mb"
    })
);

// En desarrollo se permite CORS para
// utilizar Live Server en el puerto 5500.
// En producción se usa el mismo dominio.

if (!esProduccion) {
    app.use(cors());
}

// ============================================
// RUTA DE ESTADO DE LA API
// ============================================

app.get("/api", (req, res) => {

    return res.status(200).json({

        proyecto: "MercaGo",

        mensaje:
            "API funcionando correctamente",

        estado: "OK",

        ambiente:
            esProduccion
                ? "Producción"
                : "Desarrollo"
    });
});

// ============================================
// RUTAS DEL SISTEMA
// ============================================

// PRODUCTOS

app.use(
    "/api/productos",
    productoRoutes
);

// AUTENTICACIÓN Y CLIENTES

app.use(
    "/api/auth",
    authRoutes
);

// PEDIDOS Y REPORTES

app.use(
    "/api/pedidos",
    pedidoRoutes
);

// ============================================
// VALIDACIÓN DEL FRONTEND
// ============================================

const indexPath = path.join(
    frontendPath,
    "index.html"
);

if (!fs.existsSync(indexPath)) {

    console.warn(
        "⚠ No se encontró frontend/index.html"
    );

    console.warn(
        "Ruta esperada:",
        indexPath
    );
}

// ============================================
// FRONTEND ESTÁTICO
// ============================================

// Publica:
// - index.html
// - css
// - js
// - imágenes y recursos estáticos

app.use(
    express.static(
        frontendPath,
        {
            index: "index.html",
            dotfiles: "ignore"
        }
    )
);

// ============================================
// PÁGINA PRINCIPAL
// ============================================

app.get("/", (req, res) => {

    return res.sendFile(indexPath);
});

// ============================================
// RUTAS NO ENCONTRADAS
// ============================================

app.use((req, res) => {

    if (
        req.originalUrl.startsWith("/api")
    ) {

        return res.status(404).json({
            mensaje:
                "Ruta de API no encontrada",
            ruta: req.originalUrl
        });
    }

    return res.status(404).send(
        "Página no encontrada"
    );
});

// ============================================
// MANEJO GLOBAL DE ERRORES
// ============================================

app.use((err, req, res, next) => {

    console.error(
        "❌ Error del servidor:",
        err.message
    );

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({
        mensaje:
            "Error interno del servidor"
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const servidor = app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "===================================="
        );

        console.log(
            "          MERCAGO"
        );

        console.log(
            "===================================="
        );

        console.log(
            "✅ Servidor iniciado correctamente"
        );

        console.log(
            "Ambiente:",
            esProduccion
                ? "Producción"
                : "Desarrollo"
        );

        console.log(
            "Puerto:",
            PORT
        );

        console.log(
            "Base de datos configurada:",
            process.env.DB_DATABASE
        );

        console.log(
            "Servidor SQL configurado:",
            process.env.DB_SERVER
        );

        console.log(
            "Autenticación:",
            "AUTH_SECRET configurada"
        );

        console.log(
            "Frontend:",
            frontendPath
        );

        console.log(
            "API: /api"
        );

        if (!esProduccion) {

            console.log(
                `Sitio local: http://localhost:${PORT}`
            );

            console.log(
                `Productos: http://localhost:${PORT}/api/productos`
            );
        }

        console.log(
            "===================================="
        );
    }
);

// ============================================
// ERRORES AL ABRIR EL PUERTO
// ============================================

servidor.on("error", error => {

    console.error(
        "❌ No se pudo iniciar el servidor:",
        error.message
    );

    process.exitCode = 1;
});

module.exports = app;

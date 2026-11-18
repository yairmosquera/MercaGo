
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// ============================================
// IMPORTACIÓN DE RUTAS
// ============================================

const productoRoutes = require("./src/routes/productoRoutes");
const authRoutes = require("./src/routes/authRoutes");
const pedidoRoutes = require("./src/routes/pedidoRoutes");

// ============================================
// CONFIGURACIÓN
// ============================================

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================
// RUTA PRINCIPAL
// ============================================

app.get("/api", (req, res) => {
    res.status(200).json({
        proyecto: "MercaGo",
        mensaje: "API funcionando correctamente",
        estado: "OK"
    });
});

// ============================================
// RUTAS DEL SISTEMA
// ============================================

// Productos
app.use("/api/productos", productoRoutes);

// Autenticación
app.use("/api/auth", authRoutes);

// Pedidos
app.use("/api/pedidos", pedidoRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use((req, res) => {
    res.status(404).json({
        mensaje: "Ruta no encontrada",
        ruta: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error("Error:", err.message);

    res.status(500).json({
        mensaje: "Error interno del servidor"
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {

    console.log("================================");
    console.log("         MERCAGO - API");
    console.log("================================");

    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);

    console.log(
        `Productos: http://localhost:${PORT}/api/productos`
    );

    console.log(
        `Autenticación: http://localhost:${PORT}/api/auth/login`
    );

    console.log(
        `Pedidos: http://localhost:${PORT}/api/pedidos`
    );

    console.log("================================");
    console.log("Servidor iniciado correctamente");
});

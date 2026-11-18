const express = require("express");
const cors = require("cors");
require("dotenv").config();

const productoRoutes = require("./src/routes/productoRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/api", (req, res) => {
    res.status(200).json({
        proyecto: "MercaGo",
        mensaje: "API funcionando correctamente",
        estado: "OK"
    });
});

// Rutas de productos
app.use("/api/productos", productoRoutes);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        mensaje: "Ruta no encontrada"
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log("================================");
    console.log("       MERCAGO - API");
    console.log("================================");
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Productos: http://localhost:${PORT}/api/productos`);
});
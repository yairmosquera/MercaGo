
/**
 * ============================================
 * MERCAGO - RUTAS DE PRODUCTOS
 * FASE 15 - AUDITORÍA DE COSTOS
 * ============================================
 */

const express = require("express");

const controller = require(
    "../controllers/productoController"
);

const auditoria = require(
    "../controllers/inventarioAuditoriaController"
);

const costosController = require(
    "../controllers/costosController"
);

const {
    requiereSesion,
    requiereRol
} = require("../middleware/auth");

const router = express.Router();

// ============================================
// CATÁLOGO PÚBLICO
// ============================================

router.get(
    "/",
    controller.obtenerProductos
);

// ============================================
// ADMINISTRACIÓN
// ============================================

router.use(requiereSesion);

router.use(
    requiereRol("ADMINISTRADOR")
);

// Categorías

router.get(
    "/categorias",
    controller.obtenerCategorias
);

// Inventario completo

router.get(
    "/admin",
    controller.listarAdministracion
);

// Movimientos de inventario

router.get(
    "/admin/movimientos",
    auditoria.listarMovimientos
);

// Costos actuales

router.get(
    "/admin/costos",
    costosController.listarCostos
);

// Historial de cambios de costos

router.get(
    "/admin/costos/historial",
    costosController.listarHistorialCostos
);

// Crear producto

router.post(
    "/",
    controller.crearProducto
);

// Editar producto

router.put(
    "/:id",
    controller.editarProducto
);

// Stock con auditoría

router.patch(
    "/:id/stock",
    auditoria.actualizarStockConAuditoria
);

// Activar/desactivar

router.patch(
    "/:id/activo",
    controller.cambiarActivo
);

// Actualizar costo con auditoría

router.patch(
    "/:id/costo",
    costosController.actualizarCosto
);

module.exports = router;

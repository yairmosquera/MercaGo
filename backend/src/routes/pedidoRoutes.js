
/**
 * MERCAGO - RUTAS DE PEDIDOS
 * FASE 14.4
 */

const router = require("express").Router();

const controller = require(
    "../controllers/pedidoController"
);

const reporteVentas = require(
    "../controllers/reporteVentasController"
);

const analisisVentas = require(
    "../controllers/analisisVentasController"
);

const rentabilidad = require(
    "../controllers/rentabilidadController"
);

const {
    requiereSesion,
    requiereRol
} = require("../middleware/auth");

router.use(requiereSesion);

// ============================================
// REPORTES ADMINISTRATIVOS
// ============================================

router.get(
    "/admin/reporte-ventas",
    requiereRol("ADMINISTRADOR"),
    reporteVentas.obtenerReporteVentas
);

router.get(
    "/admin/analisis-ventas",
    requiereRol("ADMINISTRADOR"),
    analisisVentas.obtenerAnalisisVentas
);

router.get(
    "/admin/rentabilidad",
    requiereRol("ADMINISTRADOR"),
    rentabilidad.obtenerRentabilidad
);

// ============================================
// NOTIFICACIONES
// ============================================

router.get(
    "/notificaciones",
    requiereRol("CLIENTE"),
    controller.notificaciones
);

router.patch(
    "/notificaciones/leer-todas",
    requiereRol("CLIENTE"),
    controller.marcarTodasNotificacionesLeidas
);

router.patch(
    "/notificaciones/:id/leer",
    requiereRol("CLIENTE"),
    controller.marcarNotificacionLeida
);

// ============================================
// PEDIDOS
// ============================================

router.post(
    "/",
    controller.confirmar
);

router.get(
    "/",
    controller.listar
);

router.get(
    "/:id",
    controller.detalle
);

// ============================================
// CANCELAR PEDIDO
// ============================================

router.patch(
    "/:id/cancelar",
    (req, res) => {
        req.params.accion = "cancelar";
        return controller.cambiar(req, res);
    }
);

// ============================================
// DESPACHAR PEDIDO
// ============================================

router.patch(
    "/:id/despachar",
    requiereRol("ADMINISTRADOR"),
    (req, res) => {
        req.params.accion = "despachar";
        return controller.cambiar(req, res);
    }
);

// ============================================
// ENTREGAR PEDIDO
// ============================================

router.patch(
    "/:id/entregar",
    requiereRol("ADMINISTRADOR"),
    (req, res) => {
        req.params.accion = "entregar";
        return controller.cambiar(req, res);
    }
);

module.exports = router;

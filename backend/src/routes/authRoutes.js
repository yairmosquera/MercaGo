/** MERCAGO - AUTENTICACIÓN - FASE 16.2 */
const router = require('express').Router();
const { login, perfil, registrarCliente } = require('../controllers/authController');
const perfilCliente = require('../controllers/perfilClienteController');
const direcciones = require('../controllers/direccionesClienteController');
const { requiereSesion, requiereRol } = require('../middleware/auth');

router.post('/login', login);
router.post('/registro', registrarCliente);
router.get('/perfil', requiereSesion, perfil);

// Perfil del cliente: siempre se usa el ID del token, no un ID del cuerpo.
router.get('/mi-perfil', requiereSesion, requiereRol('CLIENTE'), perfilCliente.miPerfil);
router.patch('/mi-perfil', requiereSesion, requiereRol('CLIENTE'), perfilCliente.actualizarMiPerfil);
router.patch('/mi-perfil/contrasena', requiereSesion, requiereRol('CLIENTE'), perfilCliente.cambiarMiContrasena);

// Fase 17: direcciones privadas del cliente (ID tomado del token).
router.get('/direcciones', requiereSesion, requiereRol('CLIENTE'), direcciones.listar);
router.post('/direcciones', requiereSesion, requiereRol('CLIENTE'), direcciones.crear);
router.put('/direcciones/:id', requiereSesion, requiereRol('CLIENTE'), direcciones.actualizar);
router.patch('/direcciones/:id/principal', requiereSesion, requiereRol('CLIENTE'), direcciones.marcarPrincipal);
router.delete('/direcciones/:id', requiereSesion, requiereRol('CLIENTE'), direcciones.eliminar);

router.get('/admin/verificar', requiereSesion, requiereRol('ADMINISTRADOR'),
    (req, res) => res.json({ autorizado: true }));
module.exports = router;

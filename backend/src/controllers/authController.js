/**
 * MERCAGO - AUTENTICACIÓN Y REGISTRO DE CLIENTES
 * FASE 16.1
 * Conserva el contrato de login y perfil.
 */
const usuarios = require('../repositories/usuarioRepository');
const { conectarDB, sql } = require('../config/database');
const { verifyPassword, hashPassword, signToken } = require('../services/seguridad');

async function login(req, res) {
    const { correo, contrasena } = req.body || {};
    if (typeof correo !== 'string' || typeof contrasena !== 'string' ||
        correo.length > 255 || contrasena.length > 1024) {
        return res.status(400).json({ mensaje: 'Correo y contraseña requeridos' });
    }
    try {
        const usuario = await usuarios.porCorreo(correo.trim().toLowerCase());
        if (!usuario || !usuario.activo || !verifyPassword(contrasena, usuario.hash)) {
            return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
        }
        const safe = {
            id: usuario.id, nombre: usuario.nombre,
            correo: usuario.correo, rol: usuario.rol
        };
        return res.json({ token: signToken(safe), usuario: safe });
    } catch (error) {
        console.error('Login:', error.message);
        return res.status(500).json({ mensaje: 'No fue posible iniciar sesión' });
    }
}

async function perfil(req, res) {
    try {
        const u = await usuarios.porId(req.auth.sub);
        if (!u || !u.activo || u.rol !== req.auth.rol) {
            return res.status(401).json({ mensaje: 'Sesión inválida' });
        }
        return res.json({ usuario: {
            id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol
        } });
    } catch (error) {
        console.error('Perfil:', error.message);
        return res.status(500).json({ mensaje: 'Error al consultar perfil' });
    }
}

async function registrarCliente(req, res) {
    // No aceptamos "rol" ni "activo" enviados por el cliente.
    const { nombre, correo, contrasena } = req.body || {};
    if (typeof nombre !== 'string' || typeof correo !== 'string' ||
        typeof contrasena !== 'string') {
        return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios' });
    }
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    const correoLimpio = correo.trim().toLowerCase();
    if (nombreLimpio.length < 3 || nombreLimpio.length > 150 ||
        /[\x00-\x1f\x7f]/.test(nombreLimpio)) {
        return res.status(400).json({ mensaje: 'El nombre debe tener de 3 a 150 caracteres válidos' });
    }
    if (correoLimpio.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
        return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido' });
    }
    if (contrasena.length < 10 || contrasena.length > 128 ||
        !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
        return res.status(400).json({
            mensaje: 'La contraseña debe tener de 10 a 128 caracteres, letras y números'
        });
    }
    try {
        const pool = await conectarDB();
        // SQL Server tiene una restricción UNIQUE sobre Correo.
        // Eso cubre también registros concurrentes.
        const resultado = await pool.request()
            .input('nombre', sql.NVarChar(150), nombreLimpio)
            .input('correo', sql.NVarChar(255), correoLimpio)
            .input('hash', sql.VarChar(255), hashPassword(contrasena))
            .query(`
                INSERT INTO dbo.UsuariosMercaGo
                    (Nombre, Correo, ContrasenaHash, Rol, Activo)
                OUTPUT INSERTED.IdUsuario AS id
                VALUES (@nombre, @correo, @hash, 'CLIENTE', 1);
            `);
        return res.status(201).json({
            mensaje: 'Cuenta creada. Ahora puedes iniciar sesión.',
            usuario: {
                id: resultado.recordset[0].id,
                nombre: nombreLimpio,
                correo: correoLimpio,
                rol: 'CLIENTE'
            }
        });
    } catch (error) {
        if (error.number === 2627 || error.number === 2601 ||
            error.originalError?.info?.number === 2627 ||
            error.originalError?.info?.number === 2601) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo' });
        }
        console.error('Registro:', error.message);
        return res.status(500).json({ mensaje: 'No fue posible crear la cuenta' });
    }
}

module.exports = { login, perfil, registrarCliente };

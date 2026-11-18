/**
 * MERCAGO - FASE 16.2 - PERFIL DEL CLIENTE
 * Rutas autenticadas. No se confía en IdUsuario enviado por el navegador.
 */
const { conectarDB, sql } = require('../config/database');
const { verifyPassword, hashPassword } = require('../services/seguridad');

function fallo(status, mensaje) { return Object.assign(new Error(mensaje), { status }); }
function respuestaError(res, error) {
    if (!error.status) console.error('Perfil cliente:', error);
    const numero = error.number || error.originalError?.info?.number;
    if (numero === 2601 || numero === 2627) {
        return res.status(409).json({ mensaje: 'Ese correo ya está registrado' });
    }
    return res.status(error.status || 500).json({
        mensaje: error.status ? error.message : 'No fue posible procesar el perfil'
    });
}
function validarCliente(req) {
    if (req.auth?.rol !== 'CLIENTE') throw fallo(403, 'Acceso exclusivo para clientes');
    const id = Number(req.auth.sub);
    if (!Number.isSafeInteger(id) || id < 1) throw fallo(401, 'Sesión inválida');
    return id;
}
function normalizarCorreo(valor) {
    if (typeof valor !== 'string') throw fallo(400, 'Correo obligatorio');
    const correo = valor.trim().toLowerCase();
    if (correo.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw fallo(400, 'Ingresa un correo válido');
    }
    return correo;
}
function normalizarNombre(valor) {
    if (typeof valor !== 'string') throw fallo(400, 'Nombre obligatorio');
    const nombre = valor.trim().replace(/\s+/g, ' ');
    if (nombre.length < 3 || nombre.length > 150 || /[\x00-\x1f\x7f]/.test(nombre)) {
        throw fallo(400, 'El nombre debe tener de 3 a 150 caracteres válidos');
    }
    return nombre;
}
async function miPerfil(req, res) {
    try {
        const id = validarCliente(req);
        const pool = await conectarDB();
        const resultado = await pool.request().input('id', sql.Int, id).query(`
            SELECT u.IdUsuario AS id, u.Nombre AS nombre,
                   u.Correo AS correo, u.Rol AS rol,
                   (SELECT COUNT(*) FROM dbo.PedidosMercaGo p
                    WHERE p.IdUsuario = u.IdUsuario) AS totalPedidos,
                   (SELECT COUNT(*) FROM dbo.PedidosMercaGo p
                    WHERE p.IdUsuario = u.IdUsuario AND p.Estado = 'Entregado') AS entregados
            FROM dbo.UsuariosMercaGo u
            WHERE u.IdUsuario = @id AND u.Activo = 1 AND u.Rol = 'CLIENTE';
        `);
        if (!resultado.recordset.length) throw fallo(401, 'La cuenta no está disponible');
        return res.json({ usuario: resultado.recordset[0] });
    } catch (error) { return respuestaError(res, error); }
}
async function actualizarMiPerfil(req, res) {
    try {
        const id = validarCliente(req);
        const nombre = normalizarNombre(req.body?.nombre);
        const correo = normalizarCorreo(req.body?.correo);
        const pool = await conectarDB();
        // Si cambia el correo, exige comprobar la contraseña vigente.
        const actual = await pool.request().input('id', sql.Int, id).query(`
            SELECT Nombre, Correo, ContrasenaHash
            FROM dbo.UsuariosMercaGo
            WHERE IdUsuario = @id AND Activo = 1 AND Rol = 'CLIENTE';
        `);
        if (!actual.recordset.length) throw fallo(401, 'La cuenta no está disponible');
        const anterior = actual.recordset[0];
        if (correo !== String(anterior.Correo).toLowerCase()) {
            if (typeof req.body?.contrasenaActual !== 'string' ||
                req.body.contrasenaActual.length > 1024 ||
                !verifyPassword(req.body.contrasenaActual, anterior.ContrasenaHash)) {
                throw fallo(401, 'Confirma tu contraseña actual para cambiar el correo');
            }
        }
        const resultado = await pool.request()
            .input('id', sql.Int, id)
            .input('nombre', sql.NVarChar(150), nombre)
            .input('correo', sql.NVarChar(255), correo)
            .query(`
                UPDATE dbo.UsuariosMercaGo
                SET Nombre = @nombre, Correo = @correo
                OUTPUT INSERTED.IdUsuario AS id, INSERTED.Nombre AS nombre,
                       INSERTED.Correo AS correo, INSERTED.Rol AS rol
                WHERE IdUsuario = @id AND Activo = 1 AND Rol = 'CLIENTE';
            `);
        if (!resultado.recordset.length) throw fallo(401, 'La cuenta no está disponible');
        return res.json({ mensaje: 'Perfil actualizado correctamente', usuario: resultado.recordset[0] });
    } catch (error) { return respuestaError(res, error); }
}
async function cambiarMiContrasena(req, res) {
    try {
        const id = validarCliente(req);
        const { contrasenaActual, nuevaContrasena } = req.body || {};
        if (typeof contrasenaActual !== 'string' || contrasenaActual.length > 1024 ||
            typeof nuevaContrasena !== 'string' || nuevaContrasena.length < 10 ||
            nuevaContrasena.length > 128 || !/[A-Za-z]/.test(nuevaContrasena) ||
            !/\d/.test(nuevaContrasena)) {
            throw fallo(400, 'Contraseña inválida: mínimo 10 caracteres, letras y números');
        }
        const pool = await conectarDB();
        const actual = await pool.request().input('id', sql.Int, id).query(`
            SELECT ContrasenaHash FROM dbo.UsuariosMercaGo
            WHERE IdUsuario = @id AND Activo = 1 AND Rol = 'CLIENTE';
        `);
        if (!actual.recordset.length) throw fallo(401, 'La cuenta no está disponible');
        const hashAnterior = actual.recordset[0].ContrasenaHash;
        if (!verifyPassword(contrasenaActual, hashAnterior)) {
            throw fallo(401, 'La contraseña actual es incorrecta');
        }
        if (contrasenaActual === nuevaContrasena) {
            throw fallo(400, 'La contraseña nueva debe ser diferente');
        }
        const nuevoHash = hashPassword(nuevaContrasena);
        // Actualización condicional: impide pisar un cambio concurrente.
        const cambio = await pool.request()
            .input('id', sql.Int, id)
            .input('anterior', sql.VarChar(255), hashAnterior)
            .input('nuevo', sql.VarChar(255), nuevoHash)
            .query(`
                UPDATE dbo.UsuariosMercaGo
                SET ContrasenaHash = @nuevo
                WHERE IdUsuario = @id AND ContrasenaHash = @anterior
                  AND Activo = 1 AND Rol = 'CLIENTE';
            `);
        if (cambio.rowsAffected[0] !== 1) {
            throw fallo(409, 'El perfil cambió durante la operación. Vuelve a intentarlo');
        }
        return res.json({ mensaje: 'Contraseña actualizada. Vuelve a iniciar sesión.' });
    } catch (error) { return respuestaError(res, error); }
}
module.exports = { miPerfil, actualizarMiPerfil, cambiarMiContrasena };

/** MERCAGO - FASE 17: DIRECCIONES GUARDADAS DE CLIENTES */
const { sql, conectarDB } = require('../config/database');

const httpError = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const numeroSql = e => e?.number || e?.originalError?.info?.number;

function responderError(res, error) {
    if (!error.status) console.error('Direcciones:', error);
    if ([2601, 2627].includes(numeroSql(error))) {
        return res.status(409).json({ mensaje: 'Conflicto al guardar la dirección; inténtalo nuevamente' });
    }
    return res.status(error.status || 500).json({
        mensaje: error.status ? error.message : 'No fue posible gestionar las direcciones'
    });
}
function usuarioCliente(req) {
    if (req.auth?.rol !== 'CLIENTE') throw httpError(403, 'Acceso exclusivo para clientes');
    const id = Number(req.auth.sub);
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(401, 'Sesión inválida');
    return id;
}
function validarId(valor) {
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, 'Dirección inválida');
    return id;
}
function validarTexto(valor, campo, maximo, minimo = 1) {
    if (typeof valor !== 'string') throw httpError(400, `${campo} obligatorio`);
    const limpio = valor.trim().replace(/\s+/g, ' ');
    if (limpio.length < minimo || limpio.length > maximo || /[\x00-\x1f\x7f]/.test(limpio)) {
        throw httpError(400, `${campo}: entre ${minimo} y ${maximo} caracteres válidos`);
    }
    return limpio;
}
function datosDireccion(body) {
    return {
        etiqueta: validarTexto(body?.etiqueta, 'Etiqueta', 60),
        direccion: validarTexto(body?.direccion, 'Dirección', 300, 5),
        telefono: validarTexto(body?.telefono, 'Teléfono', 40, 5),
        principal: body?.principal === true
    };
}
function requestTx(tx, valores = {}) {
    const r = new sql.Request(tx);
    for (const [nombre, { tipo, valor }] of Object.entries(valores)) r.input(nombre, tipo, valor);
    return r;
}
async function dentroTransaccion(operacion) {
    const pool = await conectarDB();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let terminado = false;
    try {
        const resultado = await operacion(tx);
        await tx.commit();
        terminado = true;
        return resultado;
    } catch (error) {
        if (!terminado) {
            try { await tx.rollback(); } catch (e) { console.error('Rollback direcciones:', e); }
        }
        throw error;
    }
}
async function bloquearUsuario(tx, idUsuario) {
    // Serializa todos los cambios de direcciones de un mismo usuario.
    const r = await requestTx(tx, {
        usuario: { tipo: sql.Int, valor: idUsuario }
    }).query(`SELECT IdUsuario FROM dbo.UsuariosMercaGo WITH (UPDLOCK, HOLDLOCK)
              WHERE IdUsuario=@usuario AND Activo=1 AND Rol='CLIENTE'`);
    if (!r.recordset.length) throw httpError(401, 'Cuenta no disponible');
}
async function listar(req, res) {
    try {
        const usuario = usuarioCliente(req);
        const pool = await conectarDB();
        const r = await pool.request().input('usuario', sql.Int, usuario).query(`
            SELECT IdDireccion AS id, Etiqueta AS etiqueta, Direccion AS direccion,
                   Telefono AS telefono, Principal AS principal
            FROM dbo.DireccionesClienteMercaGo
            WHERE IdUsuario=@usuario AND Activo=1
            ORDER BY Principal DESC, FechaCreacion DESC, IdDireccion DESC`);
        return res.json(r.recordset);
    } catch (e) { return responderError(res, e); }
}
async function crear(req, res) {
    try {
        const usuario = usuarioCliente(req);
        const datos = datosDireccion(req.body);
        const nuevo = await dentroTransaccion(async tx => {
            await bloquearUsuario(tx, usuario);
            const cantidad = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario }
            }).query(`SELECT COUNT(*) AS total FROM dbo.DireccionesClienteMercaGo
                      WHERE IdUsuario=@usuario AND Activo=1`);
            if (cantidad.recordset[0].total >= 10) {
                throw httpError(409, 'Máximo 10 direcciones guardadas por cliente');
            }
            const principal = datos.principal || cantidad.recordset[0].total === 0;
            if (principal) await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario }
            }).query(`UPDATE dbo.DireccionesClienteMercaGo SET Principal=0
                      WHERE IdUsuario=@usuario AND Activo=1 AND Principal=1`);
            const r = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                etiqueta: { tipo: sql.NVarChar(60), valor: datos.etiqueta },
                direccion: { tipo: sql.NVarChar(300), valor: datos.direccion },
                telefono: { tipo: sql.NVarChar(40), valor: datos.telefono },
                principal: { tipo: sql.Bit, valor: principal }
            }).query(`INSERT INTO dbo.DireccionesClienteMercaGo
                      (IdUsuario,Etiqueta,Direccion,Telefono,Principal)
                      OUTPUT INSERTED.IdDireccion AS id, INSERTED.Etiqueta AS etiqueta,
                             INSERTED.Direccion AS direccion, INSERTED.Telefono AS telefono,
                             INSERTED.Principal AS principal
                      VALUES (@usuario,@etiqueta,@direccion,@telefono,@principal)`);
            return r.recordset[0];
        });
        return res.status(201).json({ mensaje: 'Dirección guardada', direccion: nuevo });
    } catch (e) { return responderError(res, e); }
}
async function actualizar(req, res) {
    try {
        const usuario = usuarioCliente(req);
        const id = validarId(req.params.id);
        const datos = datosDireccion(req.body);
        const resultado = await dentroTransaccion(async tx => {
            await bloquearUsuario(tx, usuario);
            const existe = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                id: { tipo: sql.Int, valor: id }
            }).query(`SELECT Principal FROM dbo.DireccionesClienteMercaGo
                      WHERE IdDireccion=@id AND IdUsuario=@usuario AND Activo=1`);
            if (!existe.recordset.length) throw httpError(404, 'Dirección no encontrada');
            const principal = datos.principal || Boolean(existe.recordset[0].Principal);
            if (principal) await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario }
            }).query(`UPDATE dbo.DireccionesClienteMercaGo SET Principal=0
                      WHERE IdUsuario=@usuario AND Activo=1 AND Principal=1`);
            const r = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                id: { tipo: sql.Int, valor: id },
                etiqueta: { tipo: sql.NVarChar(60), valor: datos.etiqueta },
                direccion: { tipo: sql.NVarChar(300), valor: datos.direccion },
                telefono: { tipo: sql.NVarChar(40), valor: datos.telefono },
                principal: { tipo: sql.Bit, valor: principal }
            }).query(`UPDATE dbo.DireccionesClienteMercaGo SET
                      Etiqueta=@etiqueta, Direccion=@direccion, Telefono=@telefono, Principal=@principal
                      OUTPUT INSERTED.IdDireccion AS id, INSERTED.Etiqueta AS etiqueta,
                             INSERTED.Direccion AS direccion, INSERTED.Telefono AS telefono,
                             INSERTED.Principal AS principal
                      WHERE IdDireccion=@id AND IdUsuario=@usuario AND Activo=1`);
            return r.recordset[0];
        });
        return res.json({ mensaje: 'Dirección actualizada', direccion: resultado });
    } catch (e) { return responderError(res, e); }
}
async function marcarPrincipal(req, res) {
    try {
        const usuario = usuarioCliente(req);
        const id = validarId(req.params.id);
        const dato = await dentroTransaccion(async tx => {
            await bloquearUsuario(tx, usuario);
            const existe = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                id: { tipo: sql.Int, valor: id }
            }).query(`SELECT IdDireccion FROM dbo.DireccionesClienteMercaGo
                      WHERE IdUsuario=@usuario AND IdDireccion=@id AND Activo=1`);
            if (!existe.recordset.length) throw httpError(404, 'Dirección no encontrada');
            await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario }
            }).query(`UPDATE dbo.DireccionesClienteMercaGo SET Principal=0
                      WHERE IdUsuario=@usuario AND Activo=1 AND Principal=1`);
            const r = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                id: { tipo: sql.Int, valor: id }
            }).query(`UPDATE dbo.DireccionesClienteMercaGo SET Principal=1
                      OUTPUT INSERTED.IdDireccion AS id, INSERTED.Etiqueta AS etiqueta,
                             INSERTED.Direccion AS direccion, INSERTED.Telefono AS telefono,
                             INSERTED.Principal AS principal
                      WHERE IdDireccion=@id AND IdUsuario=@usuario AND Activo=1`);
            return r.recordset[0];
        });
        return res.json({ mensaje: 'Dirección principal actualizada', direccion: dato });
    } catch (e) { return responderError(res, e); }
}
async function eliminar(req, res) {
    try {
        const usuario = usuarioCliente(req);
        const id = validarId(req.params.id);
        await dentroTransaccion(async tx => {
            await bloquearUsuario(tx, usuario);
            const existe = await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                id: { tipo: sql.Int, valor: id }
            }).query(`SELECT Principal FROM dbo.DireccionesClienteMercaGo
                      WHERE IdUsuario=@usuario AND IdDireccion=@id AND Activo=1`);
            if (!existe.recordset.length) throw httpError(404, 'Dirección no encontrada');
            await requestTx(tx, {
                usuario: { tipo: sql.Int, valor: usuario },
                id: { tipo: sql.Int, valor: id }
            }).query(`UPDATE dbo.DireccionesClienteMercaGo SET Activo=0, Principal=0
                      WHERE IdUsuario=@usuario AND IdDireccion=@id AND Activo=1`);
            if (existe.recordset[0].Principal) {
                const reemplazo = await requestTx(tx, {
                    usuario: { tipo: sql.Int, valor: usuario }
                }).query(`SELECT TOP (1) IdDireccion FROM dbo.DireccionesClienteMercaGo
                          WHERE IdUsuario=@usuario AND Activo=1
                          ORDER BY FechaCreacion DESC, IdDireccion DESC`);
                if (reemplazo.recordset.length) await requestTx(tx, {
                    usuario: { tipo: sql.Int, valor: usuario },
                    id: { tipo: sql.Int, valor: reemplazo.recordset[0].IdDireccion }
                }).query(`UPDATE dbo.DireccionesClienteMercaGo SET Principal=1
                          WHERE IdUsuario=@usuario AND IdDireccion=@id AND Activo=1`);
            }
        });
        return res.json({ mensaje: 'Dirección eliminada' });
    } catch (e) { return responderError(res, e); }
}
module.exports = { listar, crear, actualizar, marcarPrincipal, eliminar };

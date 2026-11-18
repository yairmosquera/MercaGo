
const { conectarDB, sql } = require("../config/database");

async function porCorreo(correo) {
    const pool = await conectarDB();

    const resultado = await pool.request()
        .input("correo", sql.NVarChar(255), correo)
        .query(`
            SELECT
                IdUsuario AS id,
                Nombre AS nombre,
                Correo AS correo,
                ContrasenaHash AS hash,
                Rol AS rol,
                Activo AS activo
            FROM dbo.UsuariosMercaGo
            WHERE Correo = @correo
        `);

    return resultado.recordset[0] || null;
}

async function porId(id) {
    const pool = await conectarDB();

    const resultado = await pool.request()
        .input("id", sql.Int, id)
        .query(`
            SELECT
                IdUsuario AS id,
                Nombre AS nombre,
                Correo AS correo,
                Rol AS rol,
                Activo AS activo
            FROM dbo.UsuariosMercaGo
            WHERE IdUsuario = @id
        `);

    return resultado.recordset[0] || null;
}

module.exports = { porCorreo, porId };

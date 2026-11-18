
require("dotenv").config();

const { conectarDB, sql } = require("../src/config/database");
const { hashPassword } = require("../src/services/seguridad");

async function crearUsuario() {

    const [rol, correo, nombre, contrasena] =
        process.argv.slice(2);

    if (!rol || !correo || !nombre || !contrasena) {
        console.log("Faltan datos del usuario.");
        return;
    }

    if (!["CLIENTE", "ADMINISTRADOR"].includes(rol)) {
        console.log("Rol inválido.");
        return;
    }

    try {
        const pool = await conectarDB();

        const hash = hashPassword(contrasena);

        await pool.request()
            .input("nombre", sql.NVarChar(150), nombre)
            .input("correo", sql.NVarChar(255), correo.toLowerCase())
            .input("hash", sql.VarChar(255), hash)
            .input("rol", sql.VarChar(20), rol)
            .query(`
                INSERT INTO dbo.UsuariosMercaGo
                (Nombre, Correo, ContrasenaHash, Rol)
                VALUES (@nombre, @correo, @hash, @rol)
            `);

        console.log("Usuario creado correctamente:");
        console.log("Nombre:", nombre);
        console.log("Correo:", correo);
        console.log("Rol:", rol);

    } catch (error) {
        console.error("Error creando usuario:", error.message);
        process.exitCode = 1;
    } finally {
        await sql.close();
    }
}

crearUsuario();

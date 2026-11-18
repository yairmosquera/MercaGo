
/**
 * ============================================
 * MERCAGO - CONEXIÓN SQL SERVER
 * LOCAL + MONSTERASP.NET
 * ============================================
 */

const sql = require("mssql");
require("dotenv").config();

const esProduccion =
    process.env.NODE_ENV === "production";

const valorBooleano = (valor, defecto) => {
    if (valor === undefined) return defecto;
    return String(valor).toLowerCase() === "true";
};

// ============================================
// CONFIGURACIÓN DE CONEXIÓN
// ============================================

const config = {

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD,

    server:
        process.env.DB_SERVER ||
        "127.0.0.1",

    database:
        process.env.DB_DATABASE ||
        "MercaGo",

    port: Number(
        process.env.DB_PORT ||
        (esProduccion ? 1433 : 55566)
    ),

    options: {

        encrypt: valorBooleano(
            process.env.DB_ENCRYPT,
            esProduccion
        ),

        trustServerCertificate: valorBooleano(
            process.env.DB_TRUST_SERVER_CERTIFICATE,
            false
        )
    },

    connectionTimeout: 30000,

    requestTimeout: 30000,

    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// ============================================
// POOL DE CONEXIONES
// ============================================

let poolPromise = null;

async function conectarDB() {

    if (!poolPromise) {

        poolPromise = new sql.ConnectionPool(
            config
        )
            .connect()

            .then(pool => {

                console.log(
                    "✅ Conexión SQL Server exitosa"
                );

                console.log(
                    "Base de datos:",
                    config.database
                );

                pool.on("error", error => {

                    console.error(
                        "Error del pool SQL:",
                        error.message
                    );
                });

                return pool;
            })

            .catch(error => {

                poolPromise = null;

                console.error(
                    "❌ Error conectando a SQL Server:",
                    error.message
                );

                throw error;
            });
    }

    return poolPromise;
}

// ============================================
// EXPORTACIONES
// ============================================

module.exports = {
    sql,
    conectarDB
};

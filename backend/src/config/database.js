const sql = require("mssql");
require("dotenv").config();

// Configuración SQL Server
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || "127.0.0.1",
    database: process.env.DB_DATABASE || "MercaGo",
    port: Number(process.env.DB_PORT || 55566),

    options: {
        encrypt: false,
        trustServerCertificate: true
    },

    connectionTimeout: 30000,
    requestTimeout: 30000
};

let poolPromise = null;

async function conectarDB() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                console.log("✅ Conexión a SQL Server exitosa");
                console.log("Base de datos: MercaGo");
                return pool;
            })
            .catch(error => {
                poolPromise = null;
                console.error(
                    "❌ Error conectando SQL Server:",
                    error.message
                );
                throw error;
            });
    }

    return poolPromise;
}

module.exports = {
    sql,
    conectarDB
};

/**
 * ============================================
 * MERCAGO - CONTROLADOR DE PRODUCTOS
 * ============================================
 *
 * Funcionalidades:
 * - Catálogo público
 * - Consultar categorías
 * - Listar productos administrativos
 * - Crear productos
 * - Registrar inventario inicial
 * - Editar productos
 * - Actualizar stock
 * - Activar y desactivar productos
 */

const {
    sql,
    conectarDB
} = require("../config/database");

const {
    TIPOS_MOVIMIENTO,
    registrarMovimientoInventario
} = require(
    "../services/movimientoInventarioService"
);

// ============================================
// UTILIDADES
// ============================================

function responderError(res, error) {

    console.error(
        "Error de productos:",
        error
    );

    return res.status(
        error.status || 500
    ).json({
        mensaje: error.status
            ? error.message
            : "Error interno al gestionar productos"
    });
}

function crearError(status, mensaje) {

    const error = new Error(mensaje);

    error.status = status;

    return error;
}

function validarId(valor) {

    const id = Number(valor);

    if (
        !Number.isSafeInteger(id) ||
        id <= 0
    ) {
        throw crearError(
            400,
            "Identificador inválido"
        );
    }

    return id;
}

function validarDatos(body) {

    const nombre = String(
        body.nombre ?? ""
    ).trim();

    const idCategoria = Number(
        body.idCategoria
    );

    const precio = Number(
        body.precio
    );

    const imagen = String(
        body.imagen ?? "🛒"
    ).trim();

    if (
        !nombre ||
        nombre.length > 150
    ) {
        throw crearError(
            400,
            "El nombre debe tener entre 1 y 150 caracteres"
        );
    }

    if (
        !Number.isSafeInteger(idCategoria) ||
        idCategoria <= 0
    ) {
        throw crearError(
            400,
            "Selecciona una categoría válida"
        );
    }

    if (
        !Number.isFinite(precio) ||
        precio < 0 ||
        precio > 999999999 ||
        Math.round(precio * 100) / 100 !== precio
    ) {
        throw crearError(
            400,
            "Precio inválido"
        );
    }

    if (imagen.length > 100) {
        throw crearError(
            400,
            "La imagen debe tener máximo 100 caracteres"
        );
    }

    return {
        nombre,
        idCategoria,
        precio,
        imagen: imagen || "🛒"
    };
}

// ============================================
// CATÁLOGO PÚBLICO
// ============================================

async function obtenerProductos(req, res) {

    try {

        const pool = await conectarDB();

        const resultado =
            await pool.request().query(`
                SELECT
                    p.IdProducto AS id,
                    p.Nombre AS name,
                    c.Nombre AS cat,
                    p.Precio AS price,
                    p.Imagen AS emoji,
                    p.Stock AS stock
                FROM dbo.Productos p
                INNER JOIN dbo.Categorias c
                    ON p.IdCategoria = c.IdCategoria
                WHERE p.Activo = 1
                ORDER BY p.IdProducto
            `);

        return res.json(
            resultado.recordset
        );

    } catch (error) {

        return responderError(res, error);
    }
}

// ============================================
// CONSULTAR CATEGORÍAS
// ============================================

async function obtenerCategorias(req, res) {

    try {

        const pool = await conectarDB();

        const resultado =
            await pool.request().query(`
                SELECT
                    IdCategoria AS id,
                    Nombre AS nombre
                FROM dbo.Categorias
                ORDER BY Nombre
            `);

        return res.json(
            resultado.recordset
        );

    } catch (error) {

        return responderError(res, error);
    }
}

// ============================================
// LISTAR PRODUCTOS - ADMINISTRACIÓN
// ============================================

async function listarAdministracion(req, res) {

    try {

        const pool = await conectarDB();

        const resultado =
            await pool.request().query(`
                SELECT
                    p.IdProducto AS id,
                    p.Nombre AS nombre,
                    p.IdCategoria AS idCategoria,
                    c.Nombre AS categoria,
                    p.Precio AS precio,
                    p.Imagen AS imagen,
                    p.Stock AS stock,
                    p.Activo AS activo
                FROM dbo.Productos p
                INNER JOIN dbo.Categorias c
                    ON p.IdCategoria = c.IdCategoria
                ORDER BY p.IdProducto DESC
            `);

        return res.json(
            resultado.recordset
        );

    } catch (error) {

        return responderError(res, error);
    }
}

// ============================================
// CREAR PRODUCTO CON INVENTARIO INICIAL
// ============================================

async function crearProducto(req, res) {

    let tx = null;
    let iniciada = false;

    try {

        const datos = validarDatos(
            req.body
        );

        // ====================================
        // VALIDAR EXISTENCIAS INICIALES
        // ====================================

        const stock = Number(
            req.body.stock
        );

        if (
            req.body.stock === undefined ||
            req.body.stock === null ||
            String(req.body.stock).trim() === "" ||
            !Number.isSafeInteger(stock) ||
            stock < 0 ||
            stock > 2147483647
        ) {
            throw crearError(
                400,
                "Existencias inválidas"
            );
        }

        // ====================================
        // VALIDAR ADMINISTRADOR
        // ====================================

        if (
            req.auth?.rol !== "ADMINISTRADOR"
        ) {
            throw crearError(
                403,
                "Solo administradores pueden crear productos"
            );
        }

        const idUsuario = Number(
            req.auth.sub
        );

        if (
            !Number.isSafeInteger(idUsuario) ||
            idUsuario <= 0
        ) {
            throw crearError(
                401,
                "Usuario no válido"
            );
        }

        // ====================================
        // INICIAR TRANSACCIÓN
        // ====================================

        const pool = await conectarDB();

        tx = new sql.Transaction(pool);

        await tx.begin();

        iniciada = true;

        // ====================================
        // VALIDAR CATEGORÍA
        // ====================================

        const categoria = await new sql.Request(tx)
            .input(
                "id",
                sql.Int,
                datos.idCategoria
            )
            .query(`
                SELECT IdCategoria
                FROM dbo.Categorias
                WHERE IdCategoria = @id
            `);

        if (!categoria.recordset.length) {

            throw crearError(
                400,
                "La categoría no existe"
            );
        }

        // ====================================
        // REGISTRAR PRODUCTO
        // ====================================

        const resultado = await new sql.Request(tx)
            .input(
                "nombre",
                sql.NVarChar(150),
                datos.nombre
            )
            .input(
                "categoria",
                sql.Int,
                datos.idCategoria
            )
            .input(
                "precio",
                sql.Decimal(18, 2),
                datos.precio
            )
            .input(
                "imagen",
                sql.NVarChar(100),
                datos.imagen
            )
            .input(
                "stock",
                sql.Int,
                stock
            )
            .query(`
                INSERT INTO dbo.Productos
                (
                    Nombre,
                    IdCategoria,
                    Precio,
                    Imagen,
                    Stock,
                    Activo
                )
                OUTPUT
                    INSERTED.IdProducto AS id
                VALUES
                (
                    @nombre,
                    @categoria,
                    @precio,
                    @imagen,
                    @stock,
                    1
                )
            `);

        const idProducto =
            resultado.recordset[0].id;

        // ====================================
        // AUDITORÍA DE INVENTARIO INICIAL
        // ====================================

        let movimientoRegistrado = false;

        if (stock > 0) {

            const movimiento =
                await registrarMovimientoInventario(
                    tx,
                    {
                        idProducto:
                            Number(idProducto),

                        // Administrador que crea
                        // el producto
                        idUsuario,

                        stockAnterior: 0,

                        stockNuevo: stock,

                        tipo:
                            TIPOS_MOVIMIENTO.INVENTARIO_INICIAL,

                        motivo:
                            `Inventario inicial del producto ${datos.nombre}`
                    }
                );

            movimientoRegistrado =
                movimiento !== null;
        }

        // ====================================
        // CONFIRMAR TRANSACCIÓN
        // ====================================

        await tx.commit();

        iniciada = false;

        return res.status(201).json({
            mensaje:
                "Producto registrado correctamente",

            id: idProducto,

            stock,

            movimientoRegistrado
        });

    } catch (error) {

        if (iniciada && tx) {

            try {

                await tx.rollback();

            } catch (rollbackError) {

                console.error(
                    "Error al revertir creación de producto:",
                    rollbackError
                );
            }
        }

        return responderError(res, error);
    }
}

// ============================================
// EDITAR PRODUCTO
// ============================================

async function editarProducto(req, res) {

    try {

        const id = validarId(
            req.params.id
        );

        const datos = validarDatos(
            req.body
        );

        const pool = await conectarDB();

        // ====================================
        // VALIDAR CATEGORÍA
        // ====================================

        const categoria = await pool.request()
            .input(
                "id",
                sql.Int,
                datos.idCategoria
            )
            .query(`
                SELECT IdCategoria
                FROM dbo.Categorias
                WHERE IdCategoria = @id
            `);

        if (!categoria.recordset.length) {

            throw crearError(
                400,
                "La categoría no existe"
            );
        }

        // ====================================
        // ACTUALIZAR INFORMACIÓN
        // ====================================

        const resultado = await pool.request()
            .input(
                "id",
                sql.Int,
                id
            )
            .input(
                "nombre",
                sql.NVarChar(150),
                datos.nombre
            )
            .input(
                "categoria",
                sql.Int,
                datos.idCategoria
            )
            .input(
                "precio",
                sql.Decimal(18, 2),
                datos.precio
            )
            .input(
                "imagen",
                sql.NVarChar(100),
                datos.imagen
            )
            .query(`
                UPDATE dbo.Productos
                SET
                    Nombre = @nombre,
                    IdCategoria = @categoria,
                    Precio = @precio,
                    Imagen = @imagen
                WHERE IdProducto = @id;

                SELECT
                    @@ROWCOUNT AS afectados;
            `);

        if (
            resultado.recordset[0].afectados === 0
        ) {
            throw crearError(
                404,
                "Producto no encontrado"
            );
        }

        return res.json({
            mensaje:
                "Producto actualizado correctamente"
        });

    } catch (error) {

        return responderError(res, error);
    }
}

// ============================================
// ACTUALIZAR EXISTENCIAS
// ============================================

/**
 * Esta función se conserva por compatibilidad.
 *
 * La ruta PATCH /api/productos/:id/stock
 * debe seguir conectada a
 * inventarioAuditoriaController.js,
 * que registra los ajustes manuales.
 */

async function actualizarStock(req, res) {

    try {

        const id = validarId(
            req.params.id
        );

        const stock = Number(
            req.body.stock
        );

        if (
            !Number.isSafeInteger(stock) ||
            stock < 0 ||
            stock > 2147483647
        ) {
            throw crearError(
                400,
                "Las existencias deben ser un entero no negativo"
            );
        }

        const pool = await conectarDB();

        const resultado = await pool.request()
            .input(
                "id",
                sql.Int,
                id
            )
            .input(
                "stock",
                sql.Int,
                stock
            )
            .query(`
                UPDATE dbo.Productos
                SET Stock = @stock
                WHERE IdProducto = @id;

                SELECT
                    @@ROWCOUNT AS afectados;
            `);

        if (
            resultado.recordset[0].afectados === 0
        ) {
            throw crearError(
                404,
                "Producto no encontrado"
            );
        }

        return res.json({
            mensaje:
                "Existencias actualizadas",

            stock
        });

    } catch (error) {

        return responderError(res, error);
    }
}

// ============================================
// ACTIVAR O DESACTIVAR PRODUCTO
// ============================================

async function cambiarActivo(req, res) {

    try {

        const id = validarId(
            req.params.id
        );

        if (
            typeof req.body.activo !== "boolean"
        ) {
            throw crearError(
                400,
                "El campo activo debe ser true o false"
            );
        }

        const activo = req.body.activo;

        const pool = await conectarDB();

        const resultado = await pool.request()
            .input(
                "id",
                sql.Int,
                id
            )
            .input(
                "activo",
                sql.Bit,
                activo
            )
            .query(`
                UPDATE dbo.Productos
                SET Activo = @activo
                WHERE IdProducto = @id;

                SELECT
                    @@ROWCOUNT AS afectados;
            `);

        if (
            resultado.recordset[0].afectados === 0
        ) {
            throw crearError(
                404,
                "Producto no encontrado"
            );
        }

        return res.json({
            mensaje: activo
                ? "Producto activado"
                : "Producto desactivado",

            activo
        });

    } catch (error) {

        return responderError(res, error);
    }
}

// ============================================
// EXPORTACIONES
// ============================================

module.exports = {
    obtenerProductos,
    obtenerCategorias,
    listarAdministracion,
    crearProducto,
    editarProducto,
    actualizarStock,
    cambiarActivo
};


const { verifyToken } = require("../services/seguridad");

function requiereSesion(req, res, next) {
    try {
        const header = req.get("authorization") || "";

        if (!header.startsWith("Bearer ")) {
            throw new Error("Sin token");
        }

        req.auth = verifyToken(header.slice(7));
        return next();

    } catch (error) {
        return res.status(401).json({
            mensaje: "Debes iniciar sesión"
        });
    }
}

function requiereRol(rol) {
    return (req, res, next) => {
        if (req.auth?.rol === rol) {
            return next();
        }

        return res.status(403).json({
            mensaje: "Acceso no autorizado"
        });
    };
}

module.exports = {
    requiereSesion,
    requiereRol
};

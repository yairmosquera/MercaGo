
const crypto = require("node:crypto");

const ITERATIONS = 16384;
const KEYLEN = 64;

function hashPassword(
    password,
    salt = crypto.randomBytes(16).toString("hex")
) {
    if (typeof password !== "string" || password.length < 8) {
        throw new Error(
            "La contraseña debe tener al menos 8 caracteres"
        );
    }

    const hash = crypto.scryptSync(
        password,
        Buffer.from(salt, "hex"),
        KEYLEN,
        { N: ITERATIONS }
    ).toString("hex");

    return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
    if (typeof password !== "string" ||
        typeof stored !== "string") return false;

    const [kind, salt, hash] = stored.split("$");

    if (kind !== "scrypt" ||
        !/^[a-f0-9]{32}$/.test(salt || "") ||
        !/^[a-f0-9]{128}$/.test(hash || "")) {
        return false;
    }

    const current = crypto.scryptSync(
        password,
        Buffer.from(salt, "hex"),
        KEYLEN,
        { N: ITERATIONS }
    );

    return crypto.timingSafeEqual(
        current,
        Buffer.from(hash, "hex")
    );
}

function signToken(user, secret = process.env.AUTH_SECRET) {
    if (!secret || secret.length < 32) {
        throw new Error(
            "Configura AUTH_SECRET con al menos 32 caracteres"
        );
    }

    const payload = Buffer.from(JSON.stringify({
        sub: user.id,
        rol: user.rol,
        exp: Math.floor(Date.now() / 1000) + 3600 * 8
    })).toString("base64url");

    const sig = crypto.createHmac("sha256", secret)
        .update(payload)
        .digest("base64url");

    return `${payload}.${sig}`;
}

function verifyToken(token, secret = process.env.AUTH_SECRET) {
    if (!secret || secret.length < 32 ||
        typeof token !== "string") {
        throw new Error("Token inválido");
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
        throw new Error("Token inválido");
    }

    const [payload, signature] = parts;

    const expected = crypto.createHmac("sha256", secret)
        .update(payload)
        .digest();

    const actual = Buffer.from(signature, "base64url");

    if (expected.length !== actual.length ||
        !crypto.timingSafeEqual(expected, actual)) {
        throw new Error("Firma inválida");
    }

    const data = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8")
    );

    if (!Number.isInteger(data.sub) ||
        !["CLIENTE", "ADMINISTRADOR"].includes(data.rol) ||
        !Number.isInteger(data.exp) ||
        data.exp <= Date.now() / 1000) {
        throw new Error("Token expirado o inválido");
    }

    return data;
}

module.exports = {
    hashPassword,
    verifyPassword,
    signToken,
    verifyToken
};

const { createHash, createHmac, randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const ACCESS_HEADER = 'x-ivmet-access';
const ISSUER = 'datamet-plus-development-access';
const AUDIENCE = 'ivmet-management';
const HASH_PATTERN = /^\$2[ab]\$(?:1[0-5])\$[./A-Za-z0-9]{53}$/;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_BUCKETS = 5000;

function accessError(statusCode, code, message, retryAfter) {
  return Object.assign(new Error(message), { statusCode, code, retryAfter });
}

// Esta concesión es independiente del JWT de inicio de sesión. Nunca permite
// entrar a DataMET+ ni sustituye la comprobación de nivel 3 contra DataMET.
function createAccessService({
  codeHash = '',
  secret = '',
  now = Date.now,
  compare = bcrypt.compare,
  ttlSeconds = 3600,
} = {}) {
  const configured = HASH_PATTERN.test(codeHash) && secret.length >= 32;
  const signingKey = createHmac('sha256', secret)
    .update('ivmet-access:v1:')
    .update(codeHash)
    .digest();
  const attempts = new Map();
  const session = (authorization) =>
    createHash('sha256')
      .update(authorization || '')
      .digest('hex');
  const subject = (user) =>
    String(user?.usuario || '')
      .trim()
      .toLowerCase();

  function status({ user, authorization, ticket }) {
    const locked = { configured, unlocked: false, expiresAt: null };
    if (
      !configured ||
      String(user?.acceso_cron) !== '3' ||
      !subject(user) ||
      !ticket
    )
      return locked;
    try {
      const claims = jwt.verify(ticket, signingKey, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: subject(user),
        clockTimestamp: Math.floor(now() / 1000),
      });
      if (
        !authorization ||
        claims.session !== session(authorization) ||
        !Number.isFinite(claims.exp)
      )
        return locked;
      return {
        configured,
        unlocked: true,
        expiresAt: new Date(claims.exp * 1000).toISOString(),
      };
    } catch {
      return locked;
    }
  }

  async function unlock({ user, authorization, body }) {
    if (String(user?.acceso_cron) !== '3' || !subject(user) || !authorization)
      throw accessError(
        403,
        'IVMET_ACCESS_DENIED',
        'Se requiere acceso administrativo de nivel 3.',
      );
    if (!configured)
      throw accessError(
        503,
        'IVMET_ACCESS_NOT_CONFIGURED',
        'El acceso de pruebas todavía no está configurado en este servidor.',
      );
    const time = now();
    for (const [key, value] of attempts)
      if (value.until <= time) attempts.delete(key);
    const key = subject(user);
    let bucket = attempts.get(key);
    if (
      (!bucket && attempts.size >= MAX_BUCKETS) ||
      bucket?.count >= MAX_ATTEMPTS
    ) {
      const retryAfter = Math.max(
        1,
        Math.ceil(((bucket?.until || time + WINDOW_MS) - time) / 1000),
      );
      throw accessError(
        429,
        'IVMET_ACCESS_RATE_LIMITED',
        'Demasiados intentos. Espera antes de volver a introducir el código.',
        retryAfter,
      );
    }
    if (!bucket) {
      bucket = { count: 0, until: time + WINDOW_MS };
      attempts.set(key, bucket);
    }
    // Reservar el intento antes del await evita saltarse el límite con concurrencia.
    bucket.count += 1;
    const validBody =
      body &&
      Object.keys(body).length === 1 &&
      typeof body.code === 'string' &&
      body.code.length >= 1 &&
      Buffer.byteLength(body.code, 'utf8') <= 72;
    if (!validBody)
      throw accessError(
        422,
        'IVMET_ACCESS_INVALID_INPUT',
        'Introduce un código de acceso válido.',
      );
    if (!(await compare(body.code, codeHash)))
      throw accessError(
        403,
        'IVMET_ACCESS_INVALID_CODE',
        'El código de acceso no es correcto.',
      );
    attempts.delete(key);
    const issued = Math.floor(now() / 1000);
    const expires = Math.min(issued + ttlSeconds, Number(user.exp) || issued);
    if (expires <= issued)
      throw accessError(
        401,
        'IVMET_ACCESS_SESSION_EXPIRED',
        'Tu sesión ha vencido. Inicia sesión nuevamente.',
      );
    const ticket = jwt.sign(
      { session: session(authorization), iat: issued, exp: expires },
      signingKey,
      {
        algorithm: 'HS256',
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: subject(user),
        jwtid: randomUUID(),
      },
    );
    return { ticket, expiresAt: new Date(expires * 1000).toISOString() };
  }
  return { status, unlock };
}

module.exports = { createAccessService, ACCESS_HEADER, HASH_PATTERN };

'use strict';

/*
 * Copia de ServiceMET/backend/src/bitrix/bitrix-client.js (mismo comportamiento:
 * reintentos ante el límite de solicitudes, errores con código estable y
 * nunca escribe la URL ni el secreto del webhook). Si se corrige allá,
 * conviene corregirlo aquí.
 */

/**
 * Cliente mínimo del REST de Bitrix24 a través de un webhook entrante.
 *
 * Es la única pieza que conoce la URL del webhook. Nunca la escribe en los
 * logs ni en los mensajes de error: solo registra el método, el estado y la
 * duración.
 */

class BitrixError extends Error {
  /**
   * @param {string} message Mensaje apto para mostrar al técnico.
   * @param {object} options
   * @param {string} options.code Código estable que interpreta la app.
   * @param {number} [options.statusCode] Estado HTTP que devuelve la API.
   * @param {string} [options.bitrixCode] Código original de Bitrix24.
   * @param {Array} [options.details] Detalle de validación.
   */
  constructor(message, { code, statusCode = 502, bitrixCode, details } = {}) {
    super(message);
    this.name = 'BitrixError';
    this.code = code;
    this.statusCode = statusCode;
    this.bitrixCode = bitrixCode;
    this.details = details;
    this.expose = true;
  }
}

const METHOD_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createRedactor(webhookUrl, secret) {
  const needles = [webhookUrl, secret].filter((value) => value && value.length >= 4);
  return (value) => {
    let output = String(value ?? '');
    for (const needle of needles) output = output.split(needle).join('***');
    return output;
  };
}

function describeBitrixFailure(httpStatus, bitrixCode, description) {
  const code = String(bitrixCode || '').toUpperCase();
  if (code === 'QUERY_LIMIT_EXCEEDED' || httpStatus === 429) {
    return new BitrixError(
      'Bitrix24 está limitando las solicitudes. Intente nuevamente en unos segundos.',
      { code: 'BITRIX_RATE_LIMIT', statusCode: 503, bitrixCode },
    );
  }
  if (
    httpStatus === 401 ||
    ['NO_AUTH_FOUND', 'INVALID_CREDENTIALS', 'EXPIRED_TOKEN', 'INVALID_TOKEN'].includes(code)
  ) {
    return new BitrixError(
      'El webhook de Bitrix24 no es válido o fue revocado. Revise la configuración del servidor.',
      { code: 'BITRIX_AUTH_ERROR', statusCode: 502, bitrixCode },
    );
  }
  if (httpStatus === 403 || ['INSUFFICIENT_SCOPE', 'ACCESS_DENIED', 'ALLOWED_ONLY_INTRANET_USER'].includes(code)) {
    return new BitrixError(
      'El usuario del webhook no tiene permisos suficientes en el CRM de Bitrix24.',
      { code: 'BITRIX_ACCESS_DENIED', statusCode: 502, bitrixCode },
    );
  }
  if (code === 'ERROR_METHOD_NOT_FOUND' || code === 'METHOD_NOT_FOUND') {
    return new BitrixError(
      'Bitrix24 no reconoce el método solicitado. Revise los permisos (scope crm) del webhook.',
      { code: 'BITRIX_METHOD_NOT_FOUND', statusCode: 502, bitrixCode },
    );
  }
  if (httpStatus >= 500 || code === 'INTERNAL_SERVER_ERROR') {
    return new BitrixError('Bitrix24 no está disponible en este momento.', {
      code: 'BITRIX_UNAVAILABLE',
      statusCode: 502,
      bitrixCode,
    });
  }
  const detail = String(description || '').trim().slice(0, 300);
  return new BitrixError(
    detail ? `Bitrix24 rechazó la solicitud: ${detail}` : 'Bitrix24 rechazó la solicitud.',
    { code: 'BITRIX_REJECTED', statusCode: 422, bitrixCode },
  );
}

async function readBody(response) {
  try {
    const raw = await response.text();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} options
 * @param {string} options.webhookUrl URL del webhook terminada en `/`.
 * @param {string} [options.webhookSecret] Secreto, solo para ocultarlo.
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.logRequests] Registra cada llamada exitosa.
 * @param {Function} [options.fetchImpl] Inyectable para pruebas.
 * @param {object} [options.logger]
 * @param {number} [options.rateLimitRetries] Reintentos ante QUERY_LIMIT_EXCEEDED.
 * @param {number} [options.rateLimitDelayMs]
 */
function createBitrixClient({
  webhookUrl,
  webhookSecret,
  timeoutMs = 15000,
  logRequests = false,
  fetchImpl = globalThis.fetch,
  logger = console,
  rateLimitRetries = 1,
  rateLimitDelayMs = 1000,
}) {
  if (!webhookUrl) throw new Error('Falta la URL del webhook de Bitrix24.');
  if (typeof fetchImpl !== 'function') {
    throw new Error('Este Node.js no tiene fetch; se requiere Node 18 o superior.');
  }
  const redact = createRedactor(webhookUrl, webhookSecret);

  async function call(method, params = {}) {
    if (!METHOD_PATTERN.test(method)) {
      throw new Error(`Método de Bitrix24 inválido: ${method}`);
    }
    for (let attempt = 0; ; attempt += 1) {
      const startedAt = Date.now();
      let response;
      try {
        response = await fetchImpl(`${webhookUrl}${method}.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        logger.warn?.(
          `[Bitrix] ${method} ${timedOut ? 'sin respuesta' : 'sin conexión'} (${Date.now() - startedAt} ms): ${redact(error?.cause?.code || error?.message)}`,
        );
        throw timedOut
          ? new BitrixError('Bitrix24 no respondió dentro del tiempo esperado.', {
            code: 'BITRIX_TIMEOUT',
            statusCode: 504,
          })
          : new BitrixError('No se pudo conectar con Bitrix24.', {
            code: 'BITRIX_UNAVAILABLE',
            statusCode: 502,
          });
      }

      const body = await readBody(response);
      const elapsed = Date.now() - startedAt;
      if (response.ok && body && typeof body === 'object' && !body.error) {
        if (logRequests) logger.log?.(`[Bitrix] ${method} ${response.status} (${elapsed} ms)`);
        return body;
      }

      const bitrixCode = body?.error ? String(body.error) : `HTTP_${response.status}`;
      logger.warn?.(`[Bitrix] ${method} ${response.status} ${redact(bitrixCode)} (${elapsed} ms)`);
      const failure = describeBitrixFailure(
        response.status,
        bitrixCode,
        redact(body?.error_description),
      );
      if (failure.code === 'BITRIX_RATE_LIMIT' && attempt < rateLimitRetries) {
        await sleep(rateLimitDelayMs * (attempt + 1));
        continue;
      }
      if (!body && response.ok) {
        throw new BitrixError('Bitrix24 devolvió una respuesta inválida.', {
          code: 'BITRIX_INVALID_RESPONSE',
          statusCode: 502,
        });
      }
      throw failure;
    }
  }

  return { call, redact };
}

module.exports = { BitrixError, createBitrixClient, describeBitrixFailure };

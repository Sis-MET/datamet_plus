const { getPool, sql } = require('../config/db');
const { generateToken } = require('../utils/jwt.utils');
const { comparePassword, hashPassword } = require('../utils/hash.utils');

// In-memory store para trackear intentos fallidos (usuario -> { attempts: number, lockUntil: timestamp })
const loginAttemptsMap = new Map();
const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 60 * 1000; // 60 segundos

/**
 * Autentica un usuario contra la tabla DATA_USERS
 * @param {string} usuario - Nombre de usuario
 * @param {string} pass - Contraseña en texto plano
 */
const loginUser = async (usuario, pass) => {
  try {
    // 1. Check Rate Limit en Memoria
    const record = loginAttemptsMap.get(usuario);
    if (record) {
      if (record.lockUntil && Date.now() < record.lockUntil) {
        const remainingSecs = Math.ceil((record.lockUntil - Date.now()) / 1000);
        const error = new Error(`Cuenta bloqueada. Intente nuevamente en ${remainingSecs} segundos`);
        error.isLocked = true;
        error.remainingSecs = remainingSecs;
        throw error;
      }
      // Si ya pasó el tiempo de bloqueo, limpiar el registro
      if (record.lockUntil && Date.now() >= record.lockUntil) {
        loginAttemptsMap.delete(usuario);
      }
    }

    const pool = getPool();

    const result = await pool.request()
      .input('usuario', sql.VarChar, usuario)
      .query('SELECT * FROM DATA_USERS WHERE usuario = @usuario');

    const user = result.recordset[0];

    // Función auxiliar para registrar fallo
    const handleFailedAttempt = () => {
      const currentRecord = loginAttemptsMap.get(usuario) || { attempts: 0, lockUntil: null };
      currentRecord.attempts += 1;
      
      if (currentRecord.attempts >= MAX_ATTEMPTS) {
        currentRecord.lockUntil = Date.now() + LOCK_TIME_MS;
      }
      loginAttemptsMap.set(usuario, currentRecord);
    };

    if (!user) {
      handleFailedAttempt();
      throw new Error('Credenciales inválidas');
    }

    // Gradual bcrypt migration: check format, validate, auto-upgrade legacy
    let isPasswordValid = false;
    let needsRehash = false;

    if (user.pass && user.pass.startsWith('$2b$')) {
      isPasswordValid = await comparePassword(pass, user.pass);
    } else {
      isPasswordValid = (user.pass === pass);
      if (isPasswordValid) needsRehash = true;
    }

    if (!isPasswordValid) {
      handleFailedAttempt();
      throw new Error('Credenciales inválidas');
    }

    if (needsRehash) {
      const hashed = await hashPassword(pass);
      await pool.request()
        .input('hashed', sql.VarChar, hashed)
        .input('userId', sql.Int, user.id)
        .query('UPDATE DATA_USERS SET pass = @hashed WHERE id = @userId');
    }

    // Validación estricta a nivel backend para perfiles sin acceso
    if (String(user.acceso_cron) === "0") {
      throw new Error('Tu perfil no tiene los permisos habilitados para acceder a esta aplicación.');
    }

    // Login exitoso -> limpiar intentos previos
    loginAttemptsMap.delete(usuario);

    // Inyectar "acceso" y "acceso_cron" en el payload del token y en la respuesta
    const token = generateToken({ 
      id: user.id || user.usuario, 
      usuario: user.usuario,
      acceso: user.acceso,
      acceso_cron: user.acceso_cron
    });

    return {
      user: {
        usuario: user.usuario,
        nombre: user.nombre1 || '',
        apellido: user.apellido1 || '',
        cargo: user.cargo || '',
        area: user.area || '',
        acceso: user.acceso || '',
        acceso_cron: user.acceso_cron || ''
      },
      token
    };

  } catch (error) {
    throw error;
  }
};

module.exports = {
  loginUser
};

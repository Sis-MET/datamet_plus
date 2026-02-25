const { getPool, sql } = require('../config/db');
const { generateToken } = require('../utils/jwt.utils');
const { comparePassword } = require('../utils/hash.utils');

/**
 * Función mock para el ejemplo. En la vida útil aquí debes hacer
 * la consulta "SELECT * FROM Users WHERE email = @email"
 */
const loginUser = async (email, password) => {
  try {
    const pool = getPool();
    
    /* 
      EJEMPLO REAL CON BD:
      const result = await pool.request()
        .input('email', sql.VarChar, email)
        .query('SELECT Id, Email, PasswordHash, Role FROM Users WHERE Email = @email');

      const user = result.recordset[0];
      if (!user) throw new Error('Credenciales inválidas');
      
      const isMatch = await comparePassword(password, user.PasswordHash);
      if (!isMatch) throw new Error('Credenciales inválidas');
      
      // Construir token
      const token = generateToken({ id: user.Id, email: user.Email, role: user.Role });
    */

    // --- Simulación de Auth para no fallar el ejemplo ---
    // En cuanto tengas la tabla Users en SQL Server, descomenta el código de arriba y quita este
    if (email === 'admin@rimmet.com' && password === '123456') {
      const token = generateToken({ id: 1, role: 'admin' });
      return { user: { id: 1, email, name: 'Admin Demo' }, token };
    }

    throw new Error('Credenciales inválidas (para la prueba usa admin@rimmet.com / 123456)');
  } catch (error) {
    throw error;
  }
};

module.exports = {
  loginUser
};

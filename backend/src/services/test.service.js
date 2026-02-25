const { getPool, sql } = require('../config/db');

/**
 * Consulta la base de datos para obtener test data
 */
const getTestDataFromDb = async () => {
  const pool = getPool();
  // Consulta de prueba sencilla. SELECT GETDATE() funciona en cualquier SQL Server para probar conectividad.
  const result = await pool.request().query('SELECT GETDATE() AS CurrentDate, \'Conexión Exitosa RimMET\' AS Message');
  return result.recordset;
};

/**
 * Inserta data de test
 */
const insertTestDataToDb = async (nombre, descripcion) => {
  const pool = getPool();
  
  /* 
   EJEMPLO DE INSERT REAL. 
   Asume que tienes una tabla TestTable:
   CREATE TABLE TestTable (Id INT IDENTITY PRIMARY KEY, Nombre VARCHAR(50), Descripcion VARCHAR(255))
  */
  
  // Vamos a usar una pseudo-consulta usando variables, para demostrar el uso seguro de inputs contra SQL Injection
  const result = await pool.request()
    .input('nombreParam', sql.VarChar, nombre)
    .input('descParam', sql.VarChar, descripcion)
    .query('SELECT @nombreParam AS NombreInsertado, @descParam AS DescripcionInsertada'); 
    
  // En un insert, verificar result.rowsAffected[0] te dice cuantos rows se tocaron
  return result.recordset[0];
};

module.exports = {
  getTestDataFromDb,
  insertTestDataToDb
};

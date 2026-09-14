const path = require('node:path');

// PM2 y las tareas de Windows no siempre arrancan desde backend/.
// Las variables explícitas del proceso conservan su precedencia.
const envFile = path.resolve(__dirname, '../../.env');
function loadEnvFile(options = {}) {
  return require('dotenv').config({ path: envFile, ...options });
}
module.exports = { envFile, loadEnvFile };

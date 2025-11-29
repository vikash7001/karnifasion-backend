// db.js — mssql helper
const sql = require('mssql');
const configFromEnv = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "1433"),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,            // true for Azure / RDS; if not, set false
    trustServerCertificate: true // change to false for stricter validation
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(configFromEnv).then(pool => {
      console.log('Connected to SQL Server');
      return pool;
    }).catch(err => {
      console.error('SQL Connection Error', err);
      throw err;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };

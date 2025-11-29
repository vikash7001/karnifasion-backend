// index.js — minimal API
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('./db');

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username+password required' });
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.VarChar(50), username)
      .query('SELECT UserID, Username, PasswordHash, FullName, Role FROM dbo.tblUsers WHERE Username = @username');
    const user = result.recordset && result.recordset[0];
    if (!user) return res.status(401).json({ message: 'invalid credentials' });
    // if PasswordHash stored as plaintext (not recommended), compare directly; else use bcrypt
    const hash = user.PasswordHash || '';
    const match = (hash && hash.length>10) ? bcrypt.compareSync(password, hash) : (password === hash);
    if (!match) return res.status(401).json({ message: 'invalid credentials' });
    // Minimal token: return user object; you can add JWT if needed
    return res.json({ token: 'dummy-token', user: { id: user.UserID, username: user.Username, fullName: user.FullName, role: user.Role }});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
});

// GET /api/stock
// returns rows from vwStockSummary or tblStock (adapt if view name differs)
app.get('/api/stock', async (req, res) => {
  try {
    const pool = await getPool();
    // Adjust the view/table name if your DB uses different names
    const result = await pool.request().query('SELECT Item, SeriesName, CategoryName, JaipurQty, KolkataQty, TotalQty FROM dbo.vwStockSummary');
    return res.json(result.recordset || []);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

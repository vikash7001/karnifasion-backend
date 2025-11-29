const express = require("express");
const sql = require("mssql");
require("dotenv").config();

const app = express();
app.use(express.json());

// --------------------------------------------
// SQL CONFIG
// --------------------------------------------
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),

  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },

  options: {
    encrypt: true,              // required for AWS RDS
    trustServerCertificate: true
  }
};

let pool;

// --------------------------------------------
// CONNECT TO SQL
// --------------------------------------------
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("🔥 SQL Connected Successfully!");
  } catch (err) {
    console.error("❌ SQL Connection Error:", err);
  }
}

connectDB();

// --------------------------------------------
// ROOT TEST ROUTE
// --------------------------------------------
app.get("/", (req, res) => {
  res.send("Karni Fashions API is live");
});

// --------------------------------------------
// LOGIN ROUTE
// --------------------------------------------
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    const result = await pool.request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, password)
      .query(`
        SELECT UserID, Username 
        FROM tblUsers 
        WHERE Username = @username 
          AND Password = @password
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Simple secure token (not JWT)
    const token = Buffer.from(`${username}:${Date.now()}`).toString("base64");

    res.json({
      token: token,
      user: result.recordset[0]
    });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// --------------------------------------------
// STOCK ROUTE
// --------------------------------------------
app.get("/stock", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB connection not ready" });

    const result = await pool.request().query(`
      SELECT Item, SeriesName, CategoryName, JaipurQty, KolkataQty, TotalQty
      FROM vwStockSummary
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ STOCK ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------
// PRODUCTS ROUTE
// --------------------------------------------
app.get("/products", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB connection not ready" });

    const result = await pool.request().query(`
      SELECT 
        ProductID,
        Item,
        SeriesName,
        CategoryName
      FROM tblProduct
      ORDER BY Item
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// --------------------------------------------
// START SERVER
// --------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Karni API running on port ${PORT}`));

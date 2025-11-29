const express = require("express");
const sql = require("mssql");
require("dotenv").config();

const app = express();
app.use(express.json());

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
    encrypt: true,                  // Required for AWS RDS
    trustServerCertificate: true    // FIXES THE ERROR
  }
};

let pool;

async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("🔥 SQL Connected Successfully!");
  } catch (err) {
    console.error("❌ SQL Connection Error:", err);
  }
}

connectDB();

// ----------------------
// TEST ROUTE (ROOT)
// ----------------------
app.get("/", (req, res) => {
  res.send("Karni Fashions API is live");
});

// ----------------------
// STOCK ROUTE
// ----------------------
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
// -------------------------
// PRODUCTS ENDPOINT
// -------------------------
app.get("/products", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "DB connection not ready" });
        }

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

    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Karni API running on port ${PORT}`));

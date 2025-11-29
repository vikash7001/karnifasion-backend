const express = require("express");
const cors = require("cors");
require("dotenv").config();
const sql = require("mssql");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --------------------------------------------------------
// SQL CONFIG (matches your Render environment variables)
// --------------------------------------------------------
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Global connection pool
let pool;

// Connect only once when server starts
async function connectToSQL() {
    try {
        pool = await sql.connect(dbConfig);
        console.log("✅ Connected to AWS SQL Server");
    } catch (err) {
        console.error("❌ SQL Connection Error:", err);
    }
}

// Start SQL connection
connectToSQL();

// --------------------------------------------------------
// ROOT CHECK
// --------------------------------------------------------
app.get("/", (req, res) => {
    res.send("Karni Fashions API is running.");
});

// --------------------------------------------------------
// LOGIN
// --------------------------------------------------------
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    if (username === "admin" && password === "1234") {
        return res.json({
            success: true,
            token: "karni_token_123",
            message: "Login successful"
        });
    }

    res.status(401).json({ success: false, error: "Invalid username or password" });
});

// --------------------------------------------------------
// PRODUCTS (sample data)
// --------------------------------------------------------
app.get("/products", (req, res) => {
    res.json([
        { name: "Kurti A", category: "Cotton" },
        { name: "Kurti B", category: "Rayon" },
        { name: "Kurti C", category: "Designer" }
    ]);
});

// --------------------------------------------------------
// REAL STOCK API  (vwStockSummary)
// --------------------------------------------------------
app.get("/stock", async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: "DB connection not ready" });
        }

        const result = await pool.request().query(`
            SELECT Item, SeriesName, CategoryName,
                   JaipurQty, KolkataQty, TotalQty
            FROM vwStockSummary;
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error("❌ /stock SQL Error:", err);
        res.status(500).json({ error: "Failed to fetch stock data" });
    }
});

// --------------------------------------------------------
// START SERVER
// --------------------------------------------------------
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`🚀 Karni API running on port ${PORT}`);
});

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const sql = require("mssql");

const app = express();

// -------------------------
// MIDDLEWARES
// -------------------------
app.use(cors());
app.use(express.json());

// -------------------------
// SQL SERVER CONFIG
// -------------------------
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// Global connection pool
let poolPromise = sql.connect(dbConfig).catch(err => {
    console.error("SQL Connection Error:", err);
});

// -------------------------
// ROOT CHECK
// -------------------------
app.get("/", (req, res) => {
    res.send("Karni Fashions API is running");
});

// -------------------------
// LOGIN
// -------------------------
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

    return res.status(401).json({
        success: false,
        error: "Invalid username or password"
    });
});


// -------------------------
// REAL STOCK SUMMARY (vwStockSummary)
// -------------------------
app.get("/stocksummary", async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT 
                Item,
                SeriesName,
                CategoryName,
                JaipurQty,
                KolkataQty,
                TotalQty
            FROM vwStockSummary
            ORDER BY Item;
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching stock summary:", err);
        res.status(500).json({ error: "Failed to fetch stock summary" });
    }
});

// -------------------------
// START SERVER
// -------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Karni API running on port ${port}`));

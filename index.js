const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// -------------------------
// ROOT CHECK (optional but helpful)
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

    // Simple static login
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
// PRODUCTS
// -------------------------
app.get("/products", (req, res) => {
    const sampleProducts = [
        { name: "Kurti A", category: "Cotton" },
        { name: "Kurti B", category: "Rayon" },
        { name: "Kurti C", category: "Designer" }
    ];

    res.json(sampleProducts);
});

// -------------------------
// STOCK
// -------------------------
app.get("/stock", (req, res) => {
    const sampleStock = [
        { product: "Kurti A", qty: 10 },
        { product: "Kurti B", qty: 5 },
        { product: "Kurti C", qty: 15 }
    ];

    res.json(sampleStock);
});

// -------------------------
// START SERVER
// -------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Karni API running on port ${port}`));

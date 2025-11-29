const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------
// LOGIN
// -------------------------
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "1234") {
        return res.json({ token: "karni_token_123" });
    }

    return res.status(401).json({ error: "Invalid username or password" });
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

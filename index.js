// ----------------------------------------------------------
// KARNI FASHIONS BACKEND (CLEAN REWRITE)
// ----------------------------------------------------------

const express = require("express");
const sql = require("mssql");
const cors = require("cors");

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());



// ----------------------------------------------------------
// SQL CONFIG
// ----------------------------------------------------------
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: true, trustServerCertificate: true }
};

let pool;

// ----------------------------------------------------------
// CONNECT TO SQL
// ----------------------------------------------------------
async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("🔥 SQL Connected Successfully!");
  } catch (err) {
    console.error("❌ SQL Connection Error:", err);
  }
}
connectDB();

// ----------------------------------------------------------
// ROOT TEST
// ----------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Karni Fashions API is live");
});

// ----------------------------------------------------------
// LOGIN
// ----------------------------------------------------------
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Missing username or password" });

    const result = await pool.request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, password)
      .query(`
        SELECT UserID, Username, FullName, Role, CustomerType,
               BusinessName, Address, Mobile
        FROM tblUsers
        WHERE Username = @username
          AND PasswordHash = @password
      `);

    if (result.recordset.length === 0)
      return res.status(401).json({ error: "Invalid username or password" });

    const token = Buffer.from(`${username}:${Date.now()}`).toString("base64");

    res.json({ token, user: result.recordset[0] });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ----------------------------------------------------------
// SIGNUP
// ----------------------------------------------------------
app.post("/signup", async (req, res) => {
  try {
    const { username, password, fullName, businessName, address, mobile } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    await pool.request()
      .input("Username", sql.VarChar, username)
      .input("PasswordHash", sql.VarChar, password)
      .input("FullName", sql.VarChar, fullName || null)
      .input("BusinessName", sql.VarChar, businessName || null)
      .input("Address", sql.VarChar, address || null)
      .input("Mobile", sql.VarChar, mobile || null)
      .query(`
        INSERT INTO tblUsers (Username, PasswordHash, FullName, Role, CustomerType,
                              BusinessName, Address, Mobile)
        VALUES (@Username, @PasswordHash, @FullName, 'Customer', 1,
                @BusinessName, @Address, @Mobile)
      `);

    res.json({ success: true, message: "Signup successful" });

  } catch (err) {
    console.error("❌ SIGNUP ERROR:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ----------------------------------------------------------
// GET IMAGE BY PRODUCT ID
// ----------------------------------------------------------
app.get("/image/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;

    const result = await pool.request()
      .input("ProductID", sql.Int, productId)
      .query(`
        SELECT ProductID, ImageURL
        FROM tblItemImages
        WHERE ProductID = @ProductID
      `);

    if (result.recordset.length === 0)
      return res.json({ message: "No image found" });

    res.json(result.recordset[0]);

  } catch (err) {
    console.error("❌ IMAGE FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// ----------------------------------------------------------
// GET IMAGES: ONE SERIES
// ----------------------------------------------------------
app.get("/images/series/:series", async (req, res) => {
  try {
    const series = req.params.series;

    const result = await pool.request()
      .input("Series", sql.VarChar, series)
      .query(`
        SELECT I.ProductID, I.ImageURL
        FROM tblItemImages I
        JOIN vwStockSummary S ON S.ProductID = I.ProductID
        WHERE S.SeriesName = @Series
          AND S.TotalQty > 4
        ORDER BY I.ProductID
      `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ SERIES IMAGE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch series images" });
  }
});

// ----------------------------------------------------------
// GET IMAGES: ONE CATEGORY
// ----------------------------------------------------------
app.get("/images/category/:category", async (req, res) => {
  try {
    const category = req.params.category;

    const result = await pool.request()
      .input("Category", sql.VarChar, category)
      .query(`
        SELECT I.ProductID, I.ImageURL
        FROM tblItemImages I
        JOIN vwStockSummary S ON S.ProductID = I.ProductID
        WHERE S.CategoryName = @Category
          AND S.TotalQty > 4
        ORDER BY I.ProductID
      `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ CATEGORY IMAGE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch category images" });
  }
});

// ----------------------------------------------------------
// GET IMAGES: MULTIPLE SERIES
// ----------------------------------------------------------
app.post("/images/series/list", async (req, res) => {
  try {
    const seriesList = req.body;

    if (!Array.isArray(seriesList) || seriesList.length === 0)
      return res.status(400).json({ error: "Series list is empty" });

    const params = seriesList.map((_, i) => `@S${i}`).join(",");
    const request = pool.request();

    seriesList.forEach((s, i) => request.input(`S${i}`, sql.VarChar, s));

    const result = await request.query(`
      SELECT I.ProductID, I.ImageURL
      FROM tblItemImages I
      JOIN vwStockSummary S ON S.ProductID = I.ProductID
      WHERE S.SeriesName IN (${params})
        AND S.TotalQty > 4
      ORDER BY I.ProductID
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ MULTI-SERIES IMAGE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// ----------------------------------------------------------
// GET IMAGES: MULTIPLE CATEGORIES
// ----------------------------------------------------------
app.post("/images/category/list", async (req, res) => {
  try {
    const categoryList = req.body;

    if (!Array.isArray(categoryList) || categoryList.length === 0)
      return res.status(400).json({ error: "Category list is empty" });

    const params = categoryList.map((_, i) => `@C${i}`).join(",");
    const request = pool.request();

    categoryList.forEach((c, i) => request.input(`C${i}`, sql.VarChar, c));

    const result = await request.query(`
      SELECT I.ProductID, I.ImageURL
      FROM tblItemImages I
      JOIN vwStockSummary S ON S.ProductID = I.ProductID
      WHERE S.CategoryName IN (${params})
        AND S.TotalQty > 4
      ORDER BY I.ProductID
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ MULTI-CATEGORY IMAGE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// ----------------------------------------------------------
// GET ACTIVE SERIES
// ----------------------------------------------------------
app.get("/series", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT SeriesName
      FROM tblSeries
      WHERE IsActive = 1
      ORDER BY SeriesName
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ SERIES LIST ERROR:", err);
    res.status(500).json({ error: "Failed to fetch series" });
  }
});

// ----------------------------------------------------------
// GET ACTIVE CATEGORIES
// ----------------------------------------------------------
app.get("/categories", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT CategoryName
      FROM tblCategory
      WHERE IsActive = 1
      ORDER BY CategoryName
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ CATEGORY LIST ERROR:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
// ----------------------------------------------------------
// STOCK — role based POST
// Body: { "role": "...", "customerType": 0|1|2 }
// ----------------------------------------------------------
app.post("/stock", async (req, res) => {
  try {
    const { role, customerType } = req.body;

    const result = await pool.request().query(`
      SELECT ProductID, Item, SeriesName, CategoryName, JaipurQty, KolkataQty, TotalQty
      FROM vwStockSummary
    `);

    let stock = result.recordset;

    // BASIC CUSTOMER → no stock shown
    if (role === "Customer" && customerType == 1) {
      return res.json([]);
    }

    // PREMIUM CUSTOMER → show “Available” only
    if (role === "Customer" && customerType == 2) {
      stock = stock.map(item => ({
        ProductID: item.ProductID,
        Item: item.Item,
        SeriesName: item.SeriesName,
        CategoryName: item.CategoryName,
        Availability: item.TotalQty > 5 ? "Available" : ""
      }));
      return res.json(stock);
    }

    // ADMIN + USER → show full stock
    return res.json(stock);

  } catch (err) {
    console.error("❌ STOCK ERROR:", err);
    res.status(500).json({ error: err.message || "Failed to fetch stock" });
  }
});

// ----------------------------------------------------------
// PRODUCTS
// ----------------------------------------------------------
app.get("/products", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT ProductID, Item, SeriesName, CategoryName
      FROM tblProduct
      ORDER BY Item
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ----------------------------------------------------------
// START SERVER
// ----------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Karni API running on port ${PORT}`)
);

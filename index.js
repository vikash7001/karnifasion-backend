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
    encrypt: true,
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
        SELECT 
            UserID,
            Username,
            FullName,
            Role,
            CustomerType,
            BusinessName,
            Address,
            Mobile
        FROM tblUsers
        WHERE Username = @username
          AND PasswordHash = @password
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

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
// SIGNUP ROUTE (All signups = Basic Customer)
// --------------------------------------------
app.post("/signup", async (req, res) => {
  try {
    const { username, password, fullName, businessName, address, mobile } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Insert as CustomerType = 1 (BASIC)
    const result = await pool.request()
      .input("Username", sql.VarChar, username)
      .input("PasswordHash", sql.VarChar, password)
      .input("FullName", sql.VarChar, fullName || null)
      .input("BusinessName", sql.VarChar, businessName || null)
      .input("Address", sql.VarChar, address || null)
      .input("Mobile", sql.VarChar, mobile || null)
      .query(`
        INSERT INTO tblUsers (Username, PasswordHash, FullName, Role, CustomerType, BusinessName, Address, Mobile)
        VALUES (@Username, @PasswordHash, @FullName, 'Customer', 1, @BusinessName, @Address, @Mobile)
      `);

    res.json({ success: true, message: "Signup successful" });

  } catch (err) {
    console.error("❌ SIGNUP ERROR:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});
// --------------------------------------------
// GET IMAGE BY PRODUCT ID
// --------------------------------------------
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

    if (result.recordset.length === 0) {
      return res.json({ message: "No image found" });
    }

    res.json(result.recordset[0]);

  } catch (err) {
    console.error("❌ IMAGE FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});
// --------------------------------------------
// GET IMAGES BY SERIES (Only products with stock > 4)
// --------------------------------------------
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
// --------------------------------------------
// GET IMAGES BY CATEGORY (Only products with stock > 4)
// --------------------------------------------
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

// --------------------------------------------
// STOCK ROUTE
// --------------------------------------------
// --------------------------------------------
// STOCK ROUTE — Role Based
// --------------------------------------------
app.post("/stock", async (req, res) => {
  try {
    const { role, customerType } = req.body;

    const result = await pool.request().query(`
      SELECT Item, SeriesName, CategoryName, JaipurQty, KolkataQty, TotalQty
      FROM vwStockSummary
    `);

    let stock = result.recordset;

    // BASIC CUSTOMER → no stock shown
    if (role === "Customer" && customerType == 1) {
      return res.json([]);
    }

    // PREMIUM CUSTOMER → show “Available”
    if (role === "Customer" && customerType == 2) {
      stock = stock.map(item => ({
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
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------
// GET IMAGES BY MULTIPLE SERIES (POST)
// Body: ["Rayon", "Printed", "Cotton"]
// --------------------------------------------
app.post("/images/series/list", async (req, res) => {
  try {
    const seriesList = req.body;  // array of series names

    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      return res.status(400).json({ error: "Series list is empty" });
    }

    // Build SQL IN (...) safely
    const params = seriesList.map((_, i) => `@S${i}`).join(",");
    const request = pool.request();

    seriesList.forEach((s, i) => {
      request.input(`S${i}`, sql.VarChar, s);
    });

    const query = `
      SELECT I.ProductID, I.ImageURL
      FROM tblItemImages I
      JOIN vwStockSummary S ON S.ProductID = I.ProductID
      WHERE S.SeriesName IN (${params})
        AND S.TotalQty > 4
      ORDER BY I.ProductID
    `;

    const result = await request.query(query);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ MULTI-SERIES IMAGE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});
// --------------------------------------------
// GET IMAGES BY MULTIPLE CATEGORIES (POST)
// Body: ["Kurtis", "Nightwear", "Tops"]
// --------------------------------------------
app.post("/images/category/list", async (req, res) => {
  try {
    const categoryList = req.body;  // array of category names

    if (!Array.isArray(categoryList) || categoryList.length === 0) {
      return res.status(400).json({ error: "Category list is empty" });
    }

    // Build SQL IN (...) safely
    const params = categoryList.map((_, i) => `@C${i}`).join(",");
    const request = pool.request();

    categoryList.forEach((c, i) => {
      request.input(`C${i}`, sql.VarChar, c);
    });

    const query = `
      SELECT I.ProductID, I.ImageURL
      FROM tblItemImages I
      JOIN vwStockSummary S ON S.ProductID = I.ProductID
      WHERE S.CategoryName IN (${params})
        AND S.TotalQty > 4
      ORDER BY I.ProductID
    `;

    const result = await request.query(query);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ MULTI-CATEGORY IMAGE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});
// --------------------------------------------
// GET ALL ACTIVE SERIES
// --------------------------------------------
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
    res.status(500).json({ error: "Failed to fetch series list" });
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

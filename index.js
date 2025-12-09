// ----------------------------------------------------------
// KARNI FASHIONS BACKEND (CLEAN REWRITE)
// ----------------------------------------------------------
const admin = require("firebase-admin");
const serviceAccount = require("./karni-fashion-1f0b6-firebase-adminsdk-fbsvc-c049a0f084.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const express = require("express");
const sql = require("mssql");
const cors = require("cors");
require("dotenv").config();        // REQUIRED

const app = express();              // REQUIRED

// ----------------------------------------------------------
// GLOBAL CORS FIX (MUST BE BEFORE ROUTES)
// ----------------------------------------------------------
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
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
app.post("/send-notification", async (req, res) => {
  const { token, title, body } = req.body;

  const message = {
    token: token,
    notification: {
      title: title,
      body: body
    }
  };

  try {
    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
// --- DEBUG /products route (temporary) ---
app.get("/products", async (req, res) => {
  console.log(`[${new Date().toISOString()}] /products called. Authorization:`,
              req.headers.authorization ? "present" : "missing");

  try {
    const q = `
      SELECT ProductID,
             Item,
             SeriesName,
             CategoryName
      FROM tblProduct
      ORDER BY Item;
    `;

    console.log(`[${new Date().toISOString()}] Running SQL: tblProduct query`);

    const result = await pool.request().query(q);

    console.log(`[${new Date().toISOString()}] /products returned rows:`,
                result.recordset?.length || 0);

    return res.json(result.recordset);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] /products ERROR:`,
                  err?.message || err);
    if (err?.stack) console.error(err.stack);

    return res.status(500).json({
      error: err.message || "Failed to fetch products - see server logs",
    });
  }
});
// ----------------------------------------------------------
// POST INCOMING (MULTI ROW WITH TVP)
// ----------------------------------------------------------
app.post("/incoming", async (req, res) => {
  try {
    const { UserName, Location, Rows } = req.body;

    if (!UserName || !Location || !Array.isArray(Rows) || Rows.length === 0) {
      return res.status(400).json({ error: "Invalid input format" });
    }

    // -------------------------------------------
    // BUILD TVP (IncomingDetailType)
    // -------------------------------------------
    const tvp = new sql.Table("IncomingDetailType");
    tvp.columns.add("Item", sql.NVarChar(200));
    tvp.columns.add("SeriesName", sql.NVarChar(100));
    tvp.columns.add("CategoryName", sql.NVarChar(100));
    tvp.columns.add("Quantity", sql.Decimal(18, 2));

    Rows.forEach(r => {
      tvp.rows.add(r.Item, r.SeriesName, r.CategoryName, r.Quantity);
    });

    // -------------------------------------------
    // EXECUTE STORED PROCEDURE
    // -------------------------------------------
    const request = pool.request();
    request.input("UserName", sql.NVarChar(100), UserName);
    request.input("Location", sql.NVarChar(100), Location);
    request.input("Details", tvp);
    request.output("IncomingHeaderID", sql.Int);

    const result = await request.execute("usp_PostIncoming_MultiRow");

    return res.json({
      success: true,
      headerID: result.output.IncomingHeaderID,
      rowsPosted: Rows.length
    });

  } catch (err) {
    console.error("❌ INCOMING POST ERROR:", err);
    res.status(500).json({ error: err.message || "Failed to post incoming" });
  }
});
app.get("/customers", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT CustomerName
      FROM tblCustomer
      ORDER BY CustomerName
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ CUSTOMERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});
app.post("/sales", async (req, res) => {
  try {
    const { UserName, Location, Customer, VoucherNo, Rows } = req.body;

    if (!UserName || !Location || !Array.isArray(Rows) || Rows.length === 0) {
      return res.status(400).json({ error: "Invalid input format" });
    }

    // -------------------------------------------
    // TVP (SalesDetailType)
    // -------------------------------------------
    const tvp = new sql.Table("SalesDetailType");
    tvp.columns.add("Item", sql.NVarChar(200));
    tvp.columns.add("SeriesName", sql.NVarChar(100));
    tvp.columns.add("CategoryName", sql.NVarChar(100));
    tvp.columns.add("Quantity", sql.Decimal(18, 2));

    Rows.forEach(r => {
      tvp.rows.add(r.Item, r.SeriesName, r.CategoryName, r.Quantity);
    });

    // -------------------------------------------
    // Execute SP
    // -------------------------------------------
    const request = pool.request();
    request.input("UserName", sql.NVarChar(100), UserName);
    request.input("Location", sql.NVarChar(100), Location);
    request.input("Customer", sql.NVarChar(100), Customer);
    request.input("VoucherNo", sql.NVarChar(50), VoucherNo);
    request.input("Details", tvp);
    request.output("SalesID", sql.Int);

    const result = await request.execute("usp_PostSales_MultiRow");

    return res.json({
      success: true,
      salesID: result.output.SalesID,
      rowsPosted: Rows.length
    });

  } catch (err) {
    console.error("❌ SALES POST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
// ----------------------------------------------------------
// SAVE / UPDATE IMAGE BY ITEM
// Body: { Item: "10001", ImageURL: "https://drive.google.com/..." }
// ----------------------------------------------------------
app.post("/image/save", async (req, res) => {
  try {
    const { Item, ImageURL } = req.body;
    if (!Item || !ImageURL) return res.status(400).json({ error: "Item and ImageURL required" });

    // convert Google Drive share link -> direct view if present
    function convertDrive(url) {
      try {
        const m = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
        if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
        return url;
      } catch { return url; }
    }
    const finalUrl = convertDrive(ImageURL);

    // find ProductID by Item (Item is design number string)
    const find = await pool.request()
      .input("Item", sql.NVarChar, Item)
      .query(`SELECT ProductID FROM tblProduct WHERE Item = @Item`);

    if (!find.recordset.length) return res.status(404).json({ error: "Item not found" });

    const productId = find.recordset[0].ProductID;

    // upsert into tblItemImages (one row per product)
    const exists = await pool.request()
      .input("ProductID", sql.Int, productId)
      .query(`SELECT ProductID FROM tblItemImages WHERE ProductID = @ProductID`);

    if (exists.recordset.length) {
      await pool.request()
        .input("ProductID", sql.Int, productId)
        .input("ImageURL", sql.VarChar(sql.MAX), finalUrl)
        .query(`UPDATE tblItemImages SET ImageURL = @ImageURL WHERE ProductID = @ProductID`);
    } else {
      await pool.request()
        .input("ProductID", sql.Int, productId)
        .input("ImageURL", sql.VarChar(sql.MAX), finalUrl)
        .query(`INSERT INTO tblItemImages (ProductID, ImageURL) VALUES (@ProductID, @ImageURL)`);
    }

    return res.json({ success: true, ProductID: productId, ImageURL: finalUrl });

  } catch (err) {
    console.error("❌ IMAGE SAVE ERROR:", err);
    return res.status(500).json({ error: "Failed to save image" });
  }
});
// ----------------------------------------------------------
// LIST ALL PRODUCTS WITH IMAGE URLs (for editing panel)
// ----------------------------------------------------------
app.get("/images/list", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        P.ProductID,
        P.Item,
        ISNULL(I.ImageURL, '') AS ImageURL
      FROM tblProduct P
      LEFT JOIN tblItemImages I ON I.ProductID = P.ProductID
      ORDER BY P.Item
    `);

    return res.json(result.recordset);

  } catch (err) {
    console.error("❌ IMAGE LIST ERROR:", err);
    return res.status(500).json({ error: "Failed to fetch image list" });
  }
});
// ----------------------------------------------------------
// GET SERIES THAT HAVE AT LEAST ONE ITEM WITH STOCK > 5
// ----------------------------------------------------------
app.get("/series/active-with-stock", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT DISTINCT S.SeriesName
      FROM vwStockSummary S
      WHERE (S.JaipurQty > 5 OR S.KolkataQty > 5)
      ORDER BY S.SeriesName
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ SERIES STOCK ERROR:", err);
    res.status(500).json({ error: "Failed to fetch series with stock" });
  }
});
// ----------------------------------------------------------
// GET CATEGORIES THAT HAVE AT LEAST ONE ITEM WITH STOCK > 5
// ----------------------------------------------------------
app.get("/categories/active-with-stock", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT DISTINCT S.CategoryName
      FROM vwStockSummary S
      WHERE (S.JaipurQty > 5 OR S.KolkataQty > 5)
      ORDER BY S.CategoryName
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error("❌ CATEGORY STOCK ERROR:", err);
    res.status(500).json({ error: "Failed to fetch categories with stock" });
  }
});

// ----------------------------------------------------------
// START SERVER
// ----------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Karni API running on port ${PORT}`)
);

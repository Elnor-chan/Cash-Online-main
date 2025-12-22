const express = require("express");
const cors = require("cors");
const db = require("./db");
const authMiddleware = require("./middleware/auth");

require("dotenv").config();

// 引入路由模块
const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/accounts");
const partnerRoutes = require("./routes/partners");
const transactionRoutes = require("./routes/transactions");
const reportRoutes = require("./routes/reports");
const inventoryRoutes = require("./routes/inventory");
const orderRoutes = require("./routes/orders");
const commodityRoutes = require("./routes/commodities"); // [新增]
const exchangeRateRoutes = require("./routes/exchange_rates"); // [新增]

const app = express();

// --- 全局中间件配置 ---
app.use(cors());
app.use(express.json());

// --- 公共路由 (无需鉴权) ---
app.use("/api/auth", authRoutes);

// --- 保护路由 (必须通过鉴权才能访问) ---
app.use("/api/accounts", authMiddleware, accountRoutes);
app.use("/api/partners", authMiddleware, partnerRoutes);
app.use("/api/transactions", authMiddleware, transactionRoutes);
app.use("/api/reports", authMiddleware, reportRoutes);
app.use("/api/inventory", authMiddleware, inventoryRoutes);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/commodities", authMiddleware, commodityRoutes); // [新增]
app.use("/api/exchange-rates", authMiddleware, exchangeRateRoutes); // [新增]

// 根路由测试
app.get("/", (req, res) => {
  res.json({ message: "企业财务系统 API 后端正在运行..." });
});

const PORT = process.env.PORT || 3000;

/**
 * 启动服务并验证数据库连接
 */
async function startServer() {
  try {
    // 测试数据库是否联通
    await db.query("SELECT 1");
    console.log("✅ 数据库连接成功");

    app.listen(PORT, () => {
      console.log(`✅ 服务已启动: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ 无法启动服务器，数据库连接失败:");
    console.error(err.message);
    process.exit(1);
  }
}

startServer();

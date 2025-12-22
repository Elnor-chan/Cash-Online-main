const mysql = require("mysql2");
require("dotenv").config();

// 创建连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cash_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 封装为 Promise 导出
const promisePool = pool.promise();

module.exports = promisePool;

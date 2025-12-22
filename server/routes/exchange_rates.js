const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * @route   GET /api/exchange-rates
 * @desc    获取所有汇率列表
 */
router.get("/", async (req, res) => {
  try {
    const sql = `
        SELECT r.*, 
               c1.symbol as from_symbol, 
               c2.symbol as to_symbol
        FROM biz_exchange_rates r
        JOIN biz_commodities c1 ON r.from_currency = c1.commodity_id
        JOIN biz_commodities c2 ON r.to_currency = c2.commodity_id
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "获取汇率失败", error: err.message });
  }
});

module.exports = router;

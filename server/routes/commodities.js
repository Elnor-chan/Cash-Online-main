const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * @route   GET /api/commodities
 * @desc    获取所有货币列表
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM biz_commodities WHERE namespace = 'CURRENCY'"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "获取币种失败", error: err.message });
  }
});

module.exports = router;

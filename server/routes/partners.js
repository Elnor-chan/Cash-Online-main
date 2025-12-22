const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4 } = require("uuid");

/**
 * @route   GET /api/partners
 * @desc    获取所有往来单位 (可按类型筛选)
 */
router.get("/", async (req, res) => {
  const { type } = req.query;
  let sql = "SELECT * FROM biz_partners";
  let params = [];

  if (type) {
    sql += " WHERE partner_type = ?";
    params.push(type);
  }

  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "获取往来单位失败", error: err.message });
  }
});

/**
 * @route   POST /api/partners
 * @desc    创建新的往来单位
 */
router.post("/", async (req, res) => {
  const {
    partner_code,
    legal_name,
    partner_type,
    contact_email,
    contact_phone,
    shipping_address,
  } = req.body;
  const newId = uuidv4();

  if (!partner_code || !legal_name || !partner_type) {
    return res.status(400).json({ message: "代码、名称和类型不能为空" });
  }

  try {
    const sql = `INSERT INTO biz_partners (partner_id, partner_code, legal_name, partner_type, contact_email, contact_phone, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await db.query(sql, [
      newId,
      partner_code,
      legal_name,
      partner_type,
      contact_email,
      contact_phone,
      shipping_address,
    ]);
    res.status(201).json({ message: `${partner_type} 创建成功`, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "创建往来单位失败", error: err.message });
  }
});

/**
 * @route   PUT /api/partners/:id
 * @desc    更新往来单位信息 [新增]
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    partner_code,
    legal_name,
    partner_type,
    contact_email,
    contact_phone,
    shipping_address,
  } = req.body;

  if (!partner_code || !legal_name || !partner_type) {
    return res.status(400).json({ message: "代码、名称和类型不能为空" });
  }

  try {
    const sql = `
      UPDATE biz_partners 
      SET partner_code = ?, legal_name = ?, partner_type = ?, 
          contact_email = ?, contact_phone = ?, shipping_address = ?
      WHERE partner_id = ?
    `;

    const [result] = await db.query(sql, [
      partner_code,
      legal_name,
      partner_type,
      contact_email,
      contact_phone,
      shipping_address,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "未找到该往来单位" });
    }

    res.json({ message: "更新成功" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "更新失败", error: err.message });
  }
});

module.exports = router;

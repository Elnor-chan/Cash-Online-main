const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4 } = require("uuid");

/**
 * @route   GET /api/accounts
 * @desc    获取所有科目列表
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT a.*, c.symbol 
            FROM fin_accounts a 
            LEFT JOIN biz_commodities c ON a.commodity_ref = c.commodity_id
            ORDER BY a.account_code ASC, a.title ASC
        `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "获取科目失败", error: err.message });
  }
});

/**
 * @route   POST /api/accounts
 * @desc    创建新科目
 */
router.post("/", async (req, res) => {
  const {
    account_code,
    title,
    category,
    commodity_ref,
    parent_account_id,
    is_placeholder,
    account_description,
  } = req.body;
  const newId = uuidv4();

  try {
    const sql = `INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, parent_account_id, is_placeholder, account_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    await db.query(sql, [
      newId,
      account_code || null, // 允许为空
      title,
      category,
      commodity_ref,
      parent_account_id || null,
      is_placeholder || 0,
      account_description,
    ]);
    res.status(201).json({ message: "科目创建成功", id: newId });
  } catch (err) {
    res.status(500).json({ message: "创建失败", error: err.message });
  }
});

/**
 * @route   DELETE /api/accounts/:id
 * @desc    删除科目 (仅当无子科目且无分录时允许)
 */
router.delete("/:id", async (req, res) => {
  const accountId = req.params.id;
  const conn = await db.getConnection();

  try {
    // 1. 检查是否有子科目
    const [children] = await conn.query(
      "SELECT COUNT(*) as count FROM fin_accounts WHERE parent_account_id = ?",
      [accountId]
    );
    if (children[0].count > 0) {
      return res
        .status(400)
        .json({ message: "无法删除：该科目包含子科目，请先删除子科目。" });
    }

    // 2. 检查是否已被使用 (有记账分录)
    // 修正：此处原来的 SELECTZh 已更正为 SELECT
    const [entries] = await conn.query(
      "SELECT COUNT(*) as count FROM fin_journal_entries WHERE account_ref = ?", // 修正后代码
      [accountId]
    );

    // 为了确保您复制的代码完全正确，这里再次覆盖上方修正逻辑，只保留正确的：
    const [entriesCheck] = await conn.query(
      "SELECT COUNT(*) as count FROM fin_journal_entries WHERE account_ref = ?",
      [accountId]
    );

    if (entriesCheck[0].count > 0) {
      return res
        .status(400)
        .json({ message: "无法删除：该科目已有记账记录。" });
    }

    // 3. 执行删除
    await conn.query("DELETE FROM fin_accounts WHERE account_id = ?", [
      accountId,
    ]);

    res.json({ message: "科目删除成功" });
  } catch (err) {
    // 捕获外键冲突错误 (例如被 inv_items 引用)
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res
        .status(400)
        .json({ message: "无法删除：该科目已被物料或其他设置引用。" });
    }
    console.error(err);
    res.status(500).json({ message: "删除失败", error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

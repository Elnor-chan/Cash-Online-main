const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4 } = require("uuid");

/**
 * 辅助函数：将金额转换为分子/分母格式
 * 假设所有金额保留2位小数处理 (精度 100)
 * 例如: 100.50 -> num: 10050, denom: 100
 */
const toRational = (amount) => {
  // 防止浮点数计算误差，先转字符串再处理，或者简单乘法
  // 这里采用简单乘法，实际生产环境建议用 decimal.js
  const precision = 100;
  const n = Number(amount);
  const num = Math.round(n * precision);
  return { num, denom: precision };
};

/**
 * @route   POST /api/transactions
 * @desc    创建新的记账凭证 (包含多个分录)
 */
router.post("/", async (req, res) => {
  const { posting_date, summary, currency_ref, entries } = req.body;

  // 1. 基础校验
  if (!entries || entries.length < 2) {
    return res.status(400).json({ message: "凭证至少需要两条分录" });
  }

  if (!currency_ref) {
    return res.status(400).json({ message: "缺少币种" });
  }

  // 2. 校验借贷平衡
  const preparedEntries = [];
  let sumNum = 0;
  let totalDebitNum = 0;
  let totalCreditNum = 0;

  for (const entry of entries) {
    if (!entry || !entry.account_id) {
      return res.status(400).json({ message: "分录缺少科目" });
    }
    if (entry.type !== "DEBIT" && entry.type !== "CREDIT") {
      return res.status(400).json({ message: "分录方向不正确" });
    }

    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "分录金额不正确" });
    }

    let signedAmount = amount;
    if (entry.type === "CREDIT") signedAmount = -amount;

    const r = toRational(signedAmount);
    if (!Number.isFinite(r.num) || !Number.isFinite(r.denom) || r.denom === 0) {
      return res.status(400).json({ message: "金额格式不正确" });
    }

    // 避免出现“看起来有金额，但按入账精度四舍五入后为 0”的分录
    if (r.num === 0) {
      return res
        .status(400)
        .json({ message: "分录金额太小，按入账精度四舍五入后为 0" });
    }

    sumNum += r.num;
    if (r.num > 0) totalDebitNum += r.num;
    if (r.num < 0) totalCreditNum += -r.num;

    preparedEntries.push({
      ...entry,
      signedAmount,
      rational: r,
    });
  }

  if (totalDebitNum <= 0) {
    return res.status(400).json({ message: "借方合计必须大于 0" });
  }

  if (sumNum !== 0) {
    return res.status(400).json({
      message: `借贷不平! 借方: ${(totalDebitNum / 100).toFixed(2)}, 贷方: ${(
        totalCreditNum / 100
      ).toFixed(2)}`,
    });
  }

  // 3. 校验科目是否存在且可记账（is_placeholder=0）
  const uniqueAccountIds = Array.from(
    new Set(preparedEntries.map((e) => e.account_id))
  );
  if (uniqueAccountIds.length === 0) {
    return res.status(400).json({ message: "分录缺少科目" });
  }

  const conn = await db.getConnection();
  try {
    const placeholdersSql = `
            SELECT account_id, is_placeholder
            FROM fin_accounts
            WHERE account_id IN (${uniqueAccountIds.map(() => "?").join(",")})
        `;
    const [accounts] = await conn.query(placeholdersSql, uniqueAccountIds);

    if (accounts.length !== uniqueAccountIds.length) {
      return res.status(400).json({ message: "分录包含不存在的科目" });
    }

    const hasPlaceholder = accounts.some((a) => Number(a.is_placeholder) === 1);
    if (hasPlaceholder) {
      return res
        .status(400)
        .json({ message: "存在不可记账科目（父级/占位科目）" });
    }

    // 4. 开始数据库事务
    await conn.beginTransaction();

    const txnId = uuidv4();

    // 5. 插入主表 (Transaction Header)
    const txnSql = `
            INSERT INTO fin_transactions 
            (txn_id, currency_ref, posting_date, summary, doc_number) 
            VALUES (?, ?, ?, ?, ?)
        `;
    // 假设 doc_number 自动生成或前端不传为空
    await conn.query(txnSql, [
      txnId,
      currency_ref,
      posting_date,
      summary,
      null,
    ]);

    // 6. 插入分录表 (Splits)
    const entrySql = `
            INSERT INTO fin_journal_entries 
            (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

    for (const entry of preparedEntries) {
      const entryId = uuidv4();
      const r = entry.rational;

      // 暂时假设 数量(Qty) = 金额(Value)，即单一币种，不涉及股票/外汇兑换
      await conn.query(entrySql, [
        entryId,
        txnId,
        entry.account_id,
        entry.memo || "",
        r.num,
        r.denom, // Value
        r.num,
        r.denom, // Qty (简化处理)
      ]);
    }

    // 7. 提交事务
    await conn.commit();
    res.status(201).json({ message: "凭证保存成功", id: txnId });
  } catch (err) {
    // 8. 出错回滚
    try {
      await conn.rollback();
    } catch (_) {
      // ignore
    }
    console.error(err);
    res.status(500).json({ message: "保存失败", error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * @route   GET /api/transactions
 * @desc    获取凭证列表 (简单版)
 */
/**
 * @route   GET /api/transactions
 * @desc    获取凭证列表 (带分录详情)
 */
router.get("/", async (req, res) => {
  try {
    // 1. 获取最近的 50 条凭证主表
    const txnSql = `
            SELECT t.txn_id, t.posting_date, t.summary, t.doc_number,
                   c.symbol as currency
            FROM fin_transactions t
            LEFT JOIN biz_commodities c ON t.currency_ref = c.commodity_id
            ORDER BY t.posting_date DESC, t.entry_date DESC
            LIMIT 50
        `;
    const [txns] = await db.query(txnSql);

    if (txns.length === 0) return res.json([]);

    // 2. 获取这些凭证对应的所有分录
    const txnIds = txns.map((t) => t.txn_id);
    const entrySql = `
            SELECT e.*, a.title as account_name 
            FROM fin_journal_entries e
            LEFT JOIN fin_accounts a ON e.account_ref = a.account_id
            WHERE e.txn_ref IN (${txnIds.map(() => "?").join(",")})
            ORDER BY e.val_num DESC -- 让借方一般排在前面
        `;
    const [entries] = await db.query(entrySql, txnIds);

    // 3. 组装数据
    const txnsWithEntries = txns.map((txn) => {
      const myEntries = entries
        .filter((e) => e.txn_ref === txn.txn_id)
        .map((e) => ({
          ...e,
          // 转换回浮点数显示
          amount: (parseInt(e.val_num) / parseInt(e.val_denom)).toFixed(2),
        }));

      // 计算凭证总金额 (取借方总和)
      const total = myEntries
        .filter((e) => parseFloat(e.amount) > 0)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

      return {
        ...txn,
        total_amount: total.toFixed(2),
        entries: myEntries,
      };
    });

    res.json(txnsWithEntries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "获取列表失败", error: err.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/trial-balance", async (req, res) => {
  try {
    // 1. 获取所有科目
    const [accounts] = await db.query(
      "SELECT account_id, title, category, parent_account_id, account_code FROM fin_accounts ORDER BY account_code"
    );

    // 2. 获取分录汇总，按【科目 + 币种】分组
    // 修正：关联 fin_transactions 表以获取 currency_ref，而不是假设单币种
    const sql = `
            SELECT e.account_ref, 
                   t.currency_ref,
                   c.symbol,
                   SUM(CASE WHEN e.val_num > 0 THEN e.val_num / e.val_denom ELSE 0 END) as total_debit,
                   SUM(CASE WHEN e.val_num < 0 THEN -(e.val_num / e.val_denom) ELSE 0 END) as total_credit
            FROM fin_journal_entries e
            JOIN fin_transactions t ON e.txn_ref = t.txn_id
            LEFT JOIN biz_commodities c ON t.currency_ref = c.commodity_id
            GROUP BY e.account_ref, t.currency_ref
        `;
    const [rows] = await db.query(sql);

    // 3. 组装数据：每个科目下可能包含多个币种的余额
    const balanceMap = {};
    rows.forEach((row) => {
      if (!balanceMap[row.account_ref]) {
        balanceMap[row.account_ref] = [];
      }
      balanceMap[row.account_ref].push({
        currency_id: row.currency_ref,
        symbol: row.symbol || "?",
        debit: parseFloat(row.total_debit || 0),
        credit: parseFloat(row.total_credit || 0),
        net:
          parseFloat(row.total_debit || 0) - parseFloat(row.total_credit || 0),
      });
    });

    // 4. 将余额数组挂载到科目树节点上
    const result = accounts.map((acc) => {
      return {
        ...acc,
        balances: balanceMap[acc.account_id] || [], // 这是一个数组，不再是单个值
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "报表生成失败", error: err.message });
  }
});

module.exports = router;

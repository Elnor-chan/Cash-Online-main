const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4 } = require("uuid");

// 精度常量
const PRECISION = 100;
// 本位币 ID (CNY)，与 init.sql 保持一致
const BASE_CURRENCY_ID = "d9b75249-1667-4279-8800-98586f4a3674";

const toRational = (amount) => {
  // 简单的精度处理，实际项目建议使用 decimal 库
  const num = Math.round(parseFloat(amount) * PRECISION);
  return { num, denom: PRECISION };
};

// --- 物料主数据接口 ---
router.get("/items", async (req, res) => {
  try {
    const sql = `
            SELECT i.*, 
                   inv.title AS inventory_account_name,
                   cogs.title AS cogs_account_name,
                   sales.title AS sales_account_name
            FROM inv_items i
            LEFT JOIN fin_accounts inv ON i.inventory_account_ref = inv.account_id
            LEFT JOIN fin_accounts cogs ON i.cogs_account_ref = cogs.account_id
            LEFT JOIN fin_accounts sales ON i.sales_account_ref = sales.account_id
        `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "获取物料列表失败", error: err.message });
  }
});

router.post("/items", async (req, res) => {
  const {
    item_code,
    item_name,
    unit_of_measure,
    costing_method,
    inventory_account_ref,
    cogs_account_ref,
    sales_account_ref,
  } = req.body;
  const newId = uuidv4();

  if (!item_code || !item_name || !unit_of_measure) {
    return res.status(400).json({ message: "必填字段不能为空" });
  }

  try {
    const sql = `
            INSERT INTO inv_items 
            (item_id, item_code, item_name, unit_of_measure, costing_method, inventory_account_ref, cogs_account_ref, sales_account_ref) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
    await db.query(sql, [
      newId,
      item_code,
      item_name,
      unit_of_measure,
      costing_method || "AVERAGE",
      inventory_account_ref || null,
      cogs_account_ref || null,
      sales_account_ref || null,
    ]);
    res.status(201).json({ message: "物料创建成功", id: newId });
  } catch (err) {
    res.status(500).json({ message: "创建物料失败", error: err.message });
  }
});

// --- 采购入库 (Inbound) - 修复版 ---
router.post("/inbound", async (req, res) => {
  const {
    supplier_id,
    inbound_date,
    payment_account_id,
    currency_ref,
    exchange_rate, // [新增] 汇率参数 (1 外币 = x 本位币)
    line_items,
  } = req.body;

  if (
    !supplier_id ||
    !inbound_date ||
    !payment_account_id ||
    !line_items ||
    line_items.length === 0
  ) {
    return res.status(400).json({ message: "采购入库信息不完整" });
  }

  // 默认汇率为 1 (如果是本位币交易)
  const rate = parseFloat(exchange_rate) || 1.0;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const txnId = uuidv4();
    let totalCost = 0; // 交易币种总额 (用于记录应付/银行)

    // 1. 生成总账交易头 (保持原币种，如 USD，以便对账)
    await conn.query(
      `INSERT INTO fin_transactions (txn_id, currency_ref, posting_date, summary) VALUES (?, ?, ?, ?)`,
      [txnId, currency_ref, inbound_date, `采购入库 - 供应商 ${supplier_id}`]
    );

    for (const item of line_items) {
      const qtyIn = Math.round(item.quantity);
      const costUnit = parseFloat(item.unit_cost); // 原币单价 (如 USD)
      const costTotal = qtyIn * costUnit; // 原币总价
      totalCost += costTotal;

      // [核心修复] 计算本位币成本，用于更新库存价值
      const costUnitBase = costUnit * rate;
      const costTotalBase = costTotal * rate;

      // --- 核心算法：移动加权平均 & 锁行 ---
      const [rows] = await conn.query(
        `SELECT * FROM inv_items WHERE item_id = ? FOR UPDATE`,
        [item.item_id]
      );
      if (rows.length === 0) throw new Error(`物料 ${item.item_id} 不存在`);

      const dbItem = rows[0];
      const oldQty = parseInt(dbItem.qty_on_hand || 0);
      const oldAvgNum = parseInt(dbItem.avg_cost_num || 0);
      const oldAvgDenom = parseInt(dbItem.avg_cost_denom || 100);
      const oldAvgCostBase = oldAvgNum / oldAvgDenom; // 旧平均价 (本位币)

      // 计算新平均成本 (本位币): (旧总值 + 新入库本位币总值) / (旧数量 + 新数量)
      const newTotalQty = oldQty + qtyIn;
      let newAvgCostBase = 0;
      if (newTotalQty > 0) {
        newAvgCostBase =
          (oldQty * oldAvgCostBase + costTotalBase) / newTotalQty;
      } else {
        newAvgCostBase = costUnitBase;
      }

      const rNewAvg = toRational(newAvgCostBase);
      // 注意：Journal Entry 这里存原币金额，但在 inv_items 存本位币价值。
      const rCostTotal = toRational(costTotal);

      // 更新物料表快照 (使用本位币价值!)
      await conn.query(
        `UPDATE inv_items SET qty_on_hand = ?, avg_cost_num = ?, avg_cost_denom = ? WHERE item_id = ?`,
        [newTotalQty, rNewAvg.num, rNewAvg.denom, item.item_id]
      );

      // 插入库存移动日志 (记录本位币成本，确保历史可追溯)
      await conn.query(
        `INSERT INTO inv_movements (move_id, item_ref, move_type, quantity, unit_cost_num, unit_cost_denom, move_date, related_txn_ref) 
                 VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          item.item_id,
          qtyIn,
          toRational(costUnitBase).num, // [修复] 这里存本位币单价
          PRECISION,
          inbound_date,
          txnId,
        ]
      );

      // 生成借方分录 (借：存货) - 金额为原币种 (USD)
      if (!dbItem.inventory_account_ref)
        throw new Error(`物料 ${dbItem.item_code} 未配置存货科目`);
      await conn.query(
        `INSERT INTO fin_journal_entries (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          txnId,
          dbItem.inventory_account_ref,
          `入库: ${dbItem.item_name}`,
          rCostTotal.num,
          PRECISION,
          0,
          1,
        ]
      );
    }

    // 2. 生成贷方分录 (贷：应付/银行) - 总额 (原币种)
    const rTotalCredit = toRational(-totalCost);
    await conn.query(
      `INSERT INTO fin_journal_entries (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        txnId,
        payment_account_id,
        `采购结算`,
        rTotalCredit.num,
        PRECISION,
        0,
        1,
      ]
    );

    await conn.commit();
    res.status(201).json({ message: "入库成功", txnId, totalCost });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "入库失败", error: err.message });
  } finally {
    conn.release();
  }
});

// --- 销售出库 (Outbound) - 修复版 ---
router.post("/outbound", async (req, res) => {
  const {
    customer_id,
    outbound_date,
    received_account_id,
    currency_ref, // 销售收入的币种 (如 USD)
    line_items,
  } = req.body;

  if (!line_items || line_items.length === 0)
    return res.status(400).json({ message: "无明细" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const txnIdRevenue = uuidv4();
    const txnIdCogs = uuidv4(); // 成本结转凭证
    let totalSales = 0;
    let totalCogsBase = 0; // 本位币总成本

    // 1. 创建交易头
    // A. 收入交易 (原币种，如 USD)
    await conn.query(
      `INSERT INTO fin_transactions (txn_id, currency_ref, posting_date, summary) VALUES (?, ?, ?, ?)`,
      [
        txnIdRevenue,
        currency_ref,
        outbound_date,
        `销售收入 - 客户 ${customer_id}`,
      ]
    );

    // B. 成本交易 (强制使用本位币 CNY)
    // [修复] 成本结转必须基于本位币，因为库存价值是本位币
    await conn.query(
      `INSERT INTO fin_transactions (txn_id, currency_ref, posting_date, summary) VALUES (?, ?, ?, ?)`,
      [txnIdCogs, BASE_CURRENCY_ID, outbound_date, `销售成本结转`]
    );

    for (const item of line_items) {
      const qtyOut = Math.round(item.quantity);
      const salesPrice = parseFloat(item.unit_price);
      const salesTotal = qtyOut * salesPrice; // 原币销售额
      totalSales += salesTotal;

      // --- 锁行 & 负库存检查 ---
      const [rows] = await conn.query(
        `SELECT * FROM inv_items WHERE item_id = ? FOR UPDATE`,
        [item.item_id]
      );
      if (rows.length === 0) throw new Error(`物料不存在`);

      const dbItem = rows[0];
      const currentQty = parseInt(dbItem.qty_on_hand || 0);

      if (currentQty < qtyOut) {
        throw new Error(
          `物料 ${dbItem.item_code} 库存不足! 当前: ${currentQty}, 需要: ${qtyOut}`
        );
      }

      // 获取当前加权平均成本 (数据库中存储的为本位币)
      const currentAvgCostBase =
        parseFloat(dbItem.avg_cost_num) / parseFloat(dbItem.avg_cost_denom);
      const cogsTotalBase = qtyOut * currentAvgCostBase;
      totalCogsBase += cogsTotalBase;

      // 更新库存数量 (平均成本不变)
      const newQty = currentQty - qtyOut;
      await conn.query(
        `UPDATE inv_items SET qty_on_hand = ? WHERE item_id = ?`,
        [newQty, item.item_id]
      );

      // 记录移动 (出库记录本位币成本)
      await conn.query(
        `INSERT INTO inv_movements (move_id, item_ref, move_type, quantity, unit_cost_num, unit_cost_denom, move_date, related_txn_ref) 
                 VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          item.item_id,
          qtyOut,
          dbItem.avg_cost_num,
          dbItem.avg_cost_denom,
          outbound_date,
          txnIdCogs,
        ]
      );

      // --- 凭证分录 ---

      // A. 收入凭证 (Txn1 - USD)
      // 贷：主营业务收入 (负数)
      if (!dbItem.sales_account_ref)
        throw new Error(`物料 ${dbItem.item_code} 未配置收入科目`);
      const rSales = toRational(-salesTotal);
      await conn.query(
        `INSERT INTO fin_journal_entries (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          txnIdRevenue,
          dbItem.sales_account_ref,
          `销售: ${dbItem.item_name}`,
          rSales.num,
          PRECISION,
          0,
          1,
        ]
      );

      // B. 成本凭证 (Txn2 - CNY)
      // 借：主营业务成本 (正数)
      // 贷：库存 (负数)
      // [修复] 这里使用本位币金额，因为 Txn2 是本位币交易
      if (!dbItem.cogs_account_ref || !dbItem.inventory_account_ref)
        throw new Error(`物料科目配置不全`);

      const rCogsDebit = toRational(cogsTotalBase);
      const rCogsCredit = toRational(-cogsTotalBase);

      // 借：COGS (CNY)
      await conn.query(
        `INSERT INTO fin_journal_entries (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          txnIdCogs,
          dbItem.cogs_account_ref,
          `成本结转`,
          rCogsDebit.num,
          PRECISION,
          0,
          1,
        ]
      );
      // 贷：库存 (CNY)
      await conn.query(
        `INSERT INTO fin_journal_entries (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          txnIdCogs,
          dbItem.inventory_account_ref,
          `库存减少`,
          rCogsCredit.num,
          PRECISION,
          0,
          1,
        ]
      );
    }

    // 完成收入凭证的借方：应收/银行 (Txn1 - USD)
    const rTotalReceivable = toRational(totalSales);
    await conn.query(
      `INSERT INTO fin_journal_entries (entry_id, txn_ref, account_ref, memo, val_num, val_denom, qty_num, qty_denom) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        txnIdRevenue,
        received_account_id,
        `销售收款`,
        rTotalReceivable.num,
        PRECISION,
        0,
        1,
      ]
    );

    await conn.commit();
    res
      .status(201)
      .json({ message: "出库成功", totalSales, totalCogs: totalCogsBase });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "出库失败", error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

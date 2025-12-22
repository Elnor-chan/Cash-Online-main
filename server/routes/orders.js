const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4 } = require("uuid");

const toRational = (amount) => {
  const precision = 100;
  const num = Math.round(parseFloat(amount) * precision);
  return { num, denom: precision };
};

const generateOrderNumber = (prefix) => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${timestamp}${random}`;
};

/**
 * @route   GET /api/orders/purchase
 * @desc    获取采购订单列表 (支持按状态筛选，默认 OPEN)
 */
router.get("/purchase", async (req, res) => {
  const { status } = req.query;
  // 默认只查 OPEN 的订单用于入库引用
  const targetStatus = status || "OPEN";

  try {
    // 1. 查主表
    const [orders] = await db.query(
      `
            SELECT po.*, p.legal_name as partner_name, c.symbol as currency_symbol
            FROM bus_purchase_orders po
            LEFT JOIN biz_partners p ON po.partner_ref = p.partner_id
            LEFT JOIN biz_commodities c ON po.currency_ref = c.commodity_id
            WHERE po.order_status = ?
            ORDER BY po.order_date DESC
        `,
      [targetStatus]
    );

    if (orders.length === 0) return res.json([]);

    // 2. 查明细
    const orderIds = orders.map((o) => `'${o.po_id}'`).join(",");
    const [items] = await db.query(`
            SELECT poi.*, i.item_code, i.item_name, i.unit_of_measure 
            FROM bus_po_items poi
            LEFT JOIN inv_items i ON poi.item_ref = i.item_id
            WHERE poi.po_ref IN (${orderIds})
        `);

    // 3. 组装
    const result = orders.map((order) => {
      const myItems = items
        .filter((i) => i.po_ref === order.po_id)
        .map((i) => ({
          ...i,
          // 转换回浮点数供前端使用
          unit_price:
            parseFloat(i.unit_price_num) / parseFloat(i.unit_price_denom),
          quantity: parseFloat(i.quantity),
        }));
      return {
        ...order,
        total_amount:
          parseFloat(order.total_amount_num) /
          parseFloat(order.total_amount_denom),
        items: myItems,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "获取采购订单失败", error: err.message });
  }
});

/**
 * @route   POST /api/orders/purchase
 * @desc    创建新的采购订单 (PO)
 */
router.post("/purchase", async (req, res) => {
  const {
    partner_ref,
    order_date,
    expected_delivery_date,
    currency_ref,
    items,
  } = req.body;

  if (
    !partner_ref ||
    !order_date ||
    !currency_ref ||
    !items ||
    items.length === 0
  ) {
    return res.status(400).json({ message: "订单信息不完整" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const poId = uuidv4();
    const poNumber = generateOrderNumber("PO");
    let totalAmount = 0;

    items.forEach((item) => {
      totalAmount += item.quantity * item.unit_price;
    });
    const rTotal = toRational(totalAmount);

    const poSql = `
            INSERT INTO bus_purchase_orders 
            (po_id, po_number, partner_ref, order_date, expected_delivery_date, currency_ref, total_amount_num, total_amount_denom, order_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
        `;
    await conn.query(poSql, [
      poId,
      poNumber,
      partner_ref,
      order_date,
      expected_delivery_date,
      currency_ref,
      rTotal.num,
      rTotal.denom,
    ]);

    const poItemSql = `
            INSERT INTO bus_po_items 
            (line_id, po_ref, item_ref, quantity, unit_price_num, unit_price_denom) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
    for (const item of items) {
      const rPrice = toRational(item.unit_price);
      await conn.query(poItemSql, [
        uuidv4(),
        poId,
        item.item_id,
        Math.round(item.quantity),
        rPrice.num,
        rPrice.denom,
      ]);
    }

    await conn.commit();
    res
      .status(201)
      .json({ message: `采购订单 ${poNumber} 创建成功`, poId, poNumber });
  } catch (err) {
    await conn.rollback();
    console.error("采购订单创建失败:", err);
    res.status(500).json({ message: "采购订单创建失败", error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * @route   POST /api/orders/sales
 * @desc    创建新的销售订单 (SO)
 */
router.post("/sales", async (req, res) => {
  const {
    partner_ref,
    order_date,
    expected_shipment_date,
    currency_ref,
    items,
  } = req.body;

  if (
    !partner_ref ||
    !order_date ||
    !currency_ref ||
    !items ||
    items.length === 0
  ) {
    return res.status(400).json({ message: "订单信息不完整" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const soId = uuidv4();
    const soNumber = generateOrderNumber("SO");
    let totalAmount = 0;

    items.forEach((item) => {
      totalAmount += item.quantity * item.unit_price;
    });
    const rTotal = toRational(totalAmount);

    const soSql = `
            INSERT INTO bus_sales_orders 
            (so_id, so_number, partner_ref, order_date, expected_shipment_date, currency_ref, total_amount_num, total_amount_denom, order_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
        `;
    await conn.query(soSql, [
      soId,
      soNumber,
      partner_ref,
      order_date,
      expected_shipment_date,
      currency_ref,
      rTotal.num,
      rTotal.denom,
    ]);

    const soItemSql = `
            INSERT INTO bus_so_items 
            (line_id, so_ref, item_ref, quantity, unit_price_num, unit_price_denom) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
    for (const item of items) {
      const rPrice = toRational(item.unit_price);
      await conn.query(soItemSql, [
        uuidv4(),
        soId,
        item.item_id,
        Math.round(item.quantity),
        rPrice.num,
        rPrice.denom,
      ]);
    }

    await conn.commit();
    res
      .status(201)
      .json({ message: `销售订单 ${soNumber} 创建成功`, soId, soNumber });
  } catch (err) {
    await conn.rollback();
    console.error("销售订单创建失败:", err);
    res.status(500).json({ message: "销售订单创建失败", error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

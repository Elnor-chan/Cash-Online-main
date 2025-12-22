-- ============================================================
-- 1. 数据库初始化 (Database Initialization)
-- ============================================================
DROP DATABASE IF EXISTS cash_db;
CREATE DATABASE IF NOT EXISTS cash_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cash_db;

-- ============================================================
-- 2. 表结构定义 (Table Definitions)
-- ============================================================

-- 2.1 系统用户
CREATE TABLE app_users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    login_name VARCHAR(100) NOT NULL UNIQUE,
    password_token VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    access_level VARCHAR(50) DEFAULT 'member'
);

-- 2.2 货币/商品定义
CREATE TABLE biz_commodities (
    commodity_id CHAR(36) PRIMARY KEY,
    namespace VARCHAR(50) NOT NULL, -- 'CURRENCY'
    symbol VARCHAR(20) NOT NULL,    -- 'CNY', 'USD', 'EUR'
    full_name VARCHAR(100),
    precision_val INT NOT NULL      -- 100 (2位小数)
);

-- 2.3 往来单位
CREATE TABLE biz_partners (
    partner_id CHAR(36) PRIMARY KEY,
    partner_code VARCHAR(50) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    partner_type ENUM('customer', 'vendor', 'employee') NOT NULL,
    contact_email VARCHAR(128),
    contact_phone VARCHAR(50),
    shipping_address TEXT,
    is_enabled INT DEFAULT 1
);

-- 2.4 会计科目
CREATE TABLE fin_accounts (
    account_id CHAR(36) PRIMARY KEY,
    account_code VARCHAR(50),      
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
    commodity_ref CHAR(36),        -- 该科目的计价货币
    parent_account_id CHAR(36),
    is_placeholder INT DEFAULT 0,  -- 1=仅作为父级分类，不能记账
    account_description TEXT,
    FOREIGN KEY (commodity_ref) REFERENCES biz_commodities(commodity_id)
);

-- 2.5 总账交易头 (Transaction Header)
CREATE TABLE fin_transactions (
    txn_id CHAR(36) PRIMARY KEY,
    currency_ref CHAR(36) NOT NULL, -- 交易发生时的币种
    doc_number VARCHAR(100),
    posting_date DATETIME NOT NULL,
    entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    summary TEXT,
    FOREIGN KEY (currency_ref) REFERENCES biz_commodities(commodity_id)
);

-- 2.6 凭证分录 (Journal Entries)
CREATE TABLE fin_journal_entries (
    entry_id CHAR(36) PRIMARY KEY,
    txn_ref CHAR(36) NOT NULL,
    account_ref CHAR(36) NOT NULL,
    memo TEXT,
    val_num BIGINT NOT NULL,       -- 分子 (金额)
    val_denom BIGINT NOT NULL,     -- 分母 (精度)
    qty_num BIGINT NOT NULL,       -- 分子 (数量/原币金额)
    qty_denom BIGINT NOT NULL,     -- 分母
    FOREIGN KEY (txn_ref) REFERENCES fin_transactions(txn_id),
    FOREIGN KEY (account_ref) REFERENCES fin_accounts(account_id)
);

-- 2.7 物料主数据
CREATE TABLE inv_items (
    item_id CHAR(36) PRIMARY KEY,
    item_code VARCHAR(50) NOT NULL UNIQUE,
    item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL, 
    costing_method ENUM('FIFO', 'AVERAGE') NOT NULL DEFAULT 'AVERAGE',
    
    -- 库存价值快照 (始终以本位币 CNY 存储)
    qty_on_hand BIGINT DEFAULT 0,
    avg_cost_num BIGINT DEFAULT 0,
    avg_cost_denom BIGINT DEFAULT 100,

    is_active INT DEFAULT 1,
    inventory_account_ref CHAR(36), -- 资产-库存
    cogs_account_ref CHAR(36),      -- 费用-成本
    sales_account_ref CHAR(36),     -- 收入-销售
    FOREIGN KEY (inventory_account_ref) REFERENCES fin_accounts(account_id),
    FOREIGN KEY (cogs_account_ref) REFERENCES fin_accounts(account_id),
    FOREIGN KEY (sales_account_ref) REFERENCES fin_accounts(account_id)
);

-- 2.8 库存移动记录
CREATE TABLE inv_movements (
    move_id CHAR(36) PRIMARY KEY,
    item_ref CHAR(36) NOT NULL,
    move_type ENUM('IN', 'OUT', 'ADJUST') NOT NULL,
    quantity BIGINT NOT NULL,
    unit_cost_num BIGINT NOT NULL,
    unit_cost_denom BIGINT NOT NULL,
    move_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    related_txn_ref CHAR(36),
    FOREIGN KEY (item_ref) REFERENCES inv_items(item_id),
    FOREIGN KEY (related_txn_ref) REFERENCES fin_transactions(txn_id)
);

-- 2.9 采购订单 (PO)
CREATE TABLE bus_purchase_orders (
    po_id CHAR(36) PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    partner_ref CHAR(36) NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    currency_ref CHAR(36) NOT NULL,
    total_amount_num BIGINT NOT NULL,
    total_amount_denom BIGINT NOT NULL,
    order_status ENUM('DRAFT', 'OPEN', 'CLOSED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_ref) REFERENCES biz_partners(partner_id),
    FOREIGN KEY (currency_ref) REFERENCES biz_commodities(commodity_id)
);

-- 2.10 采购订单明细
CREATE TABLE bus_po_items (
    line_id CHAR(36) PRIMARY KEY,
    po_ref CHAR(36) NOT NULL,
    item_ref CHAR(36) NOT NULL,
    quantity BIGINT NOT NULL,
    unit_price_num BIGINT NOT NULL,
    unit_price_denom BIGINT NOT NULL,
    FOREIGN KEY (po_ref) REFERENCES bus_purchase_orders(po_id),
    FOREIGN KEY (item_ref) REFERENCES inv_items(item_id)
);

-- 2.11 销售订单 (SO)
CREATE TABLE bus_sales_orders (
    so_id CHAR(36) PRIMARY KEY,
    so_number VARCHAR(50) NOT NULL UNIQUE,
    partner_ref CHAR(36) NOT NULL,
    order_date DATE NOT NULL,
    expected_shipment_date DATE,
    currency_ref CHAR(36) NOT NULL,
    total_amount_num BIGINT NOT NULL,
    total_amount_denom BIGINT NOT NULL,
    order_status ENUM('DRAFT', 'OPEN', 'CLOSED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_ref) REFERENCES biz_partners(partner_id),
    FOREIGN KEY (currency_ref) REFERENCES biz_commodities(commodity_id)
);

-- 2.12 销售订单明细
CREATE TABLE bus_so_items (
    line_id CHAR(36) PRIMARY KEY,
    so_ref CHAR(36) NOT NULL,
    item_ref CHAR(36) NOT NULL,
    quantity BIGINT NOT NULL,
    unit_price_num BIGINT NOT NULL,
    unit_price_denom BIGINT NOT NULL,
    FOREIGN KEY (so_ref) REFERENCES bus_sales_orders(so_id),
    FOREIGN KEY (item_ref) REFERENCES inv_items(item_id)
);

-- 2.13 汇率表 (新增)
CREATE TABLE biz_exchange_rates (
    rate_id INT PRIMARY KEY AUTO_INCREMENT,
    from_currency CHAR(36) NOT NULL,
    to_currency CHAR(36) NOT NULL,
    rate DECIMAL(10, 4) NOT NULL, -- 汇率：1单位外币 = x单位目标币
    FOREIGN KEY (from_currency) REFERENCES biz_commodities(commodity_id),
    FOREIGN KEY (to_currency) REFERENCES biz_commodities(commodity_id)
);

-- ============================================================
-- 3. 数据预制 (Data Seeding)
-- ============================================================

-- 3.1 用户 (密码: 123456)
INSERT INTO app_users (login_name, password_token, display_name, access_level) 
VALUES ('admin', '$2a$10$X7.G.6.G.6.G.6.G.6.G.6.e.e.e.e.e.e.e.e.e.e.e.e.e.e', '系统管理员', 'admin');

-- 3.2 货币定义
INSERT INTO biz_commodities (commodity_id, namespace, symbol, full_name, precision_val) VALUES 
('d9b75249-1667-4279-8800-98586f4a3674', 'CURRENCY', 'CNY', '人民币', 100),
('6c1a1f7d-74d7-463d-883a-8673a812b1d3', 'CURRENCY', 'USD', '美元', 100),
('7f9e8d6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a', 'CURRENCY', 'EUR', '欧元', 100);

-- 3.3 往来单位
INSERT INTO biz_partners (partner_id, partner_code, legal_name, partner_type, contact_email) VALUES 
-- 供应商
('partner-ven-cn', 'V-CN-01', '联想电子 (CN)', 'VENDOR', 'sales@lenovo.cn'),
('partner-ven-us', 'V-US-01', 'Apple Inc. (US)', 'VENDOR', 'supply@apple.com'),
('partner-ven-eu', 'V-EU-01', 'Siemens AG (EU)', 'VENDOR', 'contact@siemens.de'),
-- 客户
('partner-cus-cn', 'C-CN-01', '字节跳动 (CN)', 'CUSTOMER', 'buy@bytedance.com'),
('partner-cus-us', 'C-US-01', 'Walmart Inc. (US)', 'CUSTOMER', 'procurement@walmart.com');

-- 3.4 会计科目 (Chart of Accounts)

-- [CNY] 资产类
INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, is_placeholder, account_description) VALUES 
('acc-asset-root',  '1000', '资产总类', 'ASSET', 'd9b75249-1667-4279-8800-98586f4a3674', 1, '资产根节点'),
('acc-cash-cny',    '1001', '库存现金 (CNY)', 'ASSET', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '人民币现金'),
('acc-bank-cny',    '1002', '银行存款 (CNY)', 'ASSET', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '工行基本户'),
('acc-ar-cny',      '1122', '应收账款 (CNY)', 'ASSET', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '国内客户欠款'),
('acc-inventory',   '1405', '库存商品', 'ASSET', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '仓库货物价值 (本位币计价)');

-- [CNY] 负债类
INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, is_placeholder, account_description) VALUES 
('acc-liab-root',   '2000', '负债总类', 'LIABILITY', 'd9b75249-1667-4279-8800-98586f4a3674', 1, '负债根节点'),
('acc-ap-cny',      '2202', '应付账款 (CNY)', 'LIABILITY', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '欠国内供应商款');

-- [CNY] 权益类
INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, is_placeholder, account_description) VALUES 
('acc-equity-root', '4000', '所有者权益', 'EQUITY', 'd9b75249-1667-4279-8800-98586f4a3674', 1, '权益根节点'),
('acc-capital',     '4001', '实收资本', 'EQUITY', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '初始投资');

-- [CNY] 损益类 (收入/费用)
INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, is_placeholder, account_description) VALUES 
('acc-inc-root',    '6000', '收入总类', 'INCOME', 'd9b75249-1667-4279-8800-98586f4a3674', 1, '收入根节点'),
('acc-revenue',     '6001', '主营业务收入', 'INCOME', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '商品销售收入'),
('acc-exp-root',    '6400', '费用总类', 'EXPENSE', 'd9b75249-1667-4279-8800-98586f4a3674', 1, '费用根节点'),
('acc-cogs',        '6401', '主营业务成本', 'EXPENSE', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '销货成本 (COGS)'),
('acc-expense',     '6602', '管理费用', 'EXPENSE', 'd9b75249-1667-4279-8800-98586f4a3674', 0, '日常办公开销');

-- ==========================================
-- [USD] 美元科目 (用于外币业务测试)
-- ==========================================
INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, is_placeholder, account_description) VALUES 
('acc-bank-usd',    '1002-USD', '花旗银行 (USD)', 'ASSET',     '6c1a1f7d-74d7-463d-883a-8673a812b1d3', 0, '美元结算账户'),
('acc-ar-usd',      '1122-USD', '应收账款 (USD)', 'ASSET',     '6c1a1f7d-74d7-463d-883a-8673a812b1d3', 0, '美国客户欠款'),
('acc-ap-usd',      '2202-USD', '应付账款 (USD)', 'LIABILITY', '6c1a1f7d-74d7-463d-883a-8673a812b1d3', 0, '欠美国供应商款');

-- ==========================================
-- [EUR] 欧元科目 (用于外币业务测试)
-- ==========================================
INSERT INTO fin_accounts (account_id, account_code, title, category, commodity_ref, is_placeholder, account_description) VALUES 
('acc-bank-eur',    '1002-EUR', '德意志银行 (EUR)', 'ASSET',     '7f9e8d6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a', 0, '欧元结算账户'),
('acc-ar-eur',      '1122-EUR', '应收账款 (EUR)',   'ASSET',     '7f9e8d6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a', 0, '欧洲客户欠款'),
('acc-ap-eur',      '2202-EUR', '应付账款 (EUR)',   'LIABILITY', '7f9e8d6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a', 0, '欠欧洲供应商款');

-- 3.5 物料主数据
INSERT INTO inv_items (item_id, item_code, item_name, unit_of_measure, costing_method, inventory_account_ref, cogs_account_ref, sales_account_ref) VALUES 
('item-001', 'PROD-MAC', 'MacBook Pro M3', '台', 'AVERAGE', 'acc-inventory', 'acc-cogs', 'acc-revenue'),
('item-002', 'PROD-PHONE', 'iPhone 15', '部', 'AVERAGE', 'acc-inventory', 'acc-cogs', 'acc-revenue'),
('item-003', 'raw-steel', '不锈钢板', 'KG', 'FIFO', 'acc-inventory', 'acc-cogs', 'acc-revenue');

-- 3.6 预置汇率数据 (硬编码)
-- 假设本位币是 CNY (ID: d9b75249-1667-4279-8800-98586f4a3674)
INSERT INTO biz_exchange_rates (from_currency, to_currency, rate) VALUES 
('d9b75249-1667-4279-8800-98586f4a3674', 'd9b75249-1667-4279-8800-98586f4a3674', 1.0000), -- CNY -> CNY
('6c1a1f7d-74d7-463d-883a-8673a812b1d3', 'd9b75249-1667-4279-8800-98586f4a3674', 7.2500), -- USD -> CNY
('7f9e8d6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a', 'd9b75249-1667-4279-8800-98586f4a3674', 7.8500); -- EUR -> CNY
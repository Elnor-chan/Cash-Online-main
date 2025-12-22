<template>
    <div class="dashboard-container">
        <el-row :gutter="20" class="mb-20">
            <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                    <template #header>
                        <div class="card-header">
                            <span>待处理采购</span>
                            <el-tag type="warning">OPEN</el-tag>
                        </div>
                    </template>
                    <div class="stat-value">{{ pendingPO.length }} <span class="stat-unit">笔</span></div>
                    <div class="stat-desc">等待入库的订单</div>
                </el-card>
            </el-col>
            <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                    <template #header>
                        <div class="card-header">
                            <span>库存物料</span>
                            <el-icon>
                                <Goods />
                            </el-icon>
                        </div>
                    </template>
                    <div class="stat-value">{{ inventoryCount }} <span class="stat-unit">种</span></div>
                    <div class="stat-desc">当前系统录入物料总数</div>
                </el-card>
            </el-col>
            <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                    <template #header>
                        <div class="card-header">
                            <span>近期凭证</span>
                            <el-icon>
                                <List />
                            </el-icon>
                        </div>
                    </template>
                    <div class="stat-value">{{ recentTransactions.length }} <span class="stat-unit">笔</span></div>
                    <div class="stat-desc">最近 50 笔财务记录</div>
                </el-card>
            </el-col>
            <el-col :span="6">
                <el-card shadow="hover" class="action-card">
                    <div class="quick-actions">
                        <h4>快捷操作</h4>
                        <div class="action-buttons">
                            <el-button type="primary" icon="EditPen" circle @click="$router.push('/voucher')"
                                title="录入凭证" />
                            <el-button type="success" icon="ShoppingCart" circle
                                @click="$router.push('/purchase-order')" title="新建采购" />
                            <el-button type="warning" icon="Sell" circle @click="$router.push('/sales-order')"
                                title="新建销售" />
                        </div>
                    </div>
                </el-card>
            </el-col>
        </el-row>

        <el-row :gutter="20">
            <el-col :span="16">
                <el-card shadow="never" class="list-card">
                    <template #header>
                        <div class="card-header">
                            <span style="font-weight: bold;">近期财务流水</span>
                            <el-button text @click="$router.push('/transactions')">查看全部</el-button>
                        </div>
                    </template>
                    <el-table :data="recentTransactions.slice(0, 6)" stripe style="width: 100%">
                        <el-table-column prop="posting_date" label="日期" width="120">
                            <template #default="scope">
                                {{ formatDate(scope.row.posting_date) }}
                            </template>
                        </el-table-column>
                        <el-table-column prop="summary" label="摘要" show-overflow-tooltip />
                        <el-table-column prop="total_amount" label="金额" align="right" width="150">
                            <template #default="scope">
                                <span style="font-weight: bold;">{{ scope.row.total_amount }}</span>
                                <small style="margin-left:4px; color:#999">{{ scope.row.currency }}</small>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-card>
            </el-col>

            <el-col :span="8">
                <el-card shadow="never" class="list-card mb-20">
                    <template #header>
                        <div class="card-header">
                            <span style="font-weight: bold;">待入库采购订单</span>
                        </div>
                    </template>
                    <el-table :data="pendingPO.slice(0, 5)" style="width: 100%" :show-header="false">
                        <el-table-column>
                            <template #default="scope">
                                <div class="po-item">
                                    <div class="po-main">
                                        <span class="po-no">{{ scope.row.po_number }}</span>
                                        <span class="po-partner">{{ scope.row.partner_name }}</span>
                                    </div>
                                    <div class="po-sub">
                                        <span>{{ formatDate(scope.row.order_date) }}</span>
                                        <span class="po-amount">{{ formatMoney(scope.row.total_amount) }} {{
                                            scope.row.currency_symbol }}</span>
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                        <template #empty>
                            <el-empty description="暂无待处理订单" image-size="60" />
                        </template>
                    </el-table>
                </el-card>

                <el-card shadow="never" class="list-card">
                    <template #header>
                        <div class="card-header">
                            <span style="font-weight: bold;">低库存预警</span>
                            <el-tag type="danger" effect="plain" size="small">库存 < 10</el-tag>
                        </div>
                    </template>
                    <el-table :data="lowStockItems" style="width: 100%" size="small">
                        <el-table-column prop="item_name" label="物料名称" />
                        <el-table-column prop="qty_on_hand" label="库存" width="80" align="center">
                            <template #default="scope">
                                <span style="color: #f56c6c; font-weight: bold;">{{ scope.row.qty_on_hand }}</span>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { Goods, List, EditPen, ShoppingCart, Sell } from '@element-plus/icons-vue';

const recentTransactions = ref([]);
const pendingPO = ref([]);
const inventoryItems = ref([]);

// 简单的日期格式化
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
};

const formatMoney = (val) => {
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
};

// 计算低库存物品 (假设数量小于 10 为低库存)
const lowStockItems = computed(() => {
    return inventoryItems.value
        .filter(item => Number(item.qty_on_hand) < 10)
        .slice(0, 5);
});

const inventoryCount = computed(() => inventoryItems.value.length);

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const fetchData = async () => {
    try {
        // 1. 获取近期凭证
        const txnRes = await api.get('/transactions');
        recentTransactions.value = txnRes.data;

        // 2. 获取待处理采购订单 (OPEN状态)
        const poRes = await api.get('/orders/purchase?status=OPEN');
        pendingPO.value = poRes.data;

        // 3. 获取物料列表用于统计
        const invRes = await api.get('/inventory/items');
        inventoryItems.value = invRes.data;

    } catch (err) {
        console.error("Dashboard data fetch error:", err);
    }
};

onMounted(() => {
    fetchData();
});
</script>

<style scoped>
.dashboard-container {
    padding: 20px;
}

.mb-20 {
    margin-bottom: 20px;
}

.stat-card {
    height: 140px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.action-card {
    height: 140px;
    background-color: #f0f9eb;
    border: 1px solid #e1f3d8;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.stat-value {
    font-size: 28px;
    font-weight: bold;
    color: #303133;
    margin-top: 10px;
}

.stat-unit {
    font-size: 14px;
    color: #909399;
    font-weight: normal;
}

.stat-desc {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
}

.quick-actions h4 {
    margin: 0 0 15px 0;
    color: #67c23a;
}

.action-buttons {
    display: flex;
    gap: 15px;
}

.po-item {
    display: flex;
    flex-direction: column;
    padding: 5px 0;
}

.po-main {
    display: flex;
    justify-content: space-between;
    font-weight: 500;
    margin-bottom: 4px;
}

.po-sub {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #909399;
}

.po-no {
    color: #409eff;
}
</style>
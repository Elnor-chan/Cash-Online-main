<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <el-radio-group v-model="reportType" size="small">
                        <el-radio-button label="TRIAL">{{ $t('reports.trial_balance') }}</el-radio-button>
                        <el-radio-button label="BALANCE_SHEET">{{ $t('reports.balance_sheet') }}</el-radio-button>
                    </el-radio-group>
                    <el-button type="success" :icon="Refresh" @click="fetchReport">{{ $t('common.refresh')
                        }}</el-button>
                </div>
            </template>

            <el-table v-if="reportType === 'TRIAL'" :data="tableData" row-key="account_id" border default-expand-all
                :tree-props="{ children: 'children' }" v-loading="loading">
                <el-table-column prop="title" :label="$t('reports.account')" min-width="200" />
                <el-table-column prop="category" :label="$t('reports.category')" width="100" />
                <el-table-column :label="$t('reports.debit')" align="right" width="220">
                    <template #default="scope">
                        <div v-for="bal in scope.row.balances" :key="bal.currency_id" class="currency-row">
                            {{ formatMoney(bal.debit) }} <small>{{ bal.symbol }}</small>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column :label="$t('reports.credit')" align="right" width="220">
                    <template #default="scope">
                        <div v-for="bal in scope.row.balances" :key="bal.currency_id" class="currency-row">
                            {{ formatMoney(bal.credit) }} <small>{{ bal.symbol }}</small>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column :label="$t('reports.net')" align="right" width="220">
                    <template #default="scope">
                        <div v-for="bal in scope.row.balances" :key="bal.currency_id" class="currency-row">
                            <span :style="{ color: bal.net >= 0 ? '#333' : '#f56c6c' }">
                                {{ formatMoney(bal.net) }}
                            </span> <small>{{ bal.symbol }}</small>
                        </div>
                    </template>
                </el-table-column>
            </el-table>

            <div v-else v-loading="loading">
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-card shadow="never" class="bs-card">
                            <template #header><strong>{{ $t('reports.asset') }}</strong></template>
                            <BalanceSheetTree :data="assetsTree" />
                            <div class="bs-total">Total: <span v-html="formatMultiCurrency(assetsTotal)"></span></div>
                        </el-card>
                    </el-col>
                    <el-col :span="12">
                        <el-card shadow="never" class="bs-card">
                            <template #header><strong>{{ $t('reports.liability') }}</strong></template>
                            <BalanceSheetTree :data="liabilitiesTree" />
                            <div class="bs-total">Total: <span v-html="formatMultiCurrency(liabilitiesTotal)"></span>
                            </div>
                        </el-card>
                        <el-card shadow="never" class="bs-card" style="margin-top:20px;">
                            <template #header><strong>{{ $t('reports.equity') }}</strong></template>
                            <BalanceSheetTree :data="equityTree" />
                            <div class="bs-total">Total: <span v-html="formatMultiCurrency(equityTotal)"></span></div>
                        </el-card>
                    </el-col>
                </el-row>
            </div>
        </el-card>
    </div>
</template>

<script setup>
import { ref, onMounted, h } from 'vue';
import axios from 'axios';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const reportType = ref('TRIAL');
const tableData = ref([]);

const assetsTree = ref([]);
const liabilitiesTree = ref([]);
const equityTree = ref([]);
const assetsTotal = ref({});
const liabilitiesTotal = ref({});
const equityTotal = ref({});

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const formatMoney = (val) => val ? val.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';

// 格式化多币种总计对象: {CNY: 100, USD: 20}
const formatMultiCurrency = (totals) => {
    if (!totals || Object.keys(totals).length === 0) return '0.00';
    return Object.entries(totals).map(([sym, val]) =>
        `<span>${formatMoney(val)}</span> <small>${sym}</small>`
    ).join('<br>');
};

// 递归组件：渲染简单的树
const BalanceSheetTree = (props) => {
    const renderNode = (nodes) => nodes.map(node => h('div', { style: 'margin-left:20px;line-height:24px' }, [
        h('div', { style: 'display:flex;justify-content:space-between' }, [
            h('span', node.title),
            h('span', { innerHTML: formatMultiCurrency(node.totalBalances) })
        ]),
        node.children ? renderNode(node.children) : null
    ]));
    return h('div', renderNode(props.data));
};

// 递归计算多币种汇总
const calculateTotals = (nodes) => {
    const totals = {};
    nodes.forEach(node => {
        if (!node.totalBalances) node.totalBalances = {};
        // 累加自身余额
        node.balances.forEach(b => {
            node.totalBalances[b.symbol] = (node.totalBalances[b.symbol] || 0) + b.net;
        });
        // 递归累加子节点
        if (node.children) {
            const childTotals = calculateTotals(node.children);
            for (const [sym, val] of Object.entries(childTotals)) {
                node.totalBalances[sym] = (node.totalBalances[sym] || 0) + val;
            }
        }
        // 累加到本层级总计
        for (const [sym, val] of Object.entries(node.totalBalances)) {
            totals[sym] = (totals[sym] || 0) + val;
        }
    });
    return totals;
};

const handleTree = (data) => {
    const items = JSON.parse(JSON.stringify(data));
    const map = {};
    items.forEach(i => map[i.account_id] = { ...i, children: [] });
    const tree = [];
    items.forEach(i => {
        if (i.parent_account_id && map[i.parent_account_id]) map[i.parent_account_id].children.push(map[i.account_id]);
        else tree.push(map[i.account_id]);
    });
    return tree;
};

const fetchReport = async () => {
    loading.value = true;
    try {
        const res = await api.get('/reports/trial-balance');
        const tree = handleTree(res.data);
        calculateTotals(tree);
        tableData.value = tree;

        // 分类构建资产负债表
        const filterCat = (cat) => tree.filter(n => n.category === cat);
        assetsTree.value = filterCat('ASSET');
        liabilitiesTree.value = filterCat('LIABILITY');
        equityTree.value = filterCat('EQUITY');

        assetsTotal.value = calculateTotals(assetsTree.value);
        liabilitiesTotal.value = calculateTotals(liabilitiesTree.value);
        equityTotal.value = calculateTotals(equityTree.value);
    } catch (err) {
        ElMessage.error('加载失败');
    } finally {
        loading.value = false;
    }
};

onMounted(fetchReport);
</script>

<style scoped>
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.currency-row {
    border-bottom: 1px dashed #eee;
    padding: 2px 0;
    font-size: 13px;
}

.currency-row:last-child {
    border-bottom: none;
}

.bs-total {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 2px solid #eee;
    text-align: right;
    font-weight: bold;
}
</style>
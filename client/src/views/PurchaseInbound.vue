<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>采购入库单 / Purchase Inbound</span>
                    <el-button type="primary" :loading="loading" @click="submitInbound">
                        确认入库并生成凭证
                    </el-button>
                </div>
            </template>

            <el-form :inline="true" label-width="80px">
                <el-form-item label="入库日期">
                    <el-date-picker v-model="form.inbound_date" type="date" placeholder="选择日期" style="width: 200px" />
                </el-form-item>
                <el-form-item label="供应商">
                    <el-select v-model="form.supplier_id" placeholder="选择供应商" filterable style="width: 200px">
                        <el-option v-for="p in partners.filter(p => p.partner_type === 'vendor')" :key="p.partner_id"
                            :label="p.legal_name" :value="p.partner_id" />
                    </el-select>
                </el-form-item>
                <el-form-item label="结算科目">
                    <el-tree-select v-model="form.payment_account_id" :data="accountOptions"
                        :props="{ label: 'label', value: 'account_id', children: 'children' }" placeholder="应付/现金/银行科目"
                        filterable check-strictly style="width: 250px" />
                </el-form-item>

                <el-form-item label="币种">
                    <el-select v-model="form.currency_ref" placeholder="选择币种" style="width: 100px"
                        @change="handleCurrencyChange">
                        <el-option v-for="c in currencies" :key="c.commodity_id" :label="c.symbol"
                            :value="c.commodity_id" />
                    </el-select>
                </el-form-item>

                <el-form-item label="汇率(本位币)">
                    <el-input-number v-model="form.exchange_rate" :precision="4" :step="0.0001" :min="0"
                        style="width: 140px" controls-position="right" :disabled="form.currency_symbol === 'CNY'"
                        placeholder="对CNY汇率" />
                </el-form-item>
            </el-form>

            <el-divider content-position="left">入库明细 (原币种计价)</el-divider>

            <el-table :data="form.line_items" border style="width: 100%" size="small">
                <el-table-column label="物料" min-width="200">
                    <template #default="scope">
                        <el-select v-model="scope.row.item_id" placeholder="选择物料" filterable style="width: 100%">
                            <el-option v-for="i in items" :key="i.item_id" :label="`${i.item_code} - ${i.item_name}`"
                                :value="i.item_id" />
                        </el-select>
                    </template>
                </el-table-column>

                <el-table-column :label="`单位成本 (${form.currency_symbol})`" width="150">
                    <template #default="scope">
                        <el-input-number v-model="scope.row.unit_cost" :min="0" :precision="2" :controls="false"
                            style="width: 100%" />
                    </template>
                </el-table-column>

                <el-table-column label="数量" width="120">
                    <template #default="scope">
                        <el-input-number v-model="scope.row.quantity" :min="1" :precision="0" :controls="false"
                            style="width: 100%" />
                    </template>
                </el-table-column>

                <el-table-column label="小计 (原币)" width="150" align="right">
                    <template #default="scope">
                        {{ (scope.row.unit_cost * scope.row.quantity || 0).toFixed(2) }}
                    </template>
                </el-table-column>

                <el-table-column label="小计 (CNY估算)" width="150" align="right">
                    <template #default="scope">
                        <span style="color: #909399;">
                            {{ (scope.row.unit_cost * scope.row.quantity * form.exchange_rate || 0).toFixed(2) }}
                        </span>
                    </template>
                </el-table-column>

                <el-table-column label="操作" width="80" align="center">
                    <template #default="scope">
                        <el-button link type="danger" :icon="Delete" @click="removeItem(scope.$index)" />
                    </template>
                </el-table-column>
            </el-table>

            <div class="footer-bar">
                <el-button link type="primary" :icon="Plus" @click="addItem">添加明细行</el-button>

                <div class="totals">
                    <span class="total-item">总金额:
                        <strong style="font-size: 16px;">{{ totalCost.toFixed(2) }}</strong>
                        {{ form.currency_symbol }}
                    </span>
                </div>
            </div>

        </el-card>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const loading = ref(false);
const partners = ref([]);
const items = ref([]);
const accountOptions = ref([]);
const currencies = ref([]);
const exchangeRates = ref([]);

const form = reactive({
    inbound_date: dayjs().toDate(),
    supplier_id: null,
    payment_account_id: null,
    memo: '',
    currency_ref: '',
    currency_symbol: '',
    exchange_rate: 1.0,
    line_items: [
        { item_id: null, quantity: 1, unit_cost: 0 }
    ]
});

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const totalCost = computed(() => {
    return form.line_items.reduce((sum, item) => sum + (item.quantity * item.unit_cost || 0), 0);
});

const addItem = () => {
    form.line_items.push({ item_id: null, quantity: 1, unit_cost: 0 });
};

const removeItem = (index) => {
    form.line_items.splice(index, 1);
};

const handleCurrencyChange = (val) => {
    const foundCurr = currencies.value.find(c => c.commodity_id === val);
    if (foundCurr) {
        form.currency_symbol = foundCurr.symbol;
    }

    const rateEntry = exchangeRates.value.find(r => r.from_currency === val);

    if (rateEntry) {
        form.exchange_rate = parseFloat(rateEntry.rate);
    } else {
        form.exchange_rate = 1.0;
    }
};

const buildFilteredTree = (allData, allowedCategories) => {
    const filtered = allData.filter(item => allowedCategories.includes(item.category));
    const dataMap = {};
    filtered.forEach(item => {
        dataMap[item.account_id] = { ...item, children: [], label: item.account_code ? `${item.account_code} - ${item.title}` : item.title };
    });
    const tree = [];
    filtered.forEach(item => {
        if (item.parent_account_id && dataMap[item.parent_account_id]) {
            dataMap[item.parent_account_id].children.push(dataMap[item.account_id]);
        } else {
            tree.push(dataMap[item.account_id]);
        }
    });

    const clean = (nodes) => {
        nodes.forEach(node => {
            if (node.children.length === 0) node.children = null;
            else clean(node.children);
        });
    };
    clean(tree);

    const sortNodes = (nodes) => {
        nodes.sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));
        if (nodes.children) sortNodes(nodes.children);
    };
    sortNodes(tree);

    return tree;
};

const fetchData = async () => {
    try {
        const partnerRes = await api.get('/partners?type=vendor');
        partners.value = partnerRes.data;

        const itemRes = await api.get('/inventory/items');
        items.value = itemRes.data;

        const accountRes = await api.get('/accounts');
        accountOptions.value = buildFilteredTree(accountRes.data, ['ASSET', 'LIABILITY']);

        const currRes = await api.get('/commodities');
        currencies.value = currRes.data;

        const rateRes = await api.get('/exchange-rates');
        exchangeRates.value = rateRes.data;

        const defaultCurr = currencies.value.find(c => c.symbol === 'CNY');
        if (defaultCurr) {
            form.currency_ref = defaultCurr.commodity_id;
            form.currency_symbol = defaultCurr.symbol;
            handleCurrencyChange(defaultCurr.commodity_id);
        }

    } catch (error) {
        ElMessage.error('基础数据加载失败: ' + (error.response?.data?.message || error.message));
    }
}

const submitInbound = async () => {
    if (!form.supplier_id || !form.payment_account_id || totalCost.value <= 0) {
        ElMessage.warning('请填写供应商、结算科目和入库明细');
        return;
    }

    const payload = {
        supplier_id: form.supplier_id,
        inbound_date: dayjs(form.inbound_date).format('YYYY-MM-DD HH:mm:ss'),
        payment_account_id: form.payment_account_id,
        memo: form.memo,
        currency_ref: form.currency_ref,
        exchange_rate: form.exchange_rate,
        line_items: form.line_items
            .filter(item => item.item_id && item.quantity > 0 && item.unit_cost >= 0)
    };

    if (payload.line_items.length === 0) {
        ElMessage.warning('入库明细行不能为空或金额为零');
        return;
    }

    loading.value = true;
    try {
        const res = await api.post('/inventory/inbound', payload);
        ElMessage.success(`入库成功！总成本(原币): ${res.data.totalCost}`);

        const defaultCurr = currencies.value.find(c => c.symbol === 'CNY');
        Object.assign(form, {
            inbound_date: dayjs().toDate(),
            supplier_id: null,
            payment_account_id: null,
            memo: '',
            currency_ref: defaultCurr ? defaultCurr.commodity_id : '',
            currency_symbol: defaultCurr ? defaultCurr.symbol : '',
            exchange_rate: 1.0,
            line_items: [{ item_id: null, quantity: 1, unit_cost: 0 }]
        });
        if (defaultCurr) handleCurrencyChange(defaultCurr.commodity_id);

    } catch (error) {
        ElMessage.error('入库失败: ' + (error.response?.data?.message || error.message));
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchData();
});
</script>

<style scoped>
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.footer-bar {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #f8f9fa;
    border: 1px solid #ebeef5;
}

.totals {
    font-size: 14px;
}

.total-item {
    margin-left: 20px;
}
</style>
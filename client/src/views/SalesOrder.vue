<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>创建销售订单 (SO)</span>
                    <el-button type="primary" :loading="loading" @click="submitOrder">
                        提交销售订单
                    </el-button>
                </div>
            </template>

            <el-form :inline="true" label-width="100px">
                <el-form-item label="订单日期">
                    <el-date-picker v-model="form.order_date" type="date" placeholder="选择日期" style="width: 180px" />
                </el-form-item>
                <el-form-item label="预计发货">
                    <el-date-picker v-model="form.expected_shipment_date" type="date" placeholder="选择日期"
                        style="width: 180px" />
                </el-form-item>
                <el-form-item label="客户">
                    <el-select v-model="form.partner_ref" placeholder="选择客户" filterable style="width: 200px">
                        <el-option v-for="p in partners" :key="p.partner_id" :label="p.legal_name"
                            :value="p.partner_id" />
                    </el-select>
                </el-form-item>
                <el-form-item label="币种">
                    <el-select v-model="form.currency_ref" placeholder="选择币种" style="width: 120px"
                        @change="handleCurrencyChange">
                        <el-option v-for="c in currencies" :key="c.commodity_id" :label="c.symbol"
                            :value="c.commodity_id" />
                    </el-select>
                </el-form-item>
            </el-form>

            <el-divider content-position="left">订单明细</el-divider>

            <el-table :data="form.items" border style="width: 100%" size="small">

                <el-table-column label="物料" min-width="200">
                    <template #default="scope">
                        <el-select v-model="scope.row.item_id" placeholder="选择物料" filterable style="width: 100%">
                            <el-option v-for="i in items" :key="i.item_id" :label="`${i.item_code} - ${i.item_name}`"
                                :value="i.item_id" />
                        </el-select>
                    </template>
                </el-table-column>

                <el-table-column label="销售单价" width="120">
                    <template #default="scope">
                        <el-input-number v-model="scope.row.unit_price" :min="0" :precision="2" :controls="false"
                            style="width: 100%" />
                    </template>
                </el-table-column>

                <el-table-column label="数量" width="120">
                    <template #default="scope">
                        <el-input-number v-model="scope.row.quantity" :min="1" :precision="0" :controls="false"
                            style="width: 100%" />
                    </template>
                </el-table-column>

                <el-table-column label="行总金额" width="150" align="right">
                    <template #default="scope">
                        {{ (scope.row.unit_price * scope.row.quantity || 0).toFixed(2) }}
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
                    <span class="total-item">订单总金额:
                        <strong style="font-size: 16px;">{{ totalAmount.toFixed(2) }}</strong>
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
const currencies = ref([]);

const form = reactive({
    order_date: dayjs().toDate(),
    expected_shipment_date: dayjs().add(7, 'day').toDate(),
    partner_ref: null,
    currency_ref: '',
    currency_symbol: '',
    items: [
        { item_id: null, quantity: 1, unit_price: 0 }
    ]
});

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const totalAmount = computed(() => {
    return form.items.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0);
});

const addItem = () => {
    form.items.push({ item_id: null, quantity: 1, unit_price: 0 });
};

const removeItem = (index) => {
    form.items.splice(index, 1);
};

const handleCurrencyChange = (val) => {
    const found = currencies.value.find(c => c.commodity_id === val);
    if (found) {
        form.currency_symbol = found.symbol;
    }
};

const fetchData = async () => {
    try {
        const partnerRes = await api.get('/partners?type=customer');
        partners.value = partnerRes.data;

        const itemRes = await api.get('/inventory/items');
        items.value = itemRes.data;

        const currRes = await api.get('/commodities');
        currencies.value = currRes.data;

        const defaultCurr = currencies.value.find(c => c.symbol === 'CNY');
        if (defaultCurr) {
            form.currency_ref = defaultCurr.commodity_id;
            form.currency_symbol = defaultCurr.symbol;
        }

    } catch (error) {
        ElMessage.error('基础数据加载失败: ' + (error.response?.data?.message || error.message));
    }
}

const submitOrder = async () => {
    if (!form.partner_ref || totalAmount.value <= 0) {
        ElMessage.warning('请选择客户并填写订单明细');
        return;
    }

    const payload = {
        partner_ref: form.partner_ref,
        order_date: dayjs(form.order_date).format('YYYY-MM-DD'),
        expected_shipment_date: dayjs(form.expected_shipment_date).format('YYYY-MM-DD'),
        currency_ref: form.currency_ref,
        items: form.items
            .filter(item => item.item_id && item.quantity > 0 && item.unit_price >= 0)
    };

    if (payload.items.length === 0) {
        ElMessage.warning('订单明细行不能为空或金额为零');
        return;
    }

    loading.value = true;
    try {
        const res = await api.post('/orders/sales', payload);
        ElMessage.success(`订单创建成功! SO号: ${res.data.soNumber}`);

        const defaultCurr = currencies.value.find(c => c.symbol === 'CNY');
        Object.assign(form, {
            order_date: dayjs().toDate(),
            expected_shipment_date: dayjs().add(7, 'day').toDate(),
            partner_ref: null,
            currency_ref: defaultCurr ? defaultCurr.commodity_id : '',
            currency_symbol: defaultCurr ? defaultCurr.symbol : '',
            items: [{ item_id: null, quantity: 1, unit_price: 0 }]
        });

    } catch (error) {
        ElMessage.error('创建订单失败: ' + (error.response?.data?.message || error.message));
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
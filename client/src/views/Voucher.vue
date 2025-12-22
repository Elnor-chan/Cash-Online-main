<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>录入记账凭证 / Journal Entry</span>
                    <el-button type="primary" :disabled="!isBalanced" :loading="loading" @click="submitVoucher">
                        保存凭证
                    </el-button>
                </div>
            </template>

            <el-form :inline="true" label-width="80px">
                <el-form-item label="记账日期">
                    <el-date-picker v-model="form.posting_date" type="date" placeholder="选择日期" style="width: 200px" />
                </el-form-item>
                <el-form-item label="总摘要">
                    <el-input v-model="form.summary" placeholder="简要描述这笔业务" style="width: 400px" />
                </el-form-item>
            </el-form>

            <el-table :data="form.entries" border style="width: 100%" size="small">
                <el-table-column label="会计科目" min-width="200">
                    <template #default="scope">
                        <el-tree-select v-model="scope.row.account_id" :data="accountOptions"
                            :props="{ label: 'label', value: 'account_id', children: 'children' }" placeholder="选择科目"
                            filterable check-strictly style="width: 100%" />
                    </template>
                </el-table-column>

                <el-table-column label="分录摘要" min-width="150">
                    <template #default="scope">
                        <el-input v-model="scope.row.memo" placeholder="可选" />
                    </template>
                </el-table-column>

                <el-table-column label="借方金额 (Debit)" width="180">
                    <template #default="scope">
                        <el-input-number v-model="scope.row.debit" :min="0" :precision="2" :controls="false"
                            style="width: 100%" @change="handleAmountChange(scope.row, 'DEBIT')" />
                    </template>
                </el-table-column>

                <el-table-column label="贷方金额 (Credit)" width="180">
                    <template #default="scope">
                        <el-input-number v-model="scope.row.credit" :min="0" :precision="2" :controls="false"
                            style="width: 100%" @change="handleAmountChange(scope.row, 'CREDIT')" />
                    </template>
                </el-table-column>

                <el-table-column label="操作" width="80" align="center">
                    <template #default="scope">
                        <el-button link type="danger" :icon="Delete" @click="removeEntry(scope.$index)" />
                    </template>
                </el-table-column>
            </el-table>

            <div class="footer-bar">
                <el-button link type="primary" :icon="Plus" @click="addEntry">添加分录</el-button>

                <div class="totals">
                    <span class="total-item">借方合计: <strong>{{ totals.debit.toFixed(2) }}</strong></span>
                    <span class="total-item">贷方合计: <strong>{{ totals.credit.toFixed(2) }}</strong></span>
                    <span class="total-item" :class="{ 'text-error': !isBalanced, 'text-success': isBalanced }">
                        差额: {{ (totals.debit - totals.credit).toFixed(2) }}
                        <span v-if="!isBalanced">(不平衡)</span>
                        <span v-else>(平衡)</span>
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

const loading = ref(false);
const accountOptions = ref([]);
const defaultCurrency = ref('');

const form = reactive({
    posting_date: new Date(),
    summary: '',
    entries: [
        { account_id: null, memo: '', debit: undefined, credit: undefined },
        { account_id: null, memo: '', debit: undefined, credit: undefined }
    ]
});

const api = axios.create({
    baseURL: (import.meta?.env?.VITE_API_BASE_URL) || '/api'
});
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const totals = computed(() => {
    let d = 0, c = 0;
    form.entries.forEach(row => {
        d += row.debit || 0;
        c += row.credit || 0;
    });
    return { debit: d, credit: c };
});

const isBalanced = computed(() => {
    return Math.abs(totals.value.debit - totals.value.credit) < 0.01 &&
        totals.value.debit > 0;
});

const handleAmountChange = (row, type) => {
    if (type === 'DEBIT' && row.debit > 0) row.credit = undefined;
    if (type === 'CREDIT' && row.credit > 0) row.debit = undefined;
};

const addEntry = () => {
    form.entries.push({ account_id: null, memo: '', debit: undefined, credit: undefined });
};

const removeEntry = (index) => {
    form.entries.splice(index, 1);
};

const handleTree = (data) => {
    const map = {};
    data.forEach(item => {
        map[item.account_id] = {
            ...item,
            children: [],
            // 拼接代码
            label: item.account_code ? `${item.account_code} - ${item.title}` : item.title
        };
    });

    const tree = [];
    data.forEach(item => {
        if (item.parent_account_id && map[item.parent_account_id]) {
            map[item.parent_account_id].children.push(map[item.account_id]);
        } else if (!item.parent_account_id) {
            tree.push(map[item.account_id]);
        }
    });

    const clean = (nodes) => {
        nodes.forEach(node => {
            if (!node.children || node.children.length === 0) return;
            clean(node.children);
        });
    };
    clean(tree);

    // 排序
    const sortNodes = (nodes) => {
        nodes.sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));
        nodes.forEach((node) => {
            if (node.children && node.children.length > 0) sortNodes(node.children);
        });
    };
    sortNodes(tree);

    return tree;
};

const fetchAccounts = async () => {
    try {
        const res = await api.get('/accounts');
        accountOptions.value = handleTree(res.data);

        if (res.data.length > 0) defaultCurrency.value = res.data[0].commodity_ref;
    } catch (error) {
        ElMessage.error('无法加载科目数据');
    }
};

const submitVoucher = async () => {
    if (!form.summary) {
        ElMessage.warning('请填写摘要');
        return;
    }

    const payloadEntries = form.entries
        .filter(e => e.account_id && (e.debit > 0 || e.credit > 0))
        .map(e => ({
            account_id: e.account_id,
            memo: e.memo,
            type: e.debit > 0 ? 'DEBIT' : 'CREDIT',
            amount: e.debit > 0 ? e.debit : e.credit
        }));

    if (payloadEntries.length < 2) {
        ElMessage.warning('有效分录至少需要 2 条');
        return;
    }

    loading.value = true;
    try {
        await api.post('/transactions', {
            posting_date: form.posting_date,
            summary: form.summary,
            currency_ref: defaultCurrency.value,
            entries: payloadEntries
        });
        ElMessage.success('凭证保存成功！');
        form.summary = '';
        form.entries = [
            { account_id: null, memo: '', debit: undefined, credit: undefined },
            { account_id: null, memo: '', debit: undefined, credit: undefined }
        ];
    } catch (error) {
        ElMessage.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchAccounts();
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

.text-error {
    color: #f56c6c;
    font-weight: bold;
}

.text-success {
    color: #67c23a;
}
</style>
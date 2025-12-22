<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>凭证列表 / Transaction History</span>
                    <el-button type="primary" @click="$router.push('/voucher')">新建凭证</el-button>
                </div>
            </template>

            <el-table ref="tableRef" :data="tableData" v-loading="loading" border style="width: 100%">
                <el-table-column type="expand">
                    <template #default="props">
                        <div style="padding: 10px 20px; background: #f8f9fa;">
                            <h4 style="margin: 0 0 10px 0;">分录详情 (Splits)</h4>
                            <el-table :data="props.row.entries" size="small" border>
                                <el-table-column prop="account_name" label="科目" />
                                <el-table-column prop="memo" label="摘要" />
                                <el-table-column label="借方" align="right">
                                    <template #default="scope">
                                        <span v-if="parseFloat(scope.row.amount) > 0" style="color: #67c23a">
                                            {{ scope.row.amount }}
                                        </span>
                                    </template>
                                </el-table-column>
                                <el-table-column label="贷方" align="right">
                                    <template #default="scope">
                                        <span v-if="parseFloat(scope.row.amount) < 0" style="color: #f56c6c">
                                            {{ Math.abs(scope.row.amount).toFixed(2) }}
                                        </span>
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column label="日期" width="120" sortable>
                    <template #default="scope">
                        {{ formatDate(scope.row.posting_date) }}
                    </template>
                </el-table-column>
                <el-table-column prop="summary" label="总摘要" />
                <el-table-column prop="total_amount" label="金额" width="150" align="right">
                    <template #default="scope">
                        <strong>{{ scope.row.currency }} {{ scope.row.total_amount }}</strong>
                    </template>
                </el-table-column>

                <el-table-column label="操作" width="100">
                    <template #default="scope">
                        <el-button link type="primary" size="small" @click="handleView(scope.row)">
                            查看/收起
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

const loading = ref(false);
const tableData = ref([]);
const tableRef = ref(null); // 修改3: 定义表格引用

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const fetchTransactions = async () => {
    loading.value = true;
    try {
        const res = await api.get('/transactions');
        tableData.value = res.data;
    } catch (error) {
        ElMessage.error('加载失败');
    } finally {
        loading.value = false;
    }
};

const formatDate = (dateStr) => {
    return dayjs(dateStr).format('YYYY-MM-DD');
}

// 修改4: 实现切换展开状态的函数
const handleView = (row) => {
    if (tableRef.value) {
        tableRef.value.toggleRowExpansion(row);
    }
};

onMounted(() => {
    fetchTransactions();
});
</script>

<style scoped>
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
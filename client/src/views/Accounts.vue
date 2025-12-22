<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>会计科目表 / Chart of Accounts</span>
                    <el-button type="primary" :icon="Plus" @click="openDialog(null)">新增一级科目</el-button>
                </div>
            </template>

            <el-table :data="tableData" row-key="account_id" border default-expand-all
                :tree-props="{ children: 'children' }">

                <el-table-column prop="account_code" label="科目代码" width="120" sortable />

                <el-table-column prop="title" label="科目名称" min-width="200">
                    <template #default="scope">
                        <span style="font-weight: bold;">{{ scope.row.title }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="category" label="类型" width="120" />
                <el-table-column prop="symbol" label="币种" width="80" align="center" />

                <el-table-column prop="is_placeholder" label="属性" width="100" align="center">
                    <template #default="scope">
                        <el-tag :type="scope.row.is_placeholder ? 'warning' : 'success'" size="small">
                            {{ scope.row.is_placeholder ? '父级汇总' : '记账科目' }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column prop="account_description" label="备注" show-overflow-tooltip />

                <el-table-column label="操作" width="180" align="center" fixed="right">
                    <template #default="scope">
                        <el-button link type="primary" size="small" :icon="Plus" @click="openDialog(scope.row)"
                            title="新增子科目">
                        </el-button>
                        <el-button link type="danger" size="small" :icon="Delete" @click="handleDelete(scope.row)"
                            title="删除科目">
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600" @close="resetForm">

            <el-form :model="form" ref="accountFormRef" label-width="120px">
                <el-form-item label="父级科目">
                    <el-input v-model="form.parentTitle" disabled v-if="form.parent_account_id" />
                    <span v-else class="text-gray">无 (一级科目)</span>
                </el-form-item>

                <el-form-item label="科目代码" prop="account_code">
                    <el-input v-model="form.account_code" placeholder="例如: 1001" />
                </el-form-item>

                <el-form-item label="科目名称" prop="title" required>
                    <el-input v-model="form.title" placeholder="例如: 现金" />
                </el-form-item>

                <el-form-item label="科目类型" prop="category" required>
                    <el-select v-model="form.category" placeholder="选择类型" style="width: 100%">
                        <el-option label="资产 (ASSET)" value="ASSET" />
                        <el-option label="负债 (LIABILITY)" value="LIABILITY" />
                        <el-option label="权益 (EQUITY)" value="EQUITY" />
                        <el-option label="收入 (INCOME)" value="INCOME" />
                        <el-option label="支出 (EXPENSE)" value="EXPENSE" />
                    </el-select>
                </el-form-item>

                <el-form-item label="计价币种" prop="commodity_ref" required>
                    <el-select v-model="form.commodity_ref" placeholder="选择币种" style="width: 100%">
                        <el-option v-for="c in commodities" :key="c.commodity_id" :label="c.symbol"
                            :value="c.commodity_id" />
                    </el-select>
                </el-form-item>

                <el-form-item label="是否为占位符" prop="is_placeholder">
                    <el-switch v-model="form.is_placeholder" :active-value="1" :inactive-value="0"
                        active-text="是 (仅用于汇总)" inactive-text="否 (可记账)" />
                </el-form-item>

                <el-form-item label="描述">
                    <el-input type="textarea" v-model="form.account_description" />
                </el-form-item>
            </el-form>

            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="loading" @click="submitAccount">
                    {{ dialogTitle.includes('新增') ? '创建' : '保存' }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';

// --- 状态管理 ---
const dialogVisible = ref(false);
const dialogTitle = ref('新增科目');
const loading = ref(false);
const tableData = ref([]);
const commodities = ref([]);
const accountFormRef = ref(null);

const defaultForm = {
    account_code: '', // 新增字段
    title: '',
    category: '',
    commodity_ref: '',
    parent_account_id: null,
    parentTitle: '',
    is_placeholder: 0,
    account_description: ''
};
const form = reactive({ ...defaultForm });

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// --- 数据处理函数 ---
const handleTree = (data) => {
    // 增加排序逻辑：优先按代码排序，方便查看
    data.sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));

    const dataMap = {};
    data.forEach(item => dataMap[item.account_id] = { ...item, children: [] });
    const tree = [];

    data.forEach(item => {
        if (item.parent_account_id && dataMap[item.parent_account_id]) {
            dataMap[item.parent_account_id].children.push(dataMap[item.account_id]);
        } else if (!item.parent_account_id) {
            tree.push(dataMap[item.account_id]);
        }
    });

    return tree;
};

const fetchAccounts = async () => {
    try {
        const res = await api.get('/accounts');
        tableData.value = handleTree(res.data);
    } catch (error) {
        ElMessage.error('加载科目失败: ' + error.message);
    }
};

// --- 交互逻辑 ---
const openDialog = (parentRow) => {
    resetForm();
    if (parentRow) {
        dialogTitle.value = `新增子科目`;
        form.parent_account_id = parentRow.account_id;
        form.parentTitle = parentRow.title;
        // 继承父级属性（可选优化）
        form.category = parentRow.category;
        form.commodity_ref = parentRow.commodity_ref;
    } else {
        dialogTitle.value = '新增一级科目';
        form.parent_account_id = null;
    }

    // 默认选中第一个币种
    if (!form.commodity_ref && commodities.value.length > 0) {
        form.commodity_ref = commodities.value[0].commodity_id;
    }

    dialogVisible.value = true;
};

const submitAccount = async () => {
    if (!accountFormRef.value) return;

    await accountFormRef.value.validate(async (valid) => {
        if (valid) {
            loading.value = true;
            try {
                await api.post('/accounts', form);
                ElMessage.success('科目创建成功');
                dialogVisible.value = false;
                fetchAccounts();
            } catch (error) {
                ElMessage.error('操作失败: ' + (error.response?.data?.message || error.message));
            } finally {
                loading.value = false;
            }
        }
    });
};

// 新增：删除处理逻辑
const handleDelete = (row) => {
    if (row.children && row.children.length > 0) {
        ElMessage.warning('无法删除：该科目包含子科目，请先删除子科目。');
        return;
    }

    ElMessageBox.confirm(
        `确定要删除科目 "${row.title}" (${row.account_code || '无代码'}) 吗? \n此操作将永久删除该科目，且仅在无记账记录时生效。`,
        '警告',
        {
            confirmButtonText: '确定删除',
            cancelButtonText: '取消',
            type: 'warning',
        }
    ).then(async () => {
        try {
            await api.delete(`/accounts/${row.account_id}`);
            ElMessage.success('删除成功');
            fetchAccounts();
        } catch (error) {
            ElMessage.error(error.response?.data?.message || '删除失败');
        }
    });
};

const resetForm = () => {
    Object.assign(form, defaultForm);
};

onMounted(() => {
    // 硬编码币种ID以匹配数据库 init.sql (包含新增的 EUR)
    commodities.value = [
        { commodity_id: 'd9b75249-1667-4279-8800-98586f4a3674', symbol: 'CNY' },
        { commodity_id: '6c1a1f7d-74d7-463d-883a-8673a812b1d3', symbol: 'USD' },
        { commodity_id: '7f9e8d6a-5b4c-3d2e-1f0a-9b8c7d6e5f4a', symbol: 'EUR' }
    ];
    fetchAccounts();
});
</script>

<style scoped>
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.text-gray {
    color: #909399;
}
</style>
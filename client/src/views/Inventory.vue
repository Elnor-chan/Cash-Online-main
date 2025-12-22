<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>物料主数据 / Item Master</span>
                    <el-button type="primary" :icon="Plus" @click="openDialog">新增物料</el-button>
                </div>
            </template>

            <el-table :data="tableData" v-loading="loading" border style="width: 100%">
                <el-table-column prop="item_code" label="代码" width="100" />
                <el-table-column prop="item_name" label="名称" min-width="150" />
                <el-table-column prop="unit_of_measure" label="单位" width="80" />
                <el-table-column prop="costing_method" label="成本法" width="100" />
                <el-table-column prop="inventory_account_name" label="存货科目" min-width="150" show-overflow-tooltip />
                <el-table-column prop="cogs_account_name" label="成本科目" min-width="150" show-overflow-tooltip />
                <el-table-column prop="sales_account_name" label="收入科目" min-width="150" show-overflow-tooltip />
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" title="新增物料" width="600" @close="resetForm">
            <el-form :model="form" ref="itemFormRef" label-width="120px">

                <el-form-item label="物料代码" prop="item_code" required>
                    <el-input v-model="form.item_code" />
                </el-form-item>

                <el-form-item label="物料名称" prop="item_name" required>
                    <el-input v-model="form.item_name" />
                </el-form-item>

                <el-form-item label="计量单位" prop="unit_of_measure" required>
                    <el-input v-model="form.unit_of_measure" placeholder="如 PCS/KG/L" />
                </el-form-item>

                <el-form-item label="成本核算" prop="costing_method" required>
                    <el-select v-model="form.costing_method" placeholder="选择成本法">
                        <el-option label="先进先出 (FIFO)" value="FIFO" />
                        <el-option label="加权平均 (AVERAGE)" value="AVERAGE" />
                    </el-select>
                </el-form-item>

                <el-divider>关联会计科目</el-divider>
                <el-alert title="物料变动会自动生成凭证到以下科目" type="info" :closable="false" style="margin-bottom: 20px;" />

                <el-form-item label="存货科目" prop="inventory_account_ref" required>
                    <el-tree-select v-model="form.inventory_account_ref" :data="assetOptions"
                        :props="{ label: 'label', value: 'account_id', children: 'children' }" placeholder="选择资产-存货科目"
                        filterable check-strictly />
                </el-form-item>

                <el-form-item label="成本科目" prop="cogs_account_ref" required>
                    <el-tree-select v-model="form.cogs_account_ref" :data="expenseOptions"
                        :props="{ label: 'label', value: 'account_id', children: 'children' }"
                        placeholder="选择费用-主营业务成本科目" filterable check-strictly />
                </el-form-item>

                <el-form-item label="收入科目" prop="sales_account_ref" required>
                    <el-tree-select v-model="form.sales_account_ref" :data="incomeOptions"
                        :props="{ label: 'label', value: 'account_id', children: 'children' }"
                        placeholder="选择收入-主营业务收入科目" filterable check-strictly />
                </el-form-item>

            </el-form>

            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="loading" @click="submitItem">
                    创建物料
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

// --- 状态管理 ---
const dialogVisible = ref(false);
const loading = ref(false);
const tableData = ref([]);
const itemFormRef = ref(null);

// 拆分不同类型的科目树
const assetOptions = ref([]);   // 资产类
const expenseOptions = ref([]); // 费用类
const incomeOptions = ref([]);  // 收入类

const defaultForm = {
    item_code: '',
    item_name: '',
    unit_of_measure: 'PCS',
    costing_method: 'AVERAGE',
    inventory_account_ref: null,
    cogs_account_ref: null,
    sales_account_ref: null,
};
const form = reactive({ ...defaultForm });

// --- API 配置 ---
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// --- 数据处理函数 ---

// 通用树构建函数：支持类别过滤 + 标签格式化
const buildAccountTree = (allAccounts, allowedCategories) => {
    // 1. 过滤：只保留目标类别的科目 (以及它们的父级，如果父级也在类别内的话。简单起见，按单条过滤)
    // 注意：会计科目表中父子通常同属一大类(如ASSET)，所以简单过滤category即可。
    const filtered = allAccounts.filter(acc => allowedCategories.includes(acc.category));

    // 2. 构建 Map 和 标签
    const dataMap = {};
    filtered.forEach(item => {
        dataMap[item.account_id] = {
            ...item,
            children: [],
            // 关键修改：拼接代码和名称，支持搜索
            label: item.account_code ? `${item.account_code} - ${item.title}` : item.title
        };
    });

    // 3. 组装树
    const tree = [];
    filtered.forEach(item => {
        // 如果父级也在过滤后的列表中，则挂载到父级；否则作为根节点（或者被忽略，取决于业务。这里假设父级也符合过滤条件）
        // 如果父级被过滤掉了（比如跨类别的特殊情况），该节点会成为孤立节点。
        // 为了安全，我们检查父级是否存在于 dataMap 中
        if (item.parent_account_id && dataMap[item.parent_account_id]) {
            dataMap[item.parent_account_id].children.push(dataMap[item.account_id]);
        } else {
            // 没有父级，或者父级不在当前显示的类别中，则作为顶级节点显示
            tree.push(dataMap[item.account_id]);
        }
    });

    // 4. 清理空 children
    const clean = (nodes) => {
        nodes.forEach(node => {
            if (node.children.length === 0) node.children = null;
            else clean(node.children);
        });
    };
    clean(tree);

    // 5. 排序：按代码排序
    const sortNodes = (nodes) => {
        nodes.sort((a, b) => (a.account_code || '').localeCompare(b.account_code || ''));
        if (nodes.children) sortNodes(nodes.children);
    };
    sortNodes(tree);

    return tree;
};

// 获取所有会计科目并分发
const fetchAccounts = async () => {
    try {
        const res = await api.get('/accounts');
        const allData = res.data;

        // 存货科目：仅限资产 (ASSET)
        assetOptions.value = buildAccountTree(allData, ['ASSET']);

        // 成本科目：仅限费用 (EXPENSE)
        expenseOptions.value = buildAccountTree(allData, ['EXPENSE']);

        // 收入科目：仅限收入 (INCOME)
        incomeOptions.value = buildAccountTree(allData, ['INCOME']);

    } catch (error) {
        ElMessage.error('无法加载会计科目数据');
    }
};

const fetchItems = async () => {
    loading.value = true;
    try {
        const res = await api.get('/inventory/items');
        tableData.value = res.data;
    } catch (error) {
        ElMessage.error('加载物料失败: ' + (error.response?.data?.message || error.message));
    } finally {
        loading.value = false;
    }
};

const submitItem = async () => {
    if (!itemFormRef.value) return;

    await itemFormRef.value.validate(async (valid) => {
        if (valid) {
            loading.value = true;
            try {
                await api.post('/inventory/items', form);
                ElMessage.success('物料创建成功!');
                dialogVisible.value = false;
                fetchItems();
            } catch (error) {
                ElMessage.error('操作失败: ' + (error.response?.data?.message || error.message));
            } finally {
                loading.value = false;
            }
        }
    });
};

const openDialog = () => {
    resetForm();
    dialogVisible.value = true;
};

const resetForm = () => {
    Object.assign(form, defaultForm);
};

onMounted(() => {
    fetchAccounts();
    fetchItems();
});
</script>

<style scoped>
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
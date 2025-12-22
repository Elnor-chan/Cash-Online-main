<template>
    <div class="app-container" style="padding: 20px;">
        <el-card>
            <template #header>
                <div class="header-content">
                    <span>往来单位管理 (客户/供应商)</span>
                    <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增往来单位</el-button>
                </div>
            </template>

            <el-table :data="tableData" border style="width: 100%">
                <el-table-column prop="partner_code" label="代码" width="100" />
                <el-table-column prop="legal_name" label="法定名称" min-width="180" />
                <el-table-column prop="partner_type" label="类型" width="120">
                    <template #default="scope">
                        <el-tag :type="getTypeTag(scope.row.partner_type)">
                            {{ getTypeText(scope.row.partner_type) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="contact_email" label="邮箱" width="150" />
                <el-table-column prop="contact_phone" label="电话" width="120" />
                <el-table-column prop="shipping_address" label="地址" min-width="200" show-overflow-tooltip />
                <el-table-column label="操作" width="100" fixed="right">
                    <template #default="scope">
                        <el-button link type="primary" size="small" @click="openEditDialog(scope.row)">编辑</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" :title="isEditMode ? '编辑往来单位' : '新增往来单位'" width="600" @close="resetForm">

            <el-form :model="form" ref="partnerFormRef" label-width="120px">

                <el-form-item label="单位类型" prop="partner_type" required>
                    <el-select v-model="form.partner_type" placeholder="选择类型">
                        <el-option label="客户 (Customer)" value="customer" />
                        <el-option label="供应商 (Vendor)" value="vendor" />
                    </el-select>
                </el-form-item>

                <el-form-item label="单位代码" prop="partner_code" required>
                    <el-input v-model="form.partner_code" placeholder="如 C001 或 V001" />
                </el-form-item>

                <el-form-item label="法定名称" prop="legal_name" required>
                    <el-input v-model="form.legal_name" />
                </el-form-item>

                <el-form-item label="联系邮箱" prop="contact_email">
                    <el-input v-model="form.contact_email" />
                </el-form-item>

                <el-form-item label="联系电话" prop="contact_phone">
                    <el-input v-model="form.contact_phone" />
                </el-form-item>

                <el-form-item label="默认地址" prop="shipping_address">
                    <el-input type="textarea" v-model="form.shipping_address" />
                </el-form-item>

            </el-form>

            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="loading" @click="submitPartner">
                    {{ isEditMode ? '保存修改' : '创建单位' }}
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
const partnerFormRef = ref(null);

// 新增：编辑模式状态
const isEditMode = ref(false);
const currentEditId = ref(null);

const defaultForm = {
    partner_code: '',
    legal_name: '',
    partner_type: 'customer',
    contact_email: '',
    contact_phone: '',
    shipping_address: ''
};
const form = reactive({ ...defaultForm });

// 基础 Axios 实例
const api = axios.create({
    baseURL: '/api'
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});


// --- 数据获取与提交 ---

const fetchPartners = async () => {
    try {
        const res = await api.get('/partners');
        tableData.value = res.data;
    } catch (error) {
        ElMessage.error('加载往来单位失败: ' + (error.response?.data?.message || error.message));
    }
};

const submitPartner = async () => {
    if (!partnerFormRef.value) return;

    await partnerFormRef.value.validate(async (valid) => {
        if (valid) {
            loading.value = true;
            try {
                if (isEditMode.value) {
                    // 编辑模式：发送 PUT 请求
                    await api.put(`/partners/${currentEditId.value}`, form);
                    ElMessage.success('往来单位更新成功!');
                } else {
                    // 新增模式：发送 POST 请求
                    await api.post('/partners', form);
                    ElMessage.success(`${getTypeText(form.partner_type)} 创建成功!`);
                }

                dialogVisible.value = false;
                fetchPartners(); // 刷新列表
            } catch (error) {
                ElMessage.error('操作失败: ' + (error.response?.data?.message || error.message));
            } finally {
                loading.value = false;
            }
        }
    });
};


// --- 交互逻辑 ---

/**
 * 打开新增对话框
 */
const openCreateDialog = () => {
    isEditMode.value = false;
    currentEditId.value = null;
    resetForm();
    dialogVisible.value = true;
};

/**
 * 打开编辑对话框 [新增]
 */
const openEditDialog = (row) => {
    isEditMode.value = true;
    currentEditId.value = row.partner_id; // 确保后端返回数据中有 partner_id

    // 回填表单数据
    Object.assign(form, {
        partner_code: row.partner_code,
        legal_name: row.legal_name,
        partner_type: row.partner_type,
        contact_email: row.contact_email,
        contact_phone: row.contact_phone,
        shipping_address: row.shipping_address
    });

    dialogVisible.value = true;
};

/**
 * 重置表单状态
 */
const resetForm = () => {
    // 关闭时如果不是提交成功导致的关闭，可能需要清理，但这里主要用于下次打开前清理
    // element-ui 的 dialog close 事件触发时，form 还是脏的，所以要在 open 前或者 close 后重置
    // 这里 resetForm 绑定在 @close 上，会清除 form 数据
    Object.assign(form, defaultForm);
};

// --- 工具函数 (显示用) ---
const getTypeText = (type) => {
    switch (type) {
        case 'customer': return '客户';
        case 'vendor': return '供应商';
        case 'employee': return '员工';
        default: return type;
    }
}

const getTypeTag = (type) => {
    switch (type) {
        case 'customer': return 'success';
        case 'vendor': return 'warning';
        case 'employee': return 'info';
        default: return 'info';
    }
}

onMounted(() => {
    fetchPartners();
});
</script>

<style scoped>
.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
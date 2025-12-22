<template>
    <div class="login-container">
        <el-card class="login-card">
            <template #header>
                <div class="card-header">
                    <span>系统登录 / Login</span>
                </div>
            </template>

            <el-form :model="form" :rules="rules" ref="loginFormRef" label-position="top">
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" />
                </el-form-item>

                <el-form-item label="密码" prop="password">
                    <el-input v-model="form.password" type="password" placeholder="请输入密码" :prefix-icon="Lock"
                        show-password />
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" :loading="loading" style="width: 100%;" @click="handleLogin">
                        登录
                    </el-button>
                </el-form-item>

                <div style="text-align: center;">
                    <el-link type="info" @click="handleRegister">注册新用户 (测试用)</el-link>
                </div>
            </el-form>
        </el-card>
    </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { User, Lock } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

const form = reactive({
    username: '',
    password: ''
})

const rules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// 基础 Axios 配置（建议后续提取到单独文件）
const api = axios.create({
    baseURL: '/api'
})

const handleLogin = async () => {
    if (!loginFormRef.value) return

    await loginFormRef.value.validate(async (valid) => {
        if (valid) {
            loading.value = true
            try {
                const res = await api.post('/auth/login', form)
                // 保存 Token
                localStorage.setItem('token', res.data.token)
                localStorage.setItem('user', JSON.stringify(res.data.user))

                ElMessage.success('登录成功')
                router.push('/')
            } catch (error) {
                ElMessage.error(error.response?.data?.message || '登录失败')
            } finally {
                loading.value = false
            }
        }
    })
}

// 临时注册逻辑
const handleRegister = async () => {
    if (!form.username || !form.password) {
        ElMessage.warning('请先填写用户名和密码')
        return
    }
    try {
        await api.post('/auth/register', form)
        ElMessage.success('注册成功，请点击登录')
    } catch (error) {
        ElMessage.error(error.response?.data?.message || '注册失败')
    }
}
</script>

<style scoped>
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f0f2f5;
}

.login-card {
    width: 400px;
}

.card-header {
    text-align: center;
    font-weight: bold;
}
</style>
<template>
    <el-container class="layout-container-with-menu">
        <el-header class="header">
            <div class="logo-title">
                <el-icon :size="20">
                    <Money />
                </el-icon>
                <span>Cash Online</span>
            </div>
            <div class="right-menu">
                <el-dropdown @command="handleLangCommand" style="margin-right: 20px; color: white; cursor: pointer;">
                    <span class="el-dropdown-link">
                        {{ currentLang === 'zh' ? '中文' : 'English' }}
                        <el-icon class="el-icon--right"><arrow-down /></el-icon>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="zh">中文</el-dropdown-item>
                            <el-dropdown-item command="en">English</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <el-dropdown>
                    <span class="el-dropdown-link" style="color: white; cursor: pointer;">
                        <el-icon :size="16">
                            <User />
                        </el-icon>
                        {{ userName || 'Admin' }}
                        <el-icon class="el-icon--right"><arrow-down /></el-icon>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item divided @click="handleLogout">{{ $t('common.logout') }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
        </el-header>

        <el-container class="inner-container">
            <el-aside width="200px" class="aside">
                <el-menu :default-active="activePath" router background-color="#545c64" text-color="#fff"
                    active-text-color="#ffd04b">
                    <el-menu-item index="/">
                        <el-icon>
                            <Monitor />
                        </el-icon>
                        <span>{{ $t('menu.dashboard') }}</span>
                    </el-menu-item>

                    <el-sub-menu index="2">
                        <template #title>
                            <el-icon>
                                <Document />
                            </el-icon>
                            <span>{{ $t('menu.basic') }}</span>
                        </template>
                        <el-menu-item index="/accounts"><el-icon>
                                <Reading />
                            </el-icon>{{ $t('menu.accounts') }}</el-menu-item>
                        <el-menu-item index="/partners"><el-icon>
                                <CreditCard />
                            </el-icon>{{ $t('menu.partners') }}</el-menu-item>
                        <el-menu-item index="/inventory"><el-icon>
                                <Goods />
                            </el-icon>{{ $t('menu.items') }}</el-menu-item>
                    </el-sub-menu>

                    <el-sub-menu index="3">
                        <template #title>
                            <el-icon>
                                <Money />
                            </el-icon>
                            <span>{{ $t('menu.finance') }}</span>
                        </template>
                        <el-menu-item index="/voucher"><el-icon>
                                <EditPen />
                            </el-icon>{{ $t('menu.voucher') }}</el-menu-item>
                        <el-menu-item index="/transactions"><el-icon>
                                <List />
                            </el-icon>{{ $t('menu.transactions') }}</el-menu-item>
                    </el-sub-menu>

                    <el-sub-menu index="4">
                        <template #title>
                            <el-icon>
                                <ShoppingCart />
                            </el-icon>
                            <span>{{ $t('menu.purchase') }}</span>
                        </template>
                        <el-menu-item index="/purchase-order"><el-icon>
                                <CirclePlus />
                            </el-icon>{{ $t('menu.po') }}</el-menu-item>
                        <el-menu-item index="/purchase-inbound"><el-icon>
                                <GoodsFilled />
                            </el-icon>{{ $t('menu.inbound') }}</el-menu-item>
                    </el-sub-menu>

                    <el-sub-menu index="5">
                        <template #title>
                            <el-icon>
                                <Sell />
                            </el-icon>
                            <span>{{ $t('menu.sales') }}</span>
                        </template>
                        <el-menu-item index="/sales-order"><el-icon>
                                <CirclePlus />
                            </el-icon>{{ $t('menu.so') }}</el-menu-item>
                        <el-menu-item index="/sales-outbound"><el-icon>
                                <CircleClose />
                            </el-icon>{{ $t('menu.outbound') }}</el-menu-item>
                    </el-sub-menu>

                    <el-menu-item index="/reports">
                        <el-icon>
                            <TrendCharts />
                        </el-icon>
                        <span>{{ $t('menu.reports') }}</span>
                    </el-menu-item>
                </el-menu>
            </el-aside>
            <el-main class="main"><router-view /></el-main>
        </el-container>
    </el-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
// ...icons import (保持不变)

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();
const userName = ref(localStorage.getItem('userName') || 'Admin');
const currentLang = ref(locale.value);

const activePath = computed(() => route.path);

const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
};

const handleLangCommand = (command) => {
    locale.value = command;
    currentLang.value = command;
};
</script>

<style scoped>
/* 保持原有样式，增加 flex 布局给 right-menu */
.layout-container-with-menu {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
}

.header {
    background-color: #24292e;
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #363c42;
    height: 60px;
    padding: 0 20px;
    flex-shrink: 0;
}

.right-menu {
    display: flex;
    align-items: center;
}

.inner-container {
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
}

.aside {
    background-color: #545c64;
    height: 100%;
    overflow-y: auto;
}

.aside .el-menu {
    border-right: none;
    min-height: 100%;
}

.main {
    flex: 1;
    background-color: #f0f2f5;
    padding: 20px;
    overflow-y: auto;
    height: 100%;
}

.logo-title {
    display: flex;
    align-items: center;
    font-size: 18px;
    font-weight: bold;
}

.logo-title .el-icon {
    margin-right: 8px;
}
</style>
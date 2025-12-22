<template>
  <router-view></router-view>
</template>

<script setup>
// 保持不变
</script>

<style>
/* 关键修改：确保 HTML, body, 和 #app 铺满视口 */
html,
body,
#app {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  /* 防止出现双滚动条 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
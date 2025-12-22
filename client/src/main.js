import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n"; // 引入 vue-i18n

// 引入语言包
import zh from "./locales/zh.json";
import en from "./locales/en.json";

import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";

const app = createApp(App);

// 配置 i18n
const i18n = createI18n({
  legacy: false,
  locale: "zh",
  fallbackLocale: "en",
  messages: { zh, en },
});

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(ElementPlus);
app.use(router);
app.use(i18n); // 挂载

app.mount("#app");

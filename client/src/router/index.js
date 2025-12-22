import { createRouter, createWebHistory } from "vue-router";
import Login from "../views/Login.vue";
import Dashboard from "../views/Dashboard.vue";
import Home from "../views/Home.vue";
import Accounts from "../views/Accounts.vue";
import Partners from "../views/Partners.vue";
import Voucher from "../views/Voucher.vue";
import TransactionList from "../views/TransactionList.vue";
import Reports from "../views/Reports.vue";
import Inventory from "../views/Inventory.vue";
import PurchaseInbound from "../views/PurchaseInbound.vue";
import SalesOutbound from "../views/SalesOutbound.vue";
import PurchaseOrder from "../views/PurchaseOrder.vue"; // <--- 新增
import SalesOrder from "../views/SalesOrder.vue"; // <--- 新增

const routes = [
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/",
    name: "Dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "Home",
        component: Home,
      },
      {
        path: "accounts",
        name: "Accounts",
        component: Accounts,
        meta: { title: "会计科目" },
      },
      {
        path: "partners",
        name: "Partners",
        component: Partners,
        meta: { title: "往来单位" },
      },
      {
        path: "inventory",
        name: "Inventory",
        component: Inventory,
        meta: { title: "库存物料" },
      },
      {
        path: "voucher",
        name: "Voucher",
        component: Voucher,
        meta: { title: "凭证录入" },
      },
      {
        path: "transactions",
        name: "TransactionList",
        component: TransactionList,
        meta: { title: "凭证列表" },
      },
      {
        path: "reports",
        name: "Reports",
        component: Reports,
        meta: { title: "财务报表" },
      },
      // 采购模块
      {
        path: "purchase-inbound",
        name: "PurchaseInbound",
        component: PurchaseInbound,
        meta: { title: "采购入库" },
      },
      {
        path: "purchase-order", // <--- 采购订单路由
        name: "PurchaseOrder",
        component: PurchaseOrder,
        meta: { title: "创建采购订单" },
      },
      // 销售模块
      {
        path: "sales-outbound",
        name: "SalesOutbound",
        component: SalesOutbound,
        meta: { title: "销售出库" },
      },
      {
        path: "sales-order", // <--- 销售订单路由
        name: "SalesOrder",
        component: SalesOrder,
        meta: { title: "创建销售订单" },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// --- 路由守卫：鉴权检查 ---
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  if (to.meta.requiresAuth && !token) {
    next("/login");
  } else if (to.path === "/login" && token) {
    next("/");
  } else {
    next();
  }
});

export default router;

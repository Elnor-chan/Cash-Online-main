const jwt = require("jsonwebtoken");

// 鉴权中间件
const auth = (req, res, next) => {
  // 1. 从 Header 中获取 Token
  const token = req.header("Authorization");

  // 检查是否有 Token，格式应为 "Bearer [token]"
  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({ message: "访问被拒绝，请先登录" });
  }

  try {
    // 2. 验证 Token (去除 "Bearer " 部分)
    const tokenString = token.substring(7);
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);

    // 3. 将用户信息挂载到请求对象上
    req.user = decoded;
    next(); // 继续执行后续路由
  } catch (err) {
    // Token 无效或过期
    res.status(401).json({ message: "Token 无效或已过期" });
  }
};

module.exports = auth;

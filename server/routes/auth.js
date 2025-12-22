const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * @route   POST /api/auth/register
 * @desc    注册新用户
 */
router.post("/register", async (req, res) => {
  const { username, password, name } = req.body;

  // 基本校验
  if (!username || !password) {
    return res.status(400).json({ message: "用户名和密码不能为空" });
  }

  try {
    // 1. 检查用户是否存在 (使用重构后的 login_name 字段)
    const [rows] = await db.query(
      "SELECT * FROM app_users WHERE login_name = ?",
      [username]
    );
    if (rows.length > 0) {
      return res.status(400).json({ message: "用户已存在" });
    }

    // 2. 加密密码
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. 插入数据库 (使用重构后的字段名)
    // 字段映射：login_name, password_token, display_name
    const sql = `INSERT INTO app_users (login_name, password_token, display_name, access_level) VALUES (?, ?, ?, ?)`;
    await db.query(sql, [username, hash, name || username, "admin"]);

    res.status(201).json({ message: "注册成功" });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({ message: "服务器内部错误", error: err.message });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. 查询用户
    const [users] = await db.query(
      "SELECT * FROM app_users WHERE login_name = ?",
      [username]
    );
    if (users.length === 0) {
      return res.status(400).json({ message: "用户名或密码错误" });
    }

    const user = users[0];

    // 2. 比对密码 (注意使用 password_token)
    const isMatch = await bcrypt.compare(password, user.password_token);
    if (!isMatch) {
      return res.status(400).json({ message: "用户名或密码错误" });
    }

    // 3. 生成 JWT Token
    const token = jwt.sign(
      { id: user.user_id, username: user.login_name, role: user.access_level },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.user_id,
        username: user.login_name,
        name: user.display_name,
        role: user.access_level,
      },
    });
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;

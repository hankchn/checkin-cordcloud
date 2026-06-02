# 故障排查指南

## 常见问题及解决方案

### 1. Session 过期 + 自动登录失败

**现象**: 输出包含 `自动登录失败，可能需要2FA验证` 和 `请运行 npm run init 手动登录`

**原因**: 
- Cloudflare 拦截了自动化请求
- IP 地址变化触发了新设备验证
- 站点更新了登录页面结构

**解决**: 
```bash
cd {SKILL_BASE_DIR}/scripts && node checkin.js --init
```
在弹出的浏览器中手动完成登录，包括 2FA 验证。

---

### 2. Cloudflare 人机验证拦截

**现象**: 页面跳转到 Cloudflare challenge 页面，截图显示 "Checking your browser"

**原因**: Cloudflare 检测到自动化浏览器特征

**解决**: 
1. 运行 `node checkin.js --init` 打开有头浏览器
2. 手动完成 Cloudflare 人机验证
3. 完成登录后脚本会自动保存 Cookie 和浏览器数据

---

### 3. 2FA 验证码获取失败

**现象**: 输出包含 `获取验证码失败` 或 `等待验证码邮件超时`

**可能原因**:
- IMAP 配置错误（账号/授权码/服务器）
- 邮箱未开启 IMAP 服务
- 验证码邮件被归入垃圾箱（不在 INBOX）
- 网络原因导致 IMAP 连接失败

**排查步骤**:
1. 确认 `config.json` 中 `imap.password` 是授权码而非登录密码
2. 登录邮箱确认 IMAP 服务已开启
3. 检查是否能收到来自 CordCloud 的邮件
4. 尝试手动运行 init 模式

---

### 4. IP 变化触发设备验证

**现象**: 自动登录后仍被重定向到验证页面

**原因**: CordCloud 检测到新 IP 登录，要求额外验证

**解决**: 运行 `node checkin.js --init` 在新环境中完成一次完整的手动登录和设备验证。

---

### 5. Cookie 有效期只有 1 天

**现象**: 日志显示 `自动登录拿到的Cookie有效期过短（1.0天）`

**说明**: 这是正常现象。未通过完整 2FA 验证的登录只能获得短期票据（1天）。脚本会在每次执行时自动续期，不影响签到功能。

如需获取长期 Cookie（通常 30 天）：
1. 运行 `node checkin.js --init`
2. 在浏览器中完整通过 2FA 验证
3. 勾选"记住我"选项

---

### 6. 签到按钮找不到

**现象**: 日志显示 `尝试 API 签到...` 但 API 也返回失败

**可能原因**:
- 站点页面结构更新
- 签到入口移动了位置
- 账户异常被限制

**解决**:
1. 查看 `screenshots/` 目录中的截图了解页面状态
2. 手动登录网站确认签到功能是否正常
3. 如页面结构变化，需更新 `checkin.js` 中的选择器

---

### 7. 浏览器启动失败

**现象**: 输出包含 `browser has been closed` 或 `Failed to launch`

**可能原因**:
- Playwright Chromium 未安装
- 存在残留的浏览器锁文件
- 系统资源不足

**解决**:
```bash
# 重新安装浏览器
npx playwright install chromium

# 清理残留锁文件（脚本已自动处理，一般不需要）
rm -f browser-data/SingletonLock browser-data/SingletonCookie browser-data/SingletonSocket
```

---

## 日志级别说明

| 级别 | 含义 |
|------|------|
| `[INFO]` | 正常流程信息 |
| `[WARN]` | 警告，不一定影响签到 |
| `[ERROR]` | 错误，签到可能失败 |

## 截图文件命名规则

截图保存在 `screenshots/` 目录，命名格式：`YYYY-MM-DD_事件名.png`

常见截图：
- `*_before_checkin.png` — 签到前页面状态
- `*_after_click_checkin.png` — 点击签到按钮后
- `*_checkin_success.png` — 签到成功
- `*_auto_login_failed.png` — 自动登录失败
- `*_2fa_page_detected.png` — 检测到 2FA 页面

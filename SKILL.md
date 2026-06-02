---
name: checkin-cordcloud
description: CordCloud (cordc.net) 每日自动签到 skill。当用户要求执行 CordCloud 签到、配置 CordCloud 签到定时任务、初始化 CordCloud 登录、或排查签到失败问题时，应使用此 skill。此 skill 通过 Playwright 浏览器自动化完成登录（含 2FA 邮箱验证码）和每日签到打卡，支持 Cookie 持久化和防重复签到。
---

# CordCloud 自动签到

此 Skill 提供 CordCloud (cordc.net) 的全自动每日签到能力，包含自动登录、2FA 邮箱验证码处理、Cookie 有效期保护和签到去重。

## 前置条件

首次使用前，完成以下初始化步骤：

1. 进入 skill 的 scripts 目录：`cd {SKILL_BASE_DIR}/scripts`
2. 安装 Node.js 依赖：`npm install`
3. 安装 Playwright Chromium：`npx playwright install chromium`
4. 创建配置文件：`cp config.example.json config.json`，然后编辑填入真实账号信息（参考 `references/config-guide.md`）
5. 首次登录：`node checkin.js --init`，在弹出的浏览器中手动完成登录和 2FA 验证

## 核心工作流

### 执行签到

运行签到脚本：

```bash
cd {SKILL_BASE_DIR}/scripts && node checkin.js
```

脚本执行流程：
1. 检查锁文件 `.checkin-lock` → 今日已签到则退出（exit 0）
2. 启动 Playwright 浏览器 → 访问 `/user` 检测登录态
3. Session 过期时自动重新登录（表单 → 2FA 邮箱验证码 → API 备选）
4. 执行签到（按钮点击 → API 备选）
5. 写入锁文件，保存 Cookie，退出

### 初始化登录

当自动登录失败（Cloudflare 拦截、IP 变更触发新设备验证）时，执行手动初始化：

```bash
cd {SKILL_BASE_DIR}/scripts && node checkin.js --init
```

此命令打开有头浏览器，等待用户手动完成登录（最长 5 分钟）。

### 配置定时自动化

推荐配置为 CodeBuddy 自动化任务：
- **调度规则**: `FREQ=DAILY;BYHOUR=10;BYMINUTE=0`
- **工作目录**: `{SKILL_BASE_DIR}/scripts`
- **Prompt**: `执行 CordCloud 自动签到任务：运行 cd "{SKILL_BASE_DIR}/scripts" && node checkin.js 完成签到。如果签到失败（Session 过期），提示用户运行 node checkin.js --init 重新登录。`

## 输出解读

| 退出码 | 含义 | 输出关键词 |
|--------|------|-----------|
| 0 | 签到成功或今日已签到 | `签到成功`、`今日已签到`、`已签到（本地锁文件）` |
| 1 | 签到失败 | `自动登录失败`、`请运行 npm run init` |

截图保存在 `{SKILL_BASE_DIR}/scripts/screenshots/` 目录，按日期命名。

## 故障处理

遇到签到失败时，参考 `references/troubleshooting.md` 中的详细排查指南。

常见问题速查：
- **自动登录失败** → 提示用户运行 `node checkin.js --init`
- **2FA 验证码超时** → 检查 IMAP 配置是否正确
- **Cookie 有效期短（1天）** → 正常现象，每日自动登录续期

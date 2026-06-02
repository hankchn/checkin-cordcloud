# 配置文件指南

## config.json 字段说明

从 `config.example.json` 复制为 `config.json` 后，按以下说明填写：

```json
{
  "email": "your-email@example.com",
  "password": "your-cordcloud-password",
  "baseUrl": "https://cordc.net",
  "loginPath": "/auth/login",
  "userPath": "/user",
  "headless": true,
  "timeout": 30000,
  "retryCount": 3,
  "imap": {
    "user": "your-email@example.com",
    "password": "your-imap-auth-code",
    "host": "imap.qq.com",
    "port": 993
  }
}
```

## 字段详解

| 字段 | 必填 | 说明 |
|------|------|------|
| `email` | ✅ | CordCloud 登录邮箱 |
| `password` | ✅ | CordCloud 登录密码 |
| `baseUrl` | ❌ | 站点地址，默认 `https://cordc.net` |
| `loginPath` | ❌ | 登录路径，默认 `/auth/login` |
| `userPath` | ❌ | 用户面板路径，默认 `/user` |
| `headless` | ❌ | 是否无头模式运行浏览器，默认 `true` |
| `timeout` | ❌ | 页面加载超时（毫秒），默认 `30000` |
| `retryCount` | ❌ | 重试次数，默认 `3` |
| `imap.user` | ✅ | IMAP 邮箱账号（用于接收 2FA 验证码） |
| `imap.password` | ✅ | IMAP 授权码（**非邮箱登录密码**） |
| `imap.host` | ❌ | IMAP 服务器地址，默认 `imap.qq.com` |
| `imap.port` | ❌ | IMAP 端口，默认 `993`（SSL） |

## 获取 IMAP 授权码

### QQ 邮箱

1. 登录 QQ 邮箱网页版
2. 进入 **设置** → **账户**
3. 找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务**
4. 开启 **IMAP/SMTP服务**
5. 按提示发送短信验证后，获取 16 位授权码
6. 将授权码填入 `imap.password` 字段

### 其他邮箱

- **163 邮箱**: 设置 → POP3/SMTP/IMAP → 开启 IMAP，host 设为 `imap.163.com`
- **Gmail**: 需要开启 App Password，host 设为 `imap.gmail.com`
- **Outlook**: host 设为 `imap-mail.outlook.com`

## 安全提示

- `config.json` 已被 `.gitignore` 排除，不会上传到 Git 仓库
- 定期更换 IMAP 授权码以提高安全性
- 不要将 `config.json` 通过明文方式分享给他人

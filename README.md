# auto-checkin-cordcloud

CordCloud (cordc.net) 每日自动签到 Agent Skill —— 一键安装，自动登录 + 2FA 验证 + 每日打卡。

## 功能特性

- 每日自动签到（按钮点击 + API 备选）
- Session 过期时自动重新登录
- 2FA 邮箱验证码自动获取和填入（IMAP）
- Cookie 有效期保护（短期票据不覆盖长期票据）
- 锁文件防重复签到
- 截图记录便于排查

## 安装

### 方式一：通过 skills CLI

```bash
npx skills add your-github-username/cordcloud-checkin-skill -g -y
```

### 方式二：手动安装

```bash
git clone https://github.com/your-username/cordcloud-checkin-skill.git ~/.codebuddy/skills/cordcloud-checkin
```

## 初始化

```bash
cd ~/.codebuddy/skills/cordcloud-checkin/scripts

# 安装依赖
npm install
npx playwright install chromium

# 创建配置文件并填入账号信息
cp config.example.json config.json
# 编辑 config.json（参考 references/config-guide.md）

# 首次登录（需手动完成 2FA）
node checkin.js --init
```

## 使用

安装并配置完成后，Agent 会自动识别此 skill。对 Agent 说"CordCloud 签到"即可触发。

也可以配置为每日自动化任务，让 Agent 定时执行。

## 目录结构

```
cordcloud-checkin/
├── SKILL.md                        # Skill 定义（Agent 自动读取）
├── README.md                       # 说明文档
├── .gitignore                      # Git 排除规则
├── references/
│   ├── config-guide.md             # 配置详细说明
│   └── troubleshooting.md          # 故障排查指南
└── scripts/
    ├── checkin.js                   # 主签到脚本
    ├── package.json                # Node.js 依赖
    └── config.example.json         # 配置模板
```

## 许可

MIT

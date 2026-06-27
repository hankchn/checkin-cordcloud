<p align="center"><b>简体中文</b> | <a href="./README_en.md">English</a></p>

# checkin-cordcloud

一句话说明：这个 Skill 帮你用自己的 CordCloud 账号完成每日签到，支持自动登录、邮箱 2FA 验证、Cookie 持久化和防重复执行。

## 这个版本能做什么

- 每日自动打开 CordCloud 用户页并执行签到。
- Session 过期时自动重新登录，并在需要时处理邮箱 2FA 验证码。
- 使用本地锁文件避免同一天重复签到。
- 保存浏览器状态和排查截图，方便定位失败原因。
- 既可以手动触发，也可以配置为 Codex 或 CodeBuddy 的定时任务。

## 适合谁

- 已经拥有 CordCloud 账号，并希望减少每日重复签到操作的人。
- 需要把签到脚本放进个人自动化流程的人。
- 能接受首次初始化时手动登录一次，并在服务要求新验证时重新初始化的人。

## 使用示例

首次初始化：

```bash
cd scripts
npm install
npx playwright install chromium
cp config.example.json config.json
node checkin.js --init
```

日常签到：

```bash
cd scripts
node checkin.js
```

预期输出：

```text
签到成功
```

如果当天已经执行过，脚本会根据本地锁文件直接退出，避免重复操作。

## 快速开始

安装 Skill：

```bash
git clone https://github.com/hankchn/checkin-cordcloud.git ~/.codex/skills/checkin-cordcloud
```

创建配置文件：

```bash
cd ~/.codex/skills/checkin-cordcloud/scripts
npm install
npx playwright install chromium
cp config.example.json config.json
```

编辑 `config.json`，填入自己的 CordCloud 账号和邮箱 IMAP 授权码。字段说明见 `references/config-guide.md`。

完成首次登录：

```bash
node checkin.js --init
```

之后可手动运行：

```bash
node checkin.js
```

## 常见用法

- 对 Agent 说“执行 CordCloud 签到”，让 Skill 运行签到脚本。
- 配置每日定时任务，在固定时间执行 `node checkin.js`。
- 当自动登录失败时，运行 `node checkin.js --init` 重新完成网页登录和 2FA。
- 查看 `scripts/screenshots/` 中的截图来排查失败原因。

## 当前限制

- 只适合你自己的账号，不适合批量账号或共享账号。
- 如果 CordCloud 页面、登录流程、Cloudflare 策略或 2FA 邮件格式变化，脚本可能需要维护。
- 首次初始化和异常恢复可能需要人工参与。
- 脚本依赖 Playwright Chromium 和 Node.js 运行环境。

## 安全与隐私说明

- 不要把 `scripts/config.json`、`scripts/cookies.json`、截图或浏览器数据提交到仓库。
- `config.example.json` 只放占位值；真实密码和 IMAP 授权码应只保存在本机。
- 请只在符合服务条款和你自己账号授权的情况下使用。

## 技术实现

- `scripts/checkin.js` 负责登录、2FA、签到和锁文件判断。
- `references/config-guide.md` 说明配置字段。
- `references/troubleshooting.md` 提供失败排查路径。
- `scripts/package.json` 管理 Playwright 依赖。

## Roadmap

- 增加更清晰的失败分类。
- 增加更稳健的邮箱验证码解析。
- 补充定时任务配置示例。

## License

[MIT](./LICENSE)

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/hankchn">
        <img src="https://github.com/hankchn.png" width="64" height="64" style="border-radius:50%;" alt="hankchn" />
        <br />
        <sub><b>hankchn</b></sub>
      </a>
      <br />
      <sub>Hank Yang</sub>
    </td>
    <td align="center">
      <a href="https://openai.com/codex">
        <img src="https://github.com/openai.png" width="64" height="64" style="border-radius:50%;" alt="Codex" />
        <br />
        <sub><b>Codex</b></sub>
      </a>
      <br />
      <sub>OpenAI Codex</sub>
    </td>
  </tr>
</table>

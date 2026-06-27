<p align="center"><a href="./README.md">简体中文</a> | <b>English</b></p>

# checkin-cordcloud

One-line summary: this Skill helps you run a daily CordCloud check-in for your own account, with automatic login, email 2FA handling, persistent cookies, and duplicate-run protection.

## What this version can do

- Open the CordCloud user page and run the daily check-in.
- Re-login when the session expires, including email 2FA when needed.
- Use a local lock file to avoid checking in twice on the same day.
- Save browser state and screenshots for troubleshooting.
- Run manually or as a scheduled Codex or CodeBuddy automation.

## Who it is for

- Users who already have a CordCloud account and want to reduce repetitive daily check-in work.
- Users who want to place the check-in script inside a personal automation flow.
- Users who are comfortable doing one manual login during initialization and repeating it when the service requires new verification.

## Usage example

Initialize once:

```bash
cd scripts
npm install
npx playwright install chromium
cp config.example.json config.json
node checkin.js --init
```

Daily run:

```bash
cd scripts
node checkin.js
```

Expected output:

```text
签到成功
```

If the script already ran today, it exits through the local lock file instead of repeating the check-in.

## Quick start

Install the Skill:

```bash
git clone https://github.com/hankchn/checkin-cordcloud.git ~/.codex/skills/checkin-cordcloud
```

Create local configuration:

```bash
cd ~/.codex/skills/checkin-cordcloud/scripts
npm install
npx playwright install chromium
cp config.example.json config.json
```

Edit `config.json` with your own CordCloud account and email IMAP authorization code. See `references/config-guide.md` for field details.

Complete the first login:

```bash
node checkin.js --init
```

Then run:

```bash
node checkin.js
```

## Common uses

- Ask the agent to run the CordCloud check-in Skill.
- Schedule `node checkin.js` as a daily automation.
- Run `node checkin.js --init` again when automatic login fails.
- Check `scripts/screenshots/` when a run needs troubleshooting.

## Current limitations

- Intended only for your own account, not bulk or shared-account operation.
- CordCloud page changes, login-flow changes, Cloudflare policy changes, or 2FA email changes may require maintenance.
- First-time setup and abnormal recovery may require human action.
- The script depends on Node.js and Playwright Chromium.

## Security and privacy

- Do not commit `scripts/config.json`, `scripts/cookies.json`, screenshots, or browser state.
- `config.example.json` contains placeholders only; real passwords and IMAP authorization codes should stay on your machine.
- Use this only when it complies with the service rules and your own account authorization.

## Technical notes

- `scripts/checkin.js` handles login, 2FA, check-in, and lock-file logic.
- `references/config-guide.md` documents configuration fields.
- `references/troubleshooting.md` explains recovery paths.
- `scripts/package.json` manages Playwright dependencies.

## Roadmap

- Add clearer failure categories.
- Improve email-code parsing robustness.
- Add scheduled-task setup examples.

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

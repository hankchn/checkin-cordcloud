# checkin-cordcloud

Daily auto check-in Agent Skill for CordCloud (cordc.net) — one-click install, auto login + 2FA + daily check-in.

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_EN.md">English</a>
</p>

## Features

- Daily auto check-in (button click + API fallback)
- Auto re-login when session expires
- 2FA email verification code via IMAP
- Cookie expiry protection (short-term tokens won't overwrite long-term ones)
- Lock file to prevent duplicate check-ins
- Screenshots for debugging

## Contributors

- [@hankchn](https://github.com/hankchn) — Requirements & Testing
- [CodeBuddy (Claude)](https://www.codebuddy.ai) — Development & Packaging

## Installation

### Option 1: via skills CLI

```bash
npx skills add hankchn/checkin-cordcloud -g -y
```

### Option 2: Manual install

```bash
git clone https://github.com/hankchn/checkin-cordcloud.git ~/.codebuddy/skills/checkin-cordcloud
```

## Setup

```bash
cd ~/.codebuddy/skills/checkin-cordcloud/scripts

# Install dependencies
npm install
npx playwright install chromium

# Create config file and fill in your credentials
cp config.example.json config.json
# Edit config.json (refer to references/config-guide.md)

# First-time login (manual 2FA required)
node checkin.js --init
```

## Usage

Once installed and configured, the Agent will automatically recognize this skill. Just say "CordCloud check-in" to trigger it.

You can also set it up as a daily automation task for the Agent to execute automatically.

## Directory Structure

```
checkin-cordcloud/
├── SKILL.md                        # Skill definition (read by Agent)
├── README.md                       # Documentation (中文)
├── README_EN.md                    # Documentation (English)
├── .gitignore                      # Git ignore rules
├── references/
│   ├── config-guide.md             # Configuration guide
│   └── troubleshooting.md          # Troubleshooting guide
└── scripts/
    ├── checkin.js                   # Main check-in script
    ├── package.json                # Node.js dependencies
    └── config.example.json         # Config template
```

## License

MIT

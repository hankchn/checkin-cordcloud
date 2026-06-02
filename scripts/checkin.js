const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// ============ 配置 ============
const PROJECT_DIR = __dirname;
const BROWSER_DATA_DIR = path.join(PROJECT_DIR, 'browser-data');
const SCREENSHOTS_DIR = path.join(PROJECT_DIR, 'screenshots');
const COOKIE_FILE = path.join(PROJECT_DIR, 'cookies.json');
const CONFIG_PATH = path.join(PROJECT_DIR, 'config.json');
const LOCK_FILE = path.join(PROJECT_DIR, '.checkin-lock');

[BROWSER_DATA_DIR, SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ 每日去重 ============
function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }); // YYYY-MM-DD
}

function alreadyCheckedToday() {
  try {
    const lockDate = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
    return lockDate === todayStr();
  } catch { return false; }
}

function markCheckedToday() {
  fs.writeFileSync(LOCK_FILE, todayStr());
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    log('ERROR', '配置文件不存在');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function log(level, message) {
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${time}] [${level}] ${message}`);
}

async function screenshot(page, name) {
  const filename = `${new Date().toISOString().slice(0, 10)}_${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: true });
  log('INFO', `截图: ${filename}`);
}

const args = process.argv.slice(2);
const isInitMode = args.includes('--init');

// ============ 启动浏览器（统一方式） ============
async function launchBrowser() {
  // 清理残留的锁文件
  ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
    const p = path.join(BROWSER_DATA_DIR, f);
    try { fs.unlinkSync(p); } catch {}
  });

  return await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });
}

// ============ 检测登录状态 ============
async function checkLoginStatus(page, config) {
  const baseUrl = config.baseUrl || 'https://cordc.net';
  await page.goto(`${baseUrl}/user`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const url = page.url();
  return url.includes('/user') && !url.includes('/auth');
}

// ============ Cookie 有效期保护 ============
const AUTH_COOKIE_NAMES = ['uid', 'key', 'email', 'ip', 'expire_in'];

async function backupAuthCookies(context) {
  const cookies = await context.cookies();
  const authCookies = cookies.filter(c => c.domain.includes('cordc') && AUTH_COOKIE_NAMES.includes(c.name));
  if (authCookies.length > 0) {
    const maxExpiry = Math.max(...authCookies.map(c => c.expires || 0));
    log('INFO', `备份 ${authCookies.length} 个认证Cookie (最远过期: ${new Date(maxExpiry * 1000).toISOString().slice(0,19)})`);
  } else {
    log('WARN', '无认证Cookie可备份');
  }
  return authCookies;
}

function getMaxExpiry(cookies) {
  const authCookies = cookies.filter(c => c.domain?.includes('cordc') && AUTH_COOKIE_NAMES.includes(c.name));
  if (authCookies.length === 0) return 0;
  return Math.max(...authCookies.map(c => c.expires || 0));
}

async function restoreAuthCookies(context, backupCookies) {
  if (!backupCookies || backupCookies.length === 0) return;
  // 先清除当前的短期认证 Cookie
  const current = await context.cookies();
  const toRemove = current.filter(c => c.domain?.includes('cordc') && AUTH_COOKIE_NAMES.includes(c.name));
  if (toRemove.length > 0) {
    await context.clearCookies({ name: AUTH_COOKIE_NAMES });
  }
  // 恢复备份的长期 Cookie
  await context.addCookies(backupCookies);
  log('INFO', `已恢复 ${backupCookies.length} 个备份Cookie`);
}

// ============ 邮箱 2FA 验证码读取 ============
function fetchVerificationCode(config, maxWaitMs = 60000) {
  return new Promise((resolve, reject) => {
    const imapConfig = config.imap;
    if (!imapConfig || !imapConfig.user || !imapConfig.password) {
      return reject(new Error('config.json 中缺少 imap 配置'));
    }

    const startTime = Date.now();
    const pollInterval = 5000; // 每 5 秒检查一次

    function tryFetch() {
      const imap = new Imap({
        user: imapConfig.user,
        password: imapConfig.password,
        host: imapConfig.host || 'imap.qq.com',
        port: imapConfig.port || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
          if (err) { imap.end(); return reject(err); }

          // 搜索最近 5 分钟内的邮件，发件人包含 cordcloud 关键字
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
          const searchCriteria = [
            ['SINCE', fiveMinAgo],
            ['UNSEEN'],
          ];

          imap.search(searchCriteria, (err, results) => {
            if (err) { imap.end(); return reject(err); }

            if (!results || results.length === 0) {
              imap.end();
              // 如果还没超时，继续轮询
              if (Date.now() - startTime < maxWaitMs) {
                log('INFO', `未找到验证码邮件，${Math.ceil((maxWaitMs - (Date.now() - startTime)) / 1000)}秒后重试...`);
                setTimeout(tryFetch, pollInterval);
              } else {
                reject(new Error('等待验证码邮件超时'));
              }
              return;
            }

            // 取最新的邮件
            const latestUid = results[results.length - 1];
            const fetch = imap.fetch([latestUid], { bodies: '' });

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (err) { imap.end(); return reject(err); }

                  const subject = parsed.subject || '';
                  const textBody = parsed.text || '';
                  const htmlBody = parsed.html || '';
                  const fullText = `${subject} ${textBody} ${htmlBody}`;

                  log('INFO', `邮件主题: ${subject}`);

                  // 提取 6 位数字验证码
                  const codeMatch = fullText.match(/(\d{6})/);
                  if (codeMatch) {
                    log('INFO', `提取到验证码: ${codeMatch[1]}`);
                    imap.end();
                    resolve(codeMatch[1]);
                  } else {
                    imap.end();
                    // 可能不是验证码邮件，继续轮询
                    if (Date.now() - startTime < maxWaitMs) {
                      log('INFO', '邮件中未找到验证码，继续等待...');
                      setTimeout(tryFetch, pollInterval);
                    } else {
                      reject(new Error('邮件中未找到6位验证码'));
                    }
                  }
                });
              });
            });

            fetch.once('error', (err) => { imap.end(); reject(err); });
          });
        });
      });

      imap.once('error', (err) => {
        log('ERROR', `IMAP连接错误: ${err.message}`);
        reject(err);
      });

      imap.connect();
    }

    tryFetch();
  });
}

// ============ 自动处理 2FA 验证页面 ============
async function handle2FA(page, config) {
  const url = page.url();
  if (!url.includes('2fa') && !url.includes('verify') && !url.includes('device')) {
    return false; // 不是 2FA 页面
  }

  log('INFO', '检测到 2FA 验证页面，尝试通过邮箱获取验证码...');
  await screenshot(page, '2fa_page_detected');

  // 检查页面上是否有"发送验证码"按钮，如果有就先点击
  try {
    const sendBtn = page.locator(
      'button:has-text("发送"), button:has-text("Send"), button:has-text("获取"), ' +
      'a:has-text("发送"), a:has-text("Send"), a:has-text("获取验证码"), ' +
      'button:has-text("验证码"), input[value*="发送"], input[value*="Send"]'
    ).first();
    const sendBtnVisible = await sendBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (sendBtnVisible) {
      log('INFO', '找到发送验证码按钮，点击...');
      await sendBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    log('WARN', `点击发送按钮异常: ${e.message}`);
  }

  // 从邮箱获取验证码（最多等60秒）
  let code;
  try {
    code = await fetchVerificationCode(config, 60000);
  } catch (e) {
    log('ERROR', `获取验证码失败: ${e.message}`);
    return false;
  }

  // 填入验证码
  try {
    const codeInput = page.locator(
      'input[name="code"], input[name="verify_code"], input[name="verification_code"], ' +
      'input[placeholder*="验证码"], input[placeholder*="code"], input[placeholder*="Code"], ' +
      'input[type="text"], input[type="number"]'
    ).first();

    const inputVisible = await codeInput.isVisible({ timeout: 5000 }).catch(() => false);
    if (!inputVisible) {
      log('ERROR', '未找到验证码输入框');
      await screenshot(page, '2fa_no_input');
      return false;
    }

    await codeInput.fill(code);
    log('INFO', `已填入验证码: ${code}`);
    await page.waitForTimeout(500);

    // 点击提交/验证按钮
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("验证"), button:has-text("Verify"), ' +
      'button:has-text("确认"), button:has-text("确定"), button:has-text("提交"), ' +
      'button:has-text("登录"), button:has-text("Login"), input[type="submit"]'
    ).first();
    const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (submitVisible) {
      await submitBtn.click();
      log('INFO', '已点击验证按钮');
    } else {
      await codeInput.press('Enter');
      log('INFO', '已按 Enter 提交验证码');
    }

    // 等待跳转
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      if (currentUrl.includes('/user') && !currentUrl.includes('/auth')) {
        log('INFO', '2FA 验证通过！已成功登录');
        return true;
      }
    }

    await screenshot(page, '2fa_submit_result');
    log('WARN', `2FA 提交后 URL: ${page.url()}`);
    return page.url().includes('/user') && !page.url().includes('/auth');
  } catch (e) {
    log('ERROR', `填写验证码异常: ${e.message}`);
    await screenshot(page, '2fa_error');
    return false;
  }
}

// ============ 自动登录（通过表单提交） ============
async function autoLogin(page, config) {
  const baseUrl = config.baseUrl || 'https://cordc.net';
  const loginPath = config.loginPath || '/auth/login';
  const email = config.email;
  const password = config.password;

  if (!email || !password) {
    log('ERROR', 'config.json 中缺少 email 或 password');
    return false;
  }

  log('INFO', `尝试自动登录: ${email}`);

  // 导航到登录页
  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 方案1: 通过页面表单填写登录
  try {
    // 查找邮箱输入框
    const emailInput = page.locator('input[name="email"], input[type="email"], #email').first();
    const passwordInput = page.locator('input[name="passwd"], input[name="password"], input[type="password"], #passwd, #password').first();

    const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
    const pwdVisible = await passwordInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (emailVisible && pwdVisible) {
      log('INFO', '找到登录表单，填写中...');
      await emailInput.fill(email);
      await page.waitForTimeout(500);
      await passwordInput.fill(password);
      await page.waitForTimeout(500);

      // 勾选"记住我"
      const rememberMe = page.locator('input[name="remember_me"], input[name="remember"], #remember-me, input[type="checkbox"]').first();
      const rememberVisible = await rememberMe.isVisible({ timeout: 2000 }).catch(() => false);
      if (rememberVisible) {
        const checked = await rememberMe.isChecked().catch(() => false);
        if (!checked) {
          await rememberMe.check();
          log('INFO', '已勾选"记住我"');
        }
      }

      // 点击登录按钮
      const loginBtn = page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login"), input[type="submit"], #login-btn, .login-btn').first();
      const btnVisible = await loginBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (btnVisible) {
        await loginBtn.click();
        log('INFO', '已点击登录按钮，等待响应...');
      } else {
        // 尝试 Enter 键提交
        await passwordInput.press('Enter');
        log('INFO', '已按 Enter 提交登录表单...');
      }

      // 等待跳转到用户面板
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(1000);
        const url = page.url();
        if (url.includes('/user') && !url.includes('/auth')) {
          log('INFO', '自动登录成功！');
          return true;
        }
        // 提前检测 2FA 页面，不用等满 15 秒
        if (url.includes('2fa') || url.includes('verify') || url.includes('device')) {
          log('INFO', '检测到 2FA 页面，尝试自动处理...');
          break;
        }
      }

      const finalUrl = page.url();

      // 如果跳转到了 2FA 验证页面，自动处理
      if (finalUrl.includes('/auth') || finalUrl.includes('2fa') || finalUrl.includes('verify')) {
        log('INFO', `登录后 URL: ${finalUrl}，尝试自动 2FA...`);
        const twoFaOk = await handle2FA(page, config);
        if (twoFaOk) {
          log('INFO', '自动 2FA 验证通过，登录成功！');
          return true;
        }
        log('WARN', '自动 2FA 未通过');
        await screenshot(page, 'auto_login_2fa_failed');
      }
    }
  } catch (e) {
    log('WARN', `表单登录异常: ${e.message}`);
  }

  // 方案2: 通过 API 登录
  log('INFO', '尝试 API 方式登录...');
  try {
    const result = await page.evaluate(async ({ url, email, password }) => {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({ email, passwd: password, remember_me: 'on' }),
        });
        const t = await r.text();
        try { return { status: r.status, data: JSON.parse(t) }; }
        catch { return { status: r.status, data: t }; }
      } catch (e) { return { error: e.message }; }
    }, { url: `${baseUrl}/auth/login`, email, password });

    log('INFO', `API 登录响应: ${JSON.stringify(result)}`);

    if (result.data && typeof result.data === 'object') {
      if (result.data.ret === 1 || result.data.msg?.includes('success') || result.data.msg?.includes('登录成功')) {
        // 刷新页面以应用 Cookie
        await page.goto(`${baseUrl}/user`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        const url = page.url();
        if (url.includes('/user') && !url.includes('/auth')) {
          log('INFO', 'API 登录成功！');
          return true;
        }
      }
    }
  } catch (e) {
    log('WARN', `API 登录异常: ${e.message}`);
  }

  return false;
}

// ============ 等待用户手动登录 ============
async function waitForLogin(page) {
  log('INFO', '请在浏览器中完成:');
  log('INFO', '  1. 登录（邮箱 + 密码）');
  log('INFO', '  2. 完成 2FA 验证码');
  log('INFO', '  3. 勾选"记住我"');
  log('INFO', '');
  log('INFO', '>>> 登录成功后脚本会自动检测并继续 <<<');

  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    if (url.includes('/user') && !url.includes('/auth')) {
      return true;
    }
  }
  return false;
}

// ============ 导出 Cookie（带有效期保护） ============
async function saveCookies(context) {
  const cookies = await context.cookies();
  const cordCookies = cookies.filter(c => c.domain.includes('cordc'));
  const newMaxExpiry = getMaxExpiry(cordCookies);

  // 读取已保存的 cookies.json，比较有效期
  let oldMaxExpiry = 0;
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const oldCookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
      oldMaxExpiry = getMaxExpiry(oldCookies);
    }
  } catch {}

  if (newMaxExpiry >= oldMaxExpiry) {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cordCookies, null, 2));
    log('INFO', `已保存 ${cordCookies.length} 个 Cookie (有效期: ${new Date(newMaxExpiry * 1000).toISOString().slice(0,19)})`);
  } else {
    log('WARN', `跳过保存Cookie: 新Cookie有效期(${new Date(newMaxExpiry * 1000).toISOString().slice(0,10)})短于已保存的(${new Date(oldMaxExpiry * 1000).toISOString().slice(0,10)})`);
  }
}

// ============ 执行签到 ============
async function performCheckin(page, config) {
  const baseUrl = config.baseUrl || 'https://cordc.net';

  // 确保在用户面板
  const currentUrl = page.url();
  if (!currentUrl.includes('/user') || currentUrl.includes('/auth')) {
    await page.goto(`${baseUrl}/user`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  await screenshot(page, 'before_checkin');

  // 方案1: 找签到按钮
  log('INFO', '查找签到按钮...');
  const checkinBtn = page.locator(
    'button:has-text("签到"), button:has-text("check"), a:has-text("签到"), ' +
    '[onclick*="checkin"], [onclick*="check"], #checkin-btn, .checkin-btn, ' +
    'button:has-text("每日签到"), button:has-text("领取")'
  ).first();

  let btnFound = false;
  try { btnFound = await checkinBtn.isVisible({ timeout: 5000 }); } catch {}

  if (btnFound) {
    log('INFO', '找到签到按钮，点击...');
    await checkinBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'after_click_checkin');

    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('获得') || bodyText.includes('成功') || bodyText.includes('已签到')) {
      log('INFO', '签到成功！');
      return true;
    }

    // 检查弹窗
    try {
      const toast = page.locator('.toast, .alert, .swal2-popup, .modal-body, [role="alert"]').first();
      if (await toast.isVisible({ timeout: 3000 })) {
        const txt = await toast.innerText();
        log('INFO', `弹窗: ${txt}`);
        if (txt.includes('获得') || txt.includes('成功') || txt.includes('已签到')) {
          return true;
        }
      }
    } catch {}
  }

  // 方案2: API 签到
  log('INFO', '尝试 API 签到...');
  const result = await page.evaluate(async (url) => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
      const t = await r.text();
      try { return { status: r.status, data: JSON.parse(t) }; }
      catch { return { status: r.status, data: t }; }
    } catch (e) { return { error: e.message }; }
  }, `${baseUrl}/user/checkin`);

  log('INFO', `API 响应: ${JSON.stringify(result)}`);

  if (result.error) {
    log('ERROR', `签到请求失败: ${result.error}`);
    return false;
  }

  const data = result.data;
  if (typeof data === 'object') {
    if (data.ret === 1 || data.msg?.includes('获得') || data.msg?.includes('成功')) {
      log('INFO', `签到成功！${data.msg || ''}`);
      return true;
    }
    if (data.msg?.includes('已签到') || data.msg?.includes('already') || data.ret === 0) {
      log('INFO', `今日已签到: ${data.msg || ''}`);
      return true;
    }
    log('WARN', `签到结果: ${JSON.stringify(data)}`);
    return false;
  }

  if (typeof data === 'string') {
    if (data.includes('获得') || data.includes('成功')) { log('INFO', '签到成功！'); return true; }
    if (data.includes('已签到') || data.includes('already')) { log('INFO', '今日已签到'); return true; }
  }

  await screenshot(page, 'checkin_unknown');
  return false;
}

// ============ 主入口 ============
async function main() {
  log('INFO', '========================================');
  log('INFO', 'CordCloud 自动签到工具');
  log('INFO', `运行模式: ${isInitMode ? '初始化' : '签到'}`);
  log('INFO', '========================================');

  // 非 init 模式下，检查今天是否已签到
  if (!isInitMode && alreadyCheckedToday()) {
    log('INFO', '今日已签到（本地锁文件），跳过重复执行');
    process.exit(0);
  }

  const config = loadConfig();
  const context = await launchBrowser();
  const page = context.pages()[0] || await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    // 检测当前登录状态
    log('INFO', '检测登录状态...');
    const isLoggedIn = await checkLoginStatus(page, config);

    if (!isLoggedIn) {
      log('WARN', 'Session 已过期，尝试自动重新登录...');

      // 备份当前认证 Cookie（可能已过期但还在浏览器中）
      const backupCookies = await backupAuthCookies(context);
      const backupMaxExpiry = getMaxExpiry(backupCookies);

      // 先尝试自动登录
      const autoLoginOk = await autoLogin(page, config);

      if (autoLoginOk) {
        // 自动登录成功，但需要验证新 Cookie 的有效期
        const newCookies = await context.cookies();
        const newMaxExpiry = getMaxExpiry(newCookies);
        const now = Date.now() / 1000;
        const newRemainingDays = ((newMaxExpiry - now) / 86400).toFixed(1);
        const backupRemainingDays = ((backupMaxExpiry - now) / 86400).toFixed(1);

        log('INFO', `新Cookie有效期: ${newRemainingDays}天, 备份Cookie有效期: ${backupRemainingDays}天`);

        // 如果新 Cookie 有效期 < 7 天且备份的更长，说明自动登录拿到的是短期票据
        if (newMaxExpiry > 0 && newMaxExpiry - now < 7 * 86400) {
          log('WARN', `自动登录拿到的Cookie有效期过短（${newRemainingDays}天），疑似未通过2FA的短期票据`);
          if (backupMaxExpiry > newMaxExpiry) {
            log('WARN', '备份Cookie有效期更长，回滚以保护长期票据');
            await restoreAuthCookies(context, backupCookies);
            // 回滚后重新检测登录状态
            const stillLoggedIn = await checkLoginStatus(page, config);
            if (stillLoggedIn) {
              log('INFO', '回滚后Session仍然有效，继续签到');
            } else {
              log('ERROR', '回滚后Session也已过期，需手动重新登录');
              log('ERROR', '请运行 npm run init 手动登录');
              await screenshot(page, 'cookie_rollback_expired');
              await context.close();
              process.exit(1);
            }
          } else {
            log('WARN', '备份Cookie也已过期或不存在，使用新的短期Cookie继续');
          }
        } else if (newMaxExpiry > 0) {
          log('INFO', `新Cookie有效期正常（${newRemainingDays}天），保留使用`);
        }
      } else {
        if (!isInitMode) {
          log('ERROR', '自动登录失败，可能需要2FA验证');
          log('ERROR', '请运行 npm run init 手动登录');
          // 如果备份 Cookie 尚未过期，尝试回滚
          if (backupMaxExpiry > Date.now() / 1000) {
            log('INFO', '尝试回滚到备份Cookie...');
            await restoreAuthCookies(context, backupCookies);
            const stillLoggedIn = await checkLoginStatus(page, config);
            if (stillLoggedIn) {
              log('INFO', '回滚成功，备份Cookie仍然有效！继续签到');
            } else {
              await screenshot(page, 'auto_login_failed');
              await context.close();
              process.exit(1);
            }
          } else {
            await screenshot(page, 'auto_login_failed');
            await context.close();
            process.exit(1);
          }
        } else {
          // init 模式: 等待用户手动登录
          log('INFO', '需要手动登录...');
          const loginOk = await waitForLogin(page);
          if (!loginOk) {
            log('ERROR', '等待登录超时');
            await context.close();
            process.exit(1);
          }
          log('INFO', '登录成功！');
        }
      }
    } else {
      log('INFO', 'Session 有效，已登录');
    }

    // 导出 Cookie
    await saveCookies(context);

    // 执行签到
    log('INFO', '开始签到...');
    const success = await performCheckin(page, config);
    await screenshot(page, success ? 'checkin_success' : 'checkin_failed');

    await context.close();

    if (success) {
      markCheckedToday();
      log('INFO', '签到任务完成');
      process.exit(0);
    } else {
      log('ERROR', '签到失败，请检查截图');
      process.exit(1);
    }
  } catch (error) {
    log('ERROR', `运行出错: ${error.message}`);
    try { await context.close(); } catch {}
    process.exit(1);
  }
}

main();

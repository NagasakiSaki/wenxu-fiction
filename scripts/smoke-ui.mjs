// 无头浏览器冒烟测试：真正打开工作台，走一遍一键分章、分界校对与换肤。
// 纯函数测试覆盖不到弹窗接线与样式作用域，这里用 CDP 补上；不引入 Playwright。
// 用法：node scripts/smoke-ui.mjs [--serve] [--url http://127.0.0.1:4173/wenxu-fiction/]
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const url = value('--url') || 'http://127.0.0.1:4173/wenxu-fiction/';
const screenshotDir = value('--screenshots');
let server = null;
let chrome = null;

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

async function waitForServer(target, timeoutMs = 40_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(target);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw Error('预览服务没有在 40 秒内就绪');
}

async function findPage(port, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const page = list.find(item => item.type === 'page');
      if (page) return page;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('浏览器调试端口没有就绪');
}

function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const {resolve, reject} = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      events.push({type: 'exception', text: details?.exception?.description || details?.text || 'unknown'});
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      events.push({type: 'console', text: (message.params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ')});
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once: true});
    socket.addEventListener('error', () => reject(Error('无法连接浏览器调试协议')), {once: true});
  });
  const send = (method, params = {}) => {
    const id = nextId++;
    socket.send(JSON.stringify({id, method, params}));
    return new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
  };
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  return {ready, send, evaluate, events, close: () => socket.close()};
}

const steps = [];
async function step(name, fn) {
  const start = Date.now();
  await fn();
  steps.push({name, ms: Date.now() - start});
}

async function main() {
  if (flag('--serve')) {
    const vite = path.join('node_modules', 'vite', 'bin', 'vite.js');
    server = spawn(process.execPath, [vite, 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], {stdio: 'ignore'});
    await waitForServer(url);
  } else {
    await waitForServer(url);
  }

  const executable = value('--chrome') || findChrome();
  if (!executable) throw Error('没有找到 Chrome；请设置 CHROME_PATH');
  const port = 9500 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wenxu-smoke-'));
  chrome = spawn(executable, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
    '--window-size=1280,1000', 'about:blank'
  ], {stdio: 'ignore'});

  const page = await findPage(port);
  const client = connect(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false});

  try {
    await step('打开工作台', async () => {
      await client.send('Page.navigate', {url: `${url}#/studio`});
      await client.evaluate(`(async()=>{
        const start=Date.now();
        while(Date.now()-start<20000){
          if(document.querySelector('#smart-split-open')) return true;
          await new Promise(r=>setTimeout(r,80));
        }
        throw new Error('工作台没有渲染');
      })()`);
    });

    await step('一键分章出预览', async () => {
      const result = await client.evaluate(`(async()=>{
        const sleep=ms=>new Promise(r=>setTimeout(r,ms));
        const wait=async(selector,timeout=25000)=>{const start=Date.now();while(Date.now()-start<timeout){if(document.querySelector(selector))return true;await sleep(80);}return false;};
        document.querySelector('#smart-split-open').click();
        await sleep(300);
        const source=document.querySelector('#smart-source');
        source.value='paste'; source.dispatchEvent(new Event('change'));
        await sleep(100);
        const paragraph='雨点敲在瓦上，他抬头看了一眼远处的灯，没有说话。街上的人已经散尽，只剩一辆自行车靠在墙边。';
        document.querySelector('#smart-paste').value=Array.from({length:4},(_,i)=>[i+1+'、雨夜之'+(i+1),...Array(8).fill(paragraph)].join('\\n')).join('\\n')+'\\n回复\\n来自iPhone客户端';
        document.querySelector('#smart-run').click();
        if(!await wait('#smart-apply')) throw new Error('没有出现预览');
        return {chapters:document.querySelectorAll('.smart-chapter-list li').length, status:document.querySelector('#smart-status').textContent};
      })()`);
      if (result.chapters < 2) throw Error(`预览章节数异常：${result.chapters}`);
      if (!result.status.includes('分析完成')) throw Error(`状态异常：${result.status}`);
    });

    await step('分界校对可打开并核算', async () => {
      const result = await client.evaluate(`(async()=>{
        const sleep=ms=>new Promise(r=>setTimeout(r,ms));
        const wait=async(selector,timeout=10000)=>{const start=Date.now();while(Date.now()-start<timeout){if(document.querySelector(selector))return true;await sleep(80);}return false;};
        document.querySelector('#smart-boundary').click();
        if(!await wait('#review-list')) throw new Error('校对列表没有出现');
        await sleep(700);
        const rows=document.querySelectorAll('.review-row').length;
        const summary=document.querySelector('#review-summary').textContent;
        document.querySelector('#review-back').click();
        await wait('#smart-apply');
        return {rows, summary};
      })()`);
      if (!result.rows) throw Error('校对列表为空');
      if (!/覆盖核对/.test(result.summary)) throw Error(`校对核算异常：${result.summary}`);
    });

    await step('关闭弹窗与换肤', async () => {
      const result = await client.evaluate(`(async()=>{
        const sleep=ms=>new Promise(r=>setTimeout(r,ms));
        document.querySelector('#dialog [data-action="close"]')?.click();
        await sleep(200);
        const skin=document.querySelector('footer [data-action="skin"]');
        if(!skin) throw new Error('没有换肤按钮');
        skin.click(); await sleep(150);
        const first=document.documentElement.dataset.theme;
        skin.click(); await sleep(150);
        const second=document.documentElement.dataset.theme;
        return {first, second};
      })()`);
      if (result.first !== 'woodcut') throw Error(`首次切换没有进入版画：${result.first}`);
      if (result.second !== 'paper') throw Error(`再次切换没有回到纸墨：${result.second}`);
    });

    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, {recursive: true});
      const {data} = await client.send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(screenshotDir, 'smoke-studio.png'), Buffer.from(data, 'base64'));
    }

    const fatal = client.events.filter(event => event.type === 'exception');
    if (fatal.length) throw Error(`页面异常：${fatal.map(event => event.text).join(' | ')}`);
  } finally {
    client.close();
    chrome?.kill('SIGKILL');
    server?.kill('SIGKILL');
  }
}

const started = Date.now();
try {
  await main();
  console.log(`冒烟测试通过（${steps.length} 步，${Date.now() - started} ms）`);
  for (const item of steps) console.log(`  ✓ ${item.name} ${item.ms}ms`);
  process.exitCode = 0;
} catch (error) {
  console.log(`冒烟测试失败：${error.message}`);
  for (const item of steps) console.log(`  ✓ ${item.name} ${item.ms}ms`);
  process.exitCode = 1;
} finally {
  server?.kill('SIGKILL');
  chrome?.kill('SIGKILL');
  setTimeout(() => process.exit(process.exitCode ?? 1), 100);
}

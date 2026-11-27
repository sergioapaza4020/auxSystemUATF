const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const origin = 'http://127.0.0.1:4396';
const api = process.env.AUTH_API_ORIGIN;
const appDir = process.env.SEC1_BROWSER_APP_DIR;
const username = process.env.SEC1_FIXTURE_USERNAME;
const oldPassword = process.env.SEC1_FIXTURE_PASSWORD;
const newPassword = 'Árbol-fixture#2026';
assert.ok(appDir && username && oldPassword);
assert.match(api, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.AUTH_PUBLIC_ORIGIN, origin);

const profile = mkdtempSync(join(tmpdir(), 'uatf-sec1-browser-'));
const appEnv = { ...process.env, NODE_ENV: 'development' };
delete appEnv.JEST_WORKER_ID;
const next = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'dev', appDir, '-H', '127.0.0.1', '-p', '4396'],
  {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: appEnv,
  },
);
const edge = spawn(
  process.env.SEC1_BROWSER_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  [
    '--headless=new',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);

let socket;
let session;
let messageId = 0;
let patchCount = 0;
let refreshCount = 0;
let successResponse = false;
let loginResponse;
let stage = 'startup';
let nextDiagnostics = '';
next.stdout.resume();
next.stderr.on('data', (chunk) => {
  nextDiagnostics = (nextDiagnostics + chunk.toString()).slice(0, 2400);
});
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 65000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId: session }));
  });
}

async function handle(event) {
  const message = JSON.parse(String(event.data));
  if (message.id) {
    const request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error('DevTools command failed'));
      else request.resolve(message.result);
    }
    return;
  }
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params;
    const url = new URL(request.url);
    if ([origin, api].includes(url.origin)) {
      if (request.method === 'PATCH' && url.pathname === '/api/auth/me/password') {
        patchCount++;
        await delay(600);
      }
      if (successResponse && url.pathname === '/api/auth/refresh') refreshCount++;
      await send('Fetch.continueRequest', { requestId });
    } else if (!['blob:', 'data:'].includes(url.protocol)) {
      await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    } else {
      await send('Fetch.continueRequest', { requestId });
    }
  }
  if (
    message.method === 'Network.responseReceived' &&
    message.params.response.url.startsWith(api + '/api/auth/me/password') &&
    message.params.response.status === 200
  )
    successResponse = true;
  if (message.method === 'Network.responseReceived' && message.params.response.url === origin + '/api/auth/login') {
    loginResponse = message.params.response.status;
  }
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed');
  return result.result.value;
}

async function wait(expression) {
  for (let i = 0; i < 240; i++) {
    if (await evaluate(expression)) return;
    await delay(150);
  }
  throw new Error(`Expected UI did not appear: ${expression}`);
}

const contains = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
const button = (label, root = 'document') =>
  `[...${root}.querySelectorAll("button")].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
const dialog = 'document.querySelector("[role=dialog]")';

async function checkDialogWidths(mode) {
  for (const width of [320, 375, 430, 768, 1366]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 550, deviceScaleFactor: 1, mobile: false });
    await wait(`innerWidth===${width} && ${dialog}.getBoundingClientRect().left>0`);
    const dimensions = await evaluate(`(() => {
      const paper = ${dialog};
      const content = paper.querySelector('.MuiDialogContent-root');
      const actions = paper.querySelector('.MuiDialogActions-root');
      const { left, right } = paper.getBoundingClientRect();
      return { left, right, overflow: [paper, content, actions].map(e => e.scrollWidth - e.clientWidth),
        verticalScroll: content.scrollHeight > content.clientHeight };
    })()`);
    assert.ok(dimensions.left > 0 && dimensions.right < width, `${mode} ${width}px: dialog margins`);
    assert.deepEqual(dimensions.overflow, [0, 0, 0], `${mode} ${width}px: horizontal overflow`);
    if (width === 320) assert.ok(dimensions.verticalScroll, `${mode}: small viewport scrolls vertically`);
  }
}

async function click(expression) {
  assert.ok(await evaluate(`(()=>{const e=${expression};if(!e||e.disabled)return false;e.click();return true;})()`));
}

async function input(id, value) {
  assert.ok(
    await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,${JSON.stringify(value)});
    e.dispatchEvent(new Event("input",{bubbles:true}));return true;})()`),
  );
}

async function login(password) {
  await wait('document.readyState === "complete" && !!document.querySelector("#username")');
  await delay(2000);
  await input('username', username);
  await input('password', password);
  await click(button('Iniciar sesión'));
  await wait('location.pathname.startsWith("/dashboard")').catch(async (error) => {
    const alert = await evaluate('document.querySelector("[role=alert]")?.textContent ?? ""');
    throw new Error(`${error.message} (login HTTP ${loginResponse ?? 'not sent'}; ${alert})`);
  });
}

async function main() {
  for (let i = 0; i < 100 && !existsSync(join(profile, 'DevToolsActivePort')); i++) await delay(150);
  const [port, endpoint] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  socket.onmessage = (event) => void handle(event).catch(() => undefined);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const target = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await send('Page.enable');
  await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  let ready = false;
  let status;
  for (let i = 0; i < 150; i++) {
    try {
      const response = await fetch(origin + '/login', { signal: AbortSignal.timeout(60000) });
      status = response.status;
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Next is starting. */
    }
    if (status >= 500) break;
    await delay(150);
  }
  if (!ready) throw new Error(`Next.js did not serve the login page (HTTP ${status ?? 'unavailable'}).`);
  stage = 'initial login';
  await send('Page.navigate', { url: origin + '/login' });
  await login(oldPassword);
  await send('Page.navigate', { url: origin + '/dashboard/account-settings' });
  await wait('!!' + button('Cambiar contraseña'));
  stage = 'account section navigation';
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 620, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const profileLink = 'document.querySelector(\'a[href="#account-profile-section"]\')';
  const securityLink = 'document.querySelector(\'a[href="#account-security-section"]\')';

  await wait(profileLink + '?.getAttribute("aria-current")==="location"');
  const name = await evaluate('document.querySelector("#profile-name").value');
  await input('profile-name', 'Nombre sin guardar');
  await evaluate(securityLink + '.focus()');
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r',
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(securityLink + '.getAttribute("aria-current")==="location"');
  assert.equal(await evaluate('document.activeElement.id'), 'account-security-section');
  assert.ok(
    await evaluate(`document.querySelector('#account-security').getBoundingClientRect().top >=
    ${securityLink}.closest('nav').getBoundingClientRect().bottom - 1`),
  );
  assert.ok(await evaluate(`Math.abs(${securityLink}.closest('nav').getBoundingClientRect().top) <= 1`));
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await evaluate('window.scrollTo({top: 0, behavior: "instant"})');
  await wait(profileLink + '.getAttribute("aria-current")==="location"');
  assert.equal(await evaluate('document.querySelector("#profile-name").value'), 'Nombre sin guardar');
  assert.ok(await evaluate('!!' + button('Cambiar foto')));
  assert.ok(await evaluate(contains('Sesiones activas')));
  await input('profile-name', name);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await click(securityLink);
  await wait(securityLink + '.getAttribute("aria-current")==="location"');
  await click(profileLink);
  await wait(profileLink + '.getAttribute("aria-current")==="location"');
  await wait(`document.querySelector('#account-profile-section').getBoundingClientRect().top >=
    ${profileLink}.closest('nav').getBoundingClientRect().bottom - 1`);
  const pageTimeOrigin = await evaluate('performance.timeOrigin');

  await send('Emulation.clearDeviceMetricsOverride');
  await send('Page.navigate', { url: origin + '/dashboard/account-settings' });
  await wait(`performance.timeOrigin !== ${pageTimeOrigin} && !!${button('Cambiar contraseña')}`);
  stage = 'dialog and keyboard';
  await click(button('Cambiar contraseña'));
  await wait('!!' + dialog);
  await wait('document.activeElement.id==="currentPassword"');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await wait('document.activeElement.getAttribute("aria-label")==="Mostrar contraseña actual"');
  assert.ok(await evaluate(button('Actualizar contraseña', dialog) + '.disabled'));
  assert.equal(await evaluate('document.querySelectorAll("[role=dialog] input[type=password]").length'), 3);
  await input('currentPassword', oldPassword);
  await input('newPassword', 'corta');
  await wait(contains('1 de 5 requisitos cumplidos'));
  await input('newPassword', newPassword);
  await wait(contains('5 de 5 requisitos cumplidos'));
  await input('confirmation', 'different');
  await wait(contains('Las contraseñas no coinciden.'));
  assert.ok(await evaluate(button('Actualizar contraseña', dialog) + '.disabled'));
  await input('confirmation', newPassword);
  await wait(contains('Las contraseñas coinciden.'));
  await evaluate('document.querySelector(\'button[aria-label="Mostrar nueva contraseña"]\').focus()');
  assert.ok(await evaluate('document.activeElement.getAttribute("aria-label")==="Mostrar nueva contraseña"'));
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r',
  });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait('document.querySelector("#newPassword").type==="text"');
  await click(button('Cancelar', dialog));
  await wait('!' + dialog);
  assert.equal(patchCount, 0);
  await click(button('Cambiar contraseña'));
  await wait('!!' + dialog);
  assert.ok(
    await evaluate('[...document.querySelectorAll("[role=dialog] input")].every(e=>!e.value&&e.type==="password")'),
  );
  await checkDialogWidths('light');
  await click(button('Cancelar', dialog));
  await wait('!' + dialog);
  await click('document.querySelector(\'button[aria-label="Cambiar a modo oscuro"]\')');
  await wait('!!document.querySelector(\'button[aria-label="Cambiar a modo claro"]\')');
  stage = 'real password change';
  await click(button('Cambiar contraseña'));
  await wait('!!' + dialog);
  await checkDialogWidths('dark');
  await input('currentPassword', 'incorrecta');
  await input('newPassword', newPassword);
  await input('confirmation', newPassword);
  await click(button('Actualizar contraseña', dialog));
  await wait('!!document.querySelector(".MuiAlert-message")');
  await evaluate('document.querySelector(".MuiAlert-message").textContent += " " + "MensajeExtenso".repeat(25)');
  await checkDialogWidths('dark with long error');
  await input('currentPassword', oldPassword);
  await input('newPassword', newPassword);
  await input('confirmation', newPassword);
  await wait('!' + button('Actualizar contraseña', dialog) + '.disabled');
  await evaluate(`(()=>{const b=${button('Actualizar contraseña', dialog)};b.click();b.click()})()`);
  await wait('!!document.querySelector(\'[aria-label="Actualizando contraseña"]\')');
  await wait('location.pathname==="/login"');
  assert.equal(patchCount, 2);
  assert.equal(refreshCount, 0);
  assert.ok(successResponse);
  stage = 'login with the new password';
  await login(newPassword);
  console.log('SEC-1 browser passed: real login, dialog, password update, logout and new login.');
}

main()
  .catch((error) => {
    console.error(`${stage}: ${error.message}`);
    if (stage === 'startup' || stage === 'initial login') {
      console.error(
        nextDiagnostics.replaceAll(oldPassword, '[secret]').replaceAll(process.env.AUTH_TRANSPORT_KEY, '[secret]'),
      );
    }
    process.exitCode = 1;
  })
  .finally(() => {
    socket?.close();
    edge.kill();
    next.kill();
  });

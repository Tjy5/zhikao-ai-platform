import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.VISUAL_SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const shouldManagePreview = !process.env.VISUAL_SMOKE_BASE_URL;
const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const routes = ['/', '/writing', '/history', '/settings'];

const authenticatedRoutes = new Set(['/writing', '/history']);

const smokeAuthToken = 'visual-smoke-token';
const smokeAuthUser = {
  id: 9001,
  username: 'visual-smoke',
  email: 'visual-smoke@example.com',
  is_active: true,
};

const smokeHistoryItems = [
  {
    id: 'writing-smoke-1',
    timestamp: '2026-05-08T08:00:00Z',
    type: 'writing',
    taskType: 'analysis',
    score: 84.5,
  },
  {
    id: 'writing-smoke-2',
    timestamp: '2026-05-08T09:15:00Z',
    type: 'writing',
    taskType: 'format-writing',
    score: 79,
  },
];

const authenticatedRouteMarkers = {
  '/writing': ['输入区域', '开始AI批改', '批改结果'],
  '/history': ['历史复盘', '最近记录', '评分明细'],
};

const unknownRoutes = [
  '/archived',
  '/archived/session',
  '/legacy-flow',
  '/profile',
  '/internal-dashboard',
  '/internal-dashboard?from=legacy-flow',
];

const unexpectedRouteText = [
  'Legacy workflow module',
  'Archived control panel',
  'Internal-only report',
  'Hidden profile workflow',
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();

  socket.addEventListener('message', event => {
    const payload = JSON.parse(event.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolve(payload.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return {
    ready,
    send(method, params = {}, sessionId) {
      const messageId = ++id;
      socket.send(
        JSON.stringify({
          id: messageId,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        })
      );
      return new Promise((resolve, reject) => {
        pending.set(messageId, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

function waitForExit(processHandle) {
  return new Promise(resolve => {
    if (processHandle.exitCode !== null) {
      resolve();
      return;
    }
    processHandle.once('exit', resolve);
  });
}

async function isServerReady() {
  try {
    const response = await fetch(baseUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(processHandle) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (processHandle.exitCode !== null) {
      throw new Error(
        `Preview exited early with code ${processHandle.exitCode}`
      );
    }
    if (await isServerReady()) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Preview server was not ready at ${baseUrl}`);
}

async function ensurePreviewServer() {
  if (!shouldManagePreview || (await isServerReady())) {
    return null;
  }

  const preview = spawn(
    process.execPath,
    [
      './node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
    ],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let stderr = '';
  preview.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer(preview);
    return preview;
  } catch (error) {
    preview.kill('SIGTERM');
    await waitForExit(preview);
    throw new Error(`${error.message}. stderr: ${stderr}`);
  }
}

async function stopPreviewServer(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  processHandle.kill('SIGTERM');
  await waitForExit(processHandle);
}

async function waitForDebugUrl(processHandle) {
  let stderr = '';
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Chrome DevTools URL not found. stderr: ${stderr}`));
    }, 15000);

    processHandle.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    processHandle.on('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited before ready with code ${code}`));
    });
  });
}

async function evaluatePage(route, viewport) {
  const userDataDir = join(
    tmpdir(),
    `visual-smoke-${process.pid}-${viewport.name}-${route.replace(/\W/g, '_')}`
  );
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    'about:blank',
  ]);

  try {
    const wsUrl = await waitForDebugUrl(chrome);
    const client = createCdpClient(wsUrl);
    await client.ready;
    const { targetId } = await client.send('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await client.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    await client.send(
      'Emulation.setDeviceMetricsOverride',
      {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.name === 'mobile' ? 2 : 1,
        mobile: viewport.name === 'mobile',
      },
      sessionId
    );
    const isAuthenticatedRoute = authenticatedRoutes.has(route);
    const requiredMarkers = authenticatedRouteMarkers[route] || [];
    if (isAuthenticatedRoute) {
      await client.send(
        'Page.addScriptToEvaluateOnNewDocument',
        {
          source: `(() => {
            const authPayload = {
              value: {
                accessToken: ${JSON.stringify(smokeAuthToken)},
                tokenType: 'bearer',
              },
              expiresAt: Date.now() + 60 * 60 * 1000,
            };
            const smokeUser = ${JSON.stringify(smokeAuthUser)};
            const smokeHistoryItems = ${JSON.stringify(smokeHistoryItems)};
            const originalFetch = window.fetch.bind(window);
            const jsonResponse = (body, init = {}) =>
              new Response(JSON.stringify(body), {
                ...init,
                headers: {
                  'Content-Type': 'application/json',
                  ...(init.headers || {}),
                },
              });
            window.localStorage.setItem(
              'writing_feedback_auth_token',
              JSON.stringify(authPayload)
            );
            window.fetch = (input, init) => {
              const rawUrl =
                typeof input === 'string'
                  ? input
                  : input && typeof input === 'object' && 'url' in input
                    ? input.url
                    : String(input);
              if (rawUrl.includes('/api/v1/auth/me')) {
                return Promise.resolve(jsonResponse(smokeUser));
              }
              if (
                rawUrl.includes('/api/v1/writings/history') &&
                rawUrl.includes('?limit=50')
              ) {
                return Promise.resolve(
                  jsonResponse({ items: smokeHistoryItems })
                );
              }
              return originalFetch(input, init);
            };
          })();`,
        },
        sessionId
      );
    }
    await client.send(
      'Page.navigate',
      { url: `${baseUrl}${route}` },
      sessionId
    );
    await client.send(
      'Runtime.evaluate',
      {
        awaitPromise: true,
        returnByValue: true,
        expression: `new Promise(resolve => {
          const finish = () => requestAnimationFrame(() => resolve(true));
          if (document.readyState === 'complete') finish();
          else window.addEventListener('load', finish, { once: true });
        })`,
      },
      sessionId
    );
    const fontProbeTargets =
      route === '/'
        ? [
            { key: 'navBrand', selector: 'header a[href="/"]' },
            { key: 'homeHeroTitle', selector: '#home-hero-title' },
            { key: 'homeEyebrow', selector: '.font-semi-cursive' },
            { key: 'homeSealMark', selector: '.seal-mark' },
          ]
        : [
            { key: 'navBrand', selector: 'header a[href="/"]' },
            { key: 'primaryHeading', selector: 'h1' },
            { key: 'shellSealMark', selector: '.seal-mark' },
          ];

    const { result } = await client.send(
      'Runtime.evaluate',
      {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
        const body = document.body;
        const root = document.documentElement;
        const hasReducedMotionRule = Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules || []).some(rule => String(rule.cssText).includes('prefers-reduced-motion'));
          } catch {
            return false;
          }
        });
        const fontTargets = ${JSON.stringify(fontProbeTargets)};
        const captureFontMetric = selector => {
          const el = document.querySelector(selector);
          if (!el || !el.getClientRects().length) return null;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            selector,
            text: (el.textContent || '').trim().slice(0, 80),
            width: Number(rect.width.toFixed(2)),
            height: Number(rect.height.toFixed(2)),
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          };
        };
        const fontBaseline = Object.fromEntries(
          fontTargets.map(({ key, selector }) => [key, captureFontMetric(selector)])
        );
        await new Promise(resolve => setTimeout(resolve, 750));
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
        const fontCurrent = Object.fromEntries(
          fontTargets.map(({ key, selector }) => [key, captureFontMetric(selector)])
        );
        const fontShiftDeltas = Object.entries(fontCurrent)
          .map(([key, after]) => {
            const before = fontBaseline[key];
            if (!before || !after) return null;
            return {
              key,
              widthDelta: Number(Math.abs(after.width - before.width).toFixed(2)),
              heightDelta: Number(Math.abs(after.height - before.height).toFixed(2)),
              fontFamilyChanged: before.fontFamily !== after.fontFamily,
            };
          })
          .filter(Boolean);
        const fontShiftDetected = fontShiftDeltas.some(
          delta =>
            delta.widthDelta > 1 ||
            delta.heightDelta > 1 ||
            delta.fontFamilyChanged
        );
        const target = document.querySelector('a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
        let focusOutline = '';
        if (target) {
          target.focus();
          await new Promise(resolve => requestAnimationFrame(() => resolve()));
          const style = getComputedStyle(target);
          focusOutline = [style.outlineStyle, style.outlineWidth, style.boxShadow].join(' ');
        }
        const text = body.innerText || '';
        const requiredMarkers = ${JSON.stringify(requiredMarkers)};
        const pageMarkersOk = requiredMarkers.every(marker =>
          text.includes(marker)
        );
        const externalFontSheets = Array.from(document.styleSheets).filter(
          sheet =>
            sheet.href &&
            (sheet.href.includes('fonts.googleapis.com') ||
              sheet.href.includes('fonts.gstatic.com'))
        );
        return {
          route: ${JSON.stringify(route)},
          viewport: ${JSON.stringify(viewport.name)},
          authenticated: ${isAuthenticatedRoute},
          requiredMarkers,
          pageMarkersOk,
          textLength: text.length,
          textSample: text.slice(0, 160),
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
          interactiveCount: document.querySelectorAll('a[href],button,input,textarea,select').length,
          focusVisible: focusOutline.includes('rgb') || focusOutline.includes('hsl') || focusOutline.includes('px'),
          hasReducedMotionRule,
          noExternalFontStylesheets: externalFontSheets.length === 0,
          fontShiftDetected,
          fontShiftDeltas,
          fontReadyState: document.fonts.status,
        };
      })()`,
      },
      sessionId
    );

    await client.send('Target.closeTarget', { targetId });
    client.close();
    return result.value;
  } finally {
    chrome.kill('SIGKILL');
    await waitForExit(chrome);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

let previewServer = null;

try {
  previewServer = await ensurePreviewServer();

  const results = [];
  for (const route of routes) {
    for (const viewport of viewports) {
      results.push(await evaluatePage(route, viewport));
    }
  }

  const unknownRouteResults = [];
  for (const route of unknownRoutes) {
    for (const viewport of viewports) {
      unknownRouteResults.push(await evaluatePage(route, viewport));
    }
  }

  const failures = results.filter(
    result =>
      result.textLength === 0 ||
      result.horizontalOverflow ||
      result.interactiveCount === 0 ||
      !result.focusVisible ||
      !result.hasReducedMotionRule ||
      !result.noExternalFontStylesheets ||
      result.fontShiftDetected ||
      (result.authenticated && !result.pageMarkersOk) ||
      unexpectedRouteText.some(text => result.textSample.includes(text))
  );

  const unknownRouteFailures = unknownRouteResults.filter(result =>
    unexpectedRouteText.some(text => result.textSample.includes(text))
  );

  console.log(
    JSON.stringify(
      {
        baseUrl,
        results,
        unknownRouteResults,
        failures,
        unknownRouteFailures,
      },
      null,
      2
    )
  );

  if (failures.length || unknownRouteFailures.length) {
    process.exitCode = 1;
  }
} finally {
  await stopPreviewServer(previewServer);
}

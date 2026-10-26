import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Real Chromium DOM without adding jsdom/playwright or changing dependencies.
export async function browserCheck(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'bon-modal-test-'));
  try {
    const result = await build({ stdin: { contents: source, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
    writeFileSync(join(dir, 'test.js'), result.outputFiles[0].text);
    writeFileSync(join(dir, 'index.html'), '<html><body><script src="test.js"></script></body></html>');
    if (existsSync('intro.mp4')) {
      try { symlinkSync(resolve('intro.mp4'), join(dir, 'intro.mp4')); } catch {}
    }
    const html = execFileSync('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-proxy-server', `--user-data-dir=${dir}/profile`, '--allow-file-access-from-files', '--virtual-time-budget=10000', '--dump-dom', `file://${dir}/index.html`], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    const match = html.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    return match?.[1] ?? html;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
export const browserPrelude = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const host = document.createElement('main'); document.body.append(host);
const root = createRoot(host);
const render = node => flushSync(() => root.render(node));
const finish = message => { const result = document.createElement('pre'); result.id='result'; result.textContent=message; document.body.append(result); };
`;

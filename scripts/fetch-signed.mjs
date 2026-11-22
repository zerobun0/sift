// Copyright (c) 2026 zerobun. All rights reserved.
// Downloads an AMO-signed version when 'web-ext sign' loses the connection while waiting (it happened on 0.1.0).
// Usage (keys from ../.env.amo in the env): node scripts/fetch-signed.mjs artifacts/sift-<v>.xpi   (version read from package.json)
import { createHmac, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const jwt = () => { const iat = Math.floor(Date.now() / 1000); const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64({ iss: process.env.WEB_EXT_API_KEY, jti: randomUUID(), iat, exp: iat + 60 });
  return `${h}.${p}.${createHmac('sha256', process.env.WEB_EXT_API_SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const get = (u) => fetch(u, { headers: { Authorization: `JWT ${jwt()}` } });
const r = await get('https://addons.mozilla.org/api/v5/addons/addon/sift@zerobun.com/versions/v${JSON.parse((await import('node:fs')).readFileSync(new URL('../package.json', import.meta.url))).version}/');
const v = await r.json();
console.log(r.status, v.version, v.file?.status, v.channel, v.file?.url ? 'has url' : JSON.stringify(v).slice(0, 300));
if (v.file?.status === 'public' && v.file.url) {
  const f = await get(v.file.url); const buf = Buffer.from(await f.arrayBuffer());
  writeFileSync(process.argv[2], buf); console.log('saved', buf.length, 'bytes');
}

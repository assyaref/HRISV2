/**
 * test-action-contract.mjs
 * ========================
 * Guard otomatis kontrak FACE ACTION:
 * setiap action yang dikirim frontend (faceClient.ts) HARUS punya
 * `case '<action>'` di GAS Router.gs. Mismatch seperti faceEnroll vs
 * Router lama tertangkap di sini SEBELUM deploy, bukan di production.
 *
 * Jalankan: node scripts/test-action-contract.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const faceClient = readFileSync(join(root, 'src/services/faceClient.ts'), 'utf8');
const router = readFileSync(join(root, 'GAS - HRIS/Router.gs'), 'utf8');

// 1. Kumpulkan action yang dikirim frontend
const sentActions = [...faceClient.matchAll(/faceCall\('([A-Za-z]+)'/g)].map((m) => m[1]);

// 2. Kumpulkan case yang dikenali Router
const backendCases = [...router.matchAll(/case '([A-Za-z]+)'/g)].map((m) => m[1]);
const backendSet = new Set(backendCases);

// 3. Canonical actions wajib ada di backend
const canonical = ['faceEnroll', 'faceStatus', 'faceVerifyLive', 'faceDiagnose', 'faceDeactivate'];

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}`);
};

for (const a of new Set(sentActions)) {
  check(`frontend action "${a}" ada di Router.gs`, backendSet.has(a));
}
for (const a of canonical) {
  check(`canonical action "${a}" terdaftar di Router.gs`, backendSet.has(a));
}
check('Router punya handler FaceTemplateService.enroll untuk faceEnroll',
  /case 'faceEnroll':[\s\S]{0,200}?FaceTemplateService\.enroll/.test(router));
check('Router punya handler FaceTemplateService.verifyLive untuk faceVerifyLive',
  /case 'faceVerifyLive':[\s\S]{0,200}?FaceTemplateService\.verifyLive/.test(router));
check('UNKNOWN_ACTION tidak dipetakan ke FACE_NOT_REGISTERED',
  !/UNKNOWN_ACTION[\s\S]{0,120}FACE_NOT_REGISTERED/.test(router));

console.log(`\nACTION CONTRACT RESULT: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error('\nDaftar case Router.gs:', backendCases.join(', '));
  process.exit(1);
}
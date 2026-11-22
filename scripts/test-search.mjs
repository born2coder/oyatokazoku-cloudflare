import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findGuides, prepareGuideIndex } from '../static/guide-search.js';

const entries = JSON.parse(fs.readFileSync(new URL('../dist/assets/search.json', import.meta.url), 'utf8'));
const index = prepareGuideIndex(entries);
const expectedFirstResults = {
  '退院 介護できない': '/hospitalization/chapter-3/#before-going-home',
  '退院したのに家で介護できない': '/hospitalization/chapter-3/#before-going-home',
  '退院した後に一人でトイレに行けない': '/hospitalization/chapter-3/#before-going-home',
  '入院費が払えない': '/hospitalization/cost/#hospital-payment',
  '差額ベッド代': '/hospitalization/cost/',
  '物忘れ 病院に行かない': '/care/memory-and-visit/#family-only',
  '夜中に何度も起きて寝不足': '/care/night-care/#tonight',
  '介護 眠れない': '/care/night-care/#tonight',
  '兄弟 介護 手伝わない': '/care/chapter-6/#family-replies',
  '親が亡くなった 葬儀社': '/funeral/chapter-2/#first-call',
  '葬儀代が払えない': '/funeral/chapter-2/#payment',
  '葬儀代　払えない': '/funeral/chapter-2/#payment',
  '葬儀 見積もり': '/funeral/chapter-5/#itemized-quote',
  '母が亡くなり父が一人になった': '/funeral/surviving-parent/#first-evening',
  '督促状がきた': '/inheritance/chapter-3/#notice',
  '親の借金がわからない': '/inheritance/chapter-3/#check-assets',
  '借金が分からず相続放棄の期限が近い': '/inheritance/renunciation/#time-extension',
  '賃貸 亡くなった': '/estate-clearance/chapter-1/#rental-deadline',
  '遺品 片付けられない': '/estate-clearance/chapter-1/#first-visit',
  '親が施設に入った 実家どうする': '/family-home/chapter-7/#before-a-sale',
  '空き家 売れない': '/family-home/chapter-4/',
};

for (const [query, expected] of Object.entries(expectedFirstResults)) {
  const hits = findGuides(query, index);
  assert.equal(hits[0]?.url, expected, query);
  const pageUrls = hits.map(entry => entry.url.split('#')[0]);
  assert.equal(new Set(pageUrls).size, pageUrls.length, `Duplicate results for ${query}`);
  assert.ok(hits.every(entry => entry.summary), `Missing result description for ${query}`);
}

// The text of guides, in addition to the curated topics, remains searchable.
assert.ok(findGuides('連帯保証', index).some(entry => entry.url === '/inheritance/assets/'));
assert.ok(findGuides('ﾏｲﾅ保険証', index).some(entry => entry.url === '/hospitalization/cost/'));
assert.deepEqual(findGuides('プラネタリウム', index), []);
assert.deepEqual(findGuides('　？　', index), []);
console.log(`PASS: ${Object.keys(expectedFirstResults).length + 4} search queries, including sentence searches, guide text and direct section links.`);

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
const commonWords = new Set(['これ', 'それ', 'こと', 'ため', 'のに', 'ので', 'とき', '場合', 'です', 'ます', 'した', 'して', 'する', 'いる', 'ある', 'なっ', 'れた', 'たい', 'どう', '何', 'うち', 'いい', '良い']);

function normalize(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
}

const compact = value => normalize(value).replaceAll(' ', '');

export function prepareGuideIndex(entries) {
  return entries.map(entry => ({
    entry,
    title: compact(entry.title),
    keywords: (entry.keywords || []).map(compact),
    headings: (entry.headings || []).map(compact),
    summary: compact(entry.summary),
    body: compact(entry.text || ''),
  }));
}

function queryTerms(query) {
  if (!segmenter) return query.split(' ');
  return [...new Set([...segmenter.segment(query)]
    .filter(({ isWordLike, segment }) => isWordLike && !commonWords.has(segment)
      && (segment.length > 1 || /[\p{Script=Han}\d]/u.test(segment)))
    .map(({ segment }) => segment))];
}

function matchScore(row, phrase, groups) {
  if (row.title === phrase) return 120;
  if (row.keywords.some(keyword => keyword === phrase)) return 115;
  if (row.title.includes(phrase)) return 100;
  if (row.keywords.some(keyword => keyword.includes(phrase))) return 95;
  if (row.headings.some(heading => heading.includes(phrase))) return 89;
  if (row.summary.includes(phrase)) return 86;
  const phraseInBody = row.body.includes(phrase);
  let best = phraseInBody ? 42 : 0;
  for (const terms of groups) {
    if (terms.length < 2) continue;
    const weights = terms.map(term => {
      if (row.title.includes(term)) return 12;
      if (row.keywords.some(keyword => keyword.includes(term))) return 10;
      if (row.headings.some(heading => heading.includes(term))) return 8;
      if (row.summary.includes(term)) return 7;
      return row.body.includes(term) ? 3 : 0;
    });
    if (weights.includes(0)) continue;
    const average = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    best = Math.max(best, Math.round(29 + average * 4));
  }
  return best;
}

export function findGuides(input, index) {
  const query = normalize(input);
  const phrase = query.replaceAll(' ', '');
  if (!phrase) return [];
  const groups = [query.split(' '), queryTerms(query)];
  const ranked = index.map(row => ({ row, score: matchScore(row, phrase, groups) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  return ranked.flatMap(({ row }) => {
    // Show the best link per article, even when several of its sections match.
    const page = row.entry.url.split('#')[0];
    if (seen.has(page)) return [];
    seen.add(page);
    return [row.entry];
  });
}

function attachSearch(input) {
  const status = document.getElementById('search-status');
  const list = document.getElementById('search-results');
  const scriptUrl = new URL(import.meta.url);
  const indexUrl = new URL('search.json', scriptUrl);
  indexUrl.search = scriptUrl.search;
  const limit = 12;
  let indexPromise;

  function loadIndex() {
    indexPromise ??= fetch(indexUrl).then(response => {
      if (!response.ok) throw new Error('Could not load search index');
      return response.json();
    }).then(prepareGuideIndex).catch(error => {
      indexPromise = undefined;
      throw error;
    });
    return indexPromise;
  }

  let request = 0;
  async function render() {
    const current = ++request;
    const query = input.value.trim();
    list.replaceChildren();
    if (!query) {
      status.textContent = '';
      return;
    }
    status.textContent = '記事を探しています…';
    try {
      const index = await loadIndex();
      if (current !== request) return;
      const matches = findGuides(query, index);
      if (!matches.length) {
        status.textContent = '見つかりませんでした。「退院」「葬儀代」のように短い言葉でも探せます。';
        return;
      }
      status.textContent = matches.length > limit
        ? `${matches.length}件のうち、関連の高い${limit}件を表示しています。`
        : `${matches.length}件の記事が見つかりました。`;
      for (const match of matches.slice(0, limit)) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        const summary = document.createElement('p');
        link.href = match.url;
        link.textContent = match.title;
        summary.textContent = match.summary;
        item.append(link, summary);
        list.append(item);
      }
    } catch {
      if (current === request) status.textContent = '検索を読み込めませんでした。下の「困っていること」か、テーマ一覧から探せます。';
    }
  }

  input.addEventListener('input', render);
  if (input.value.trim()) render();
}

if (typeof document !== 'undefined') {
  const input = document.getElementById('guide-search');
  if (input) attachSearch(input);
}

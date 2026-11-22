import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const pages = JSON.parse(fs.readFileSync(path.join(root, 'content', 'pages.json'), 'utf8'));
const actions = JSON.parse(fs.readFileSync(path.join(root, 'content/actions.json'), 'utf8'));
const searchTopics = JSON.parse(fs.readFileSync(path.join(root, 'content/search-topics.json'), 'utf8'));
const output = path.join(root, 'dist');
const origin = 'https://oyatokazoku.com';
const siteName = '親のこと、家族のこと。';
const byId = new Map(pages.map((page) => [Number(page.ID), page]));
const staticDir = path.join(root, 'static');

function version(...values) {
  const hash = createHash('sha256');
  for (const value of values) hash.update(value);
  return hash.digest('hex').slice(0, 12);
}

const cssVersion = version(fs.readFileSync(path.join(staticDir, 'site.css')));
const scriptVersion = version(fs.readFileSync(path.join(staticDir, 'site.js')));

function pagePath(page) {
  if (Number(page.ID) === 8 || page.post_name === 'home') return '/';
  const segments = [page.post_name];
  let parent = byId.get(Number(page.post_parent));
  const seen = new Set([Number(page.ID)]);
  while (parent && !seen.has(Number(parent.ID))) {
    seen.add(Number(parent.ID));
    segments.unshift(parent.post_name);
    parent = byId.get(Number(parent.post_parent));
  }
  return `/${segments.filter(Boolean).join('/')}/`;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function wrapArticleTables(content) {
  // Accept the wrappers in the older articles as well as bare tables.
  const tables = /<div class="(?:table-scroll|oy-tablewrap|care-table-wrap)"\s*>\s*(<table\b[^>]*>[\s\S]*?<\/table>)\s*<\/div>|(<table\b[^>]*>[\s\S]*?<\/table>)/gi;
  return content.replace(tables, (_, wrapped, bare) =>
    `<div class="table-scroll" role="region" aria-label="表の表示領域" tabindex="0">${wrapped || bare}</div>`);
}

function cleanArticleBody(page) {
  let content = page.post_content
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')
    .replace(/<header class="(?:ec-head|fh-head|oy-head|oy-header|oy-shared-head|pc-head)">[\s\S]*?<\/header>/gi, '')
    .replace(/<footer class="(?:care-foot|ec-foot|fh-foot|oy-foot|oy-footer|pc-foot)">[\s\S]*?<\/footer>/gi, '')
    .replace(/<\/?main\b[^>]*>/gi, '')
    .replaceAll('http://www.oyatokazoku.com', '')
    .replaceAll('https://www.oyatokazoku.com', '')
    .replaceAll('http://oyatokazoku.com', '')
    .replaceAll('https://oyatokazoku.com', '');

  if (page.post_name === 'privacy-policy') {
    content = content
      .replace(/<li>お問い合わせ時に利用者が入力した氏名、メールアドレス、問い合わせ内容等<\/li>/g, '')
      .replace(/<p>戸籍、医療情報、財産内容などの機微な情報を、通常のお問い合わせ欄へ記載しないようお願いいたします。<\/p>/g, '')
      .replace(/<li>お問い合わせへの回答および必要な連絡<\/li>/g, '')
      .replace(/<p>具体的な手続きや連絡先は、本サイト内のお問い合わせ窓口でご案内します。<\/p>/g, '<p>本サイトは現在、利用者が個人情報を入力して送信する問い合わせフォームを設置していません。</p>')
      .replace(/<section class="oy-section"><h2>お問い合わせ<\/h2>[\s\S]*?<\/section>/g, '');
  }
  if (page.post_name === 'about') {
    content = content.replace(
      '<div class="oy-label">このサイトについて</div>',
      '<div class="oy-label">サイトの考え方</div>',
    );
  }
  // One shared title and breadcrumb; original article sections retain their anchors.
  const article = content.replace(/<!--[^]*?-->/g, '').replace(/<h1\b[^>]*>[^]*?<\/h1>/i, '').trim();
  return wrapArticleTables(article);
}

function cleanContent(page) {
  const content = cleanArticleBody(page);
  const action = actions[page.ID];
  const title = `<h1>${escapeHtml(Number(page.ID) === 8 ? siteName : page.post_title)}</h1>`;
  const parent = byId.get(Number(page.post_parent));
  const crumb = Number(page.ID) === 8 ? '' : `<nav class="breadcrumb" aria-label="パンくず"><a href="/">ホーム</a>${parent ? ` / <a href="${pagePath(parent)}">${escapeHtml(parent.post_title)}</a>` : ''} / <span>${escapeHtml(page.post_title)}</span></nav>`;
  const lead = page.intro ? `<p class="scene-lead">${escapeHtml(page.intro)}</p>` : '';
  const first = action ? `<section class="first-step" aria-labelledby="first-step-title"><h2 id="first-step-title">まず、今日すること</h2><p>${escapeHtml(action[0])}</p><h3>相談するときは</h3><blockquote>${escapeHtml(action[1])}</blockquote><h3>話が進まないときは</h3><p>${escapeHtml(action[2])}</p><a href="/tools/?topic=${encodeURIComponent(page.post_title)}&question=${encodeURIComponent(action[1])}#questions">この質問を相談メモに入れる →</a></section>` : '';
  const jumps = page.jumps?.length ? `<nav class="guide-jumps" aria-label="このページの案内">${page.jumps.map(([id, label]) => `<a href="#${escapeHtml(id)}">${escapeHtml(label)} ↓</a>`).join('')}</nav>` : '';
  const [year, month, day] = page.post_modified.slice(0, 10).split('-').map(Number);
  const edited = `<p class="editorial-date">記事の更新日：${year}年${month}月${day}日。制度の確認日は該当箇所に記載しています。</p>`;
  return `${crumb}${title}${lead}${jumps}${first}<div class="article-body">${content}</div>${edited}`;
}

function plainText(value) {
  return value.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"').replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

function description(page, content) {
  if (pagePath(page) === '/') {
    return '親の入院、介護、葬儀、相続、遺品整理、実家じまい。家族が困ったときに、次に確認することを順番に整理した実用ガイドです。';
  }
  const text = page.summary || (actions[page.ID] ? `${page.post_title}。${actions[page.ID][0]} ${actions[page.ID][2]}` : plainText(content));
  return text.length > 150 ? `${text.slice(0, 149).replace(/[、。\s]+$/u, '')}…` : text;
}

// Topic entries let a reader land on the section that answers a specific question.
// Article entries also index the body so terms outside the curated topics are searchable.
const searchEntries = [
  ...searchTopics,
  ...pages.filter(page => actions[page.ID]).map(page => {
    const body = cleanArticleBody(page);
    const headings = [...body.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)]
      .map(match => plainText(match[1]));
    return {
      title: page.post_title,
      url: pagePath(page),
      summary: page.summary || actions[page.ID][0],
      headings,
      text: plainText(body),
    };
  }),
];
const searchIndex = JSON.stringify(searchEntries);
const searchVersion = version(fs.readFileSync(path.join(staticDir, 'guide-search.js')), searchIndex);

function globalHeader(route) {
  const links = [
    ['/#guides', 'ガイド一覧'],
    ['/tools/', '相談・費用メモ'],
    ['/about/', 'このサイトについて'],
    ['/faq/', 'よくある質問'],
    ['/news/', 'お知らせ'],
  ];
  const nav = links.map(([href, label]) => {
    const active = href !== '/#guides' && route === href ? ' aria-current="page"' : '';
    return `<a href="${href}"${active}>${label}</a>`;
  }).join('');
  return `<header class="oy-global-header"><div class="oy-global-header__inner"><a class="oy-global-logo" href="/">「${siteName}」</a><nav class="oy-global-nav" aria-label="メインナビゲーション">${nav}</nav></div></header>`;
}

function globalFooter() {
  return `<footer class="oy-global-footer"><div class="oy-global-footer__inner"><p>本サイトは情報提供を目的としており、個別の診断・法律・税務・契約判断の仲介は行いません。</p><nav class="oy-global-footer__links" aria-label="フッターナビゲーション"><a href="/">サイトTOP</a><a href="/about/">このサイトについて</a><a href="/faq/">よくある質問</a><a href="/news/">お知らせ</a><a href="/privacy-policy/">プライバシーポリシー</a></nav><p class="oy-global-copyright">© 「${siteName}」</p></div></footer>`;
}

function documentFor(page) {
  const route = pagePath(page);
  const content = cleanContent(page);
  const home = route === '/';
  const title = home ? `${siteName}｜家族が困った瞬間に、次の一歩を` : `${page.post_title}｜${siteName}`;
  const desc = description(page, content);
  const canonical = `${origin}${route}`;
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': home ? 'WebSite' : 'WebPage',
    name: title,
    url: canonical,
    description: desc,
    inLanguage: 'ja',
    ...(home ? {} : { dateModified: `${page.post_modified.replace(' ', 'T')}+09:00`, isPartOf: { '@type': 'WebSite', name: siteName, url: `${origin}/` } }),
  }).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="google-site-verification" content="yUgHySgCEWybicqixE-WaU7Q769IpXdFN2IawkTachE">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${home ? 'website' : 'article'}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
  <script type="application/ld+json">${schema}</script>
</head>
<body><a class="skip-link" href="#main">本文へ進む</a>${globalHeader(route)}<main id="main">${content}</main>${globalFooter()}<script src="/assets/site.js?v=${scriptVersion}" defer></script>${home ? `<script type="module" src="/assets/guide-search.js?v=${searchVersion}"></script>` : ''}</body>
</html>\n`;
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'static', 'site.css'), path.join(output, 'assets', 'site.css'));
fs.copyFileSync(path.join(root, 'static', 'site.js'), path.join(output, 'assets', 'site.js'));
fs.copyFileSync(path.join(staticDir, 'guide-search.js'), path.join(output, 'assets', 'guide-search.js'));
fs.copyFileSync(path.join(root, 'static', 'favicon.svg'), path.join(output, 'favicon.svg'));

const manifest = [];
for (const page of pages) {
  const route = pagePath(page);
  const relative = route === '/' ? '' : route.slice(1, -1);
  const directory = path.join(output, relative);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), documentFor(page));
  manifest.push({ id: Number(page.ID), path: route, title: page.post_title, modified: page.post_modified });
}

fs.writeFileSync(path.join(output, 'assets/search.json'), searchIndex);
const sitemap = manifest.map((page) => `  <url><loc>${origin}${page.path}</loc><lastmod>${page.modified.slice(0, 10)}</lastmod></url>`).join('\n');
fs.writeFileSync(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap}\n</urlset>\n`);
fs.writeFileSync(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(path.join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
fs.writeFileSync(path.join(output, '_redirects'), `/index.php / 301\n/home/ / 301\n`);
fs.writeFileSync(path.join(output, '404.html'), `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ページが見つかりません｜${siteName}</title><link rel="stylesheet" href="/assets/site.css?v=${cssVersion}"></head><body>${globalHeader('')}<main class="not-found"><p class="code">404</p><h1>ページが見つかりません</h1><p>URLが変わったか、ページが存在しない可能性があります。</p><a href="/">サイトTOPへ戻る</a></main>${globalFooter()}</body></html>`);
fs.writeFileSync(path.join(root, 'page-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${manifest.length} pages.`);

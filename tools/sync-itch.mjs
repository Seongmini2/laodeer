/*
  itch.io 개발일지 가져오기
  ─────────────────────────
  data/games.js 에서 itch 주소가 있는 게임마다
    1) <itch 주소>/devlog.rss 로 글 목록을 읽고
    2) 새 글이면 글 페이지에서 본문 전체를 가져와
    3) 안전한 태그만 남겨 data/itch.js 에 저장합니다.

  그림은 itch.io 이미지 서버(img.itch.zone) 주소를 그대로 써서 itch와 똑같이 보여요.

  실행: node tools/sync-itch.mjs          (새 글만)
        node tools/sync-itch.mjs --all    (이미 가져온 글도 다시)
  GitHub Actions(.github/workflows/sync-itch.yml)가 6시간마다 자동으로 실행해요.
*/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "itch.js");
const FORCE = process.argv.includes("--all");
const UA = "site-devlog-sync/1.0";

const HEADER = `/*
  itch.io 개발일지 (자동으로 만들어지는 파일이에요. 직접 고치지 마세요.)
  tools/sync-itch.mjs 가 data/games.js 의 itch 주소를 보고 채웁니다.
  GitHub에서는 6시간마다 자동으로 새 글을 가져와요.
*/
`;

function loadData(file, v) {
  return fs.readFile(file, "utf8").then((text) => {
    const w = {};
    new Function("window", text)(w);
    return w[v];
  }).catch(() => null);
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&");
}

function tagText(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "");
}

/* 한국 시간 기준 날짜 */
function kstDate(pub) {
  const d = new Date(new Date(pub).getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/* ---------- 본문 정리: 허용한 태그와 속성만 남김 ---------- */

const ALLOWED = {
  p: [], br: [], hr: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  strong: [], b: [], em: [], i: [], u: [], s: [], del: [], code: [], pre: [], blockquote: [],
  ul: [], ol: [], li: [], figure: [], figcaption: [], details: [], summary: [],
  a: ["href"], img: ["src", "alt"], span: ["class"]
};
const VOID = new Set(["br", "hr", "img"]);

function cleanUrl(u) {
  u = decode(u).trim();
  return /^https:\/\//i.test(u) ? u.replace(/"/g, "%22") : "";
}

function sanitize(html) {
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|form|button)[\s\S]*?<\/\1>/gi, "")
    .replace(/<iframe[^>]*\ssrc="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, (m, src) => {
      const u = cleanUrl(src.startsWith("//") ? "https:" + src : src);
      return u ? `<p><a href="${u}">영상 보기</a></p>` : "";
    });
  html = html.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (m, close, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!ALLOWED[tag]) return "";
    if (close) return VOID.has(tag) ? "" : `</${tag}>`;
    let out = "";
    attrs.replace(/([a-zA-Z_:-]+)\s*=\s*"([^"]*)"/g, (_, name, val) => {
      name = name.toLowerCase();
      if (!ALLOWED[tag].includes(name)) return;
      if (name === "href" || name === "src") { const u = cleanUrl(val); if (u) out += ` ${name}="${u}"`; }
      else if (name === "class") { if (/\bspoiler\b/.test(val)) out += ' class="spoiler"'; }
      else out += ` ${name}="${val.replace(/"/g, "&quot;")}"`;
    });
    if (tag === "a") out += ' target="_blank" rel="noopener"';
    if (tag === "img") out += ' loading="lazy"';
    return `<${tag}${out}>`;
  });
  // 빈 문단, 빈 제목 정리
  for (let i = 0; i < 3; i++) html = html.replace(/<(p|h[1-6]|figure|span)>\s*(<br>\s*)*<\/\1>/g, "");
  return html.replace(/\s{2,}/g, " ").trim();
}

function excerpt(html, n = 150) {
  const t = decode(html.replace(/<details[\s\S]*?<\/details>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
}

/* ---------- 글 하나 ---------- */

async function readPost(link) {
  const page = await get(link);
  const start = page.search(/<section class="[^"]*\bpost_body\b[^"]*"/);
  if (start < 0) throw new Error("본문을 찾지 못함: " + link);
  const open = page.indexOf(">", start) + 1;
  const end = page.indexOf("</section>", open);
  const body = sanitize(page.slice(open, end));
  // 글 맨 위 대표 그림 (원본 크기 링크)
  const head = page.slice(0, start);
  const cover = (head.match(/<a[^>]+href="(https:\/\/img\.itch\.zone\/[^"]+\/original\/[^"]+)"[^>]*>\s*<img[^>]*class="post_image"/) || [])[1] || "";
  return { html: body, cover: cover ? cleanUrl(cover) : "" };
}

/* ---------- 실행 ---------- */

const games = (await loadData(path.join(ROOT, "data", "games.js"), "LAODEER_GAMES")) || [];
const before = (await loadData(OUT, "LAODEER_ITCH")) || [];
const byId = new Map(before.map((p) => [p.id, p]));
let added = 0, failed = 0;

for (const g of games.filter((x) => x.itch)) {
  const base = g.itch.replace(/\/(devlog(\.rss)?)?\/?$/, "");
  let rss;
  try { rss = await get(base + "/devlog.rss"); }
  catch (e) { console.error(`[${g.id}] 피드를 읽지 못했어요: ${e.message}`); failed++; continue; }
  const items = rss.split("<item>").slice(1);
  for (const item of items) {
    const link = decode(tagText(item, "link")).trim();
    const num = (link.match(/\/devlog\/(\d+)/) || [])[1];
    if (!num) continue;
    const id = "itch-" + num;
    if (byId.has(id) && !FORCE) { byId.get(id).game = g.id; continue; }
    const thumb = (tagText(item, "description").match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
    try {
      const post = await readPost(link);
      byId.set(id, {
        id,
        game: g.id,
        date: kstDate(tagText(item, "pubDate")),
        title: decode(tagText(item, "title")).trim(),
        link,
        cover: post.cover || cleanUrl(thumb),
        excerpt: excerpt(post.html),
        html: post.html
      });
      added++;
      console.log(`[${g.id}] 가져옴: ${decode(tagText(item, "title"))}`);
    } catch (e) {
      console.error(`[${g.id}] 글을 읽지 못했어요: ${e.message}`);
      failed++;
    }
  }
}

const list = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
const text = HEADER + "window.LAODEER_ITCH = " + JSON.stringify(list, null, 2) + ";\n";
let old = "";
try { old = await fs.readFile(OUT, "utf8"); } catch (e) {}
if (old.replace(/\r\n/g, "\n") !== text) {
  await fs.writeFile(OUT, text);
  console.log(`data/itch.js 저장: 글 ${list.length}개 (새로 ${added}개)`);
} else {
  console.log("바뀐 글이 없어요.");
}
if (failed && !added && !list.length) process.exitCode = 1;

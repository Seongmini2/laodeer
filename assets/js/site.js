/* LaoDeer: 데이터(data/*.js)를 읽어 각 페이지를 그리는 스크립트 */
(function () {
  "use strict";

  var RECORDS = (window.LAODEER_RECORDS || []).slice();
  var GAMES = window.LAODEER_GAMES || [];
  var STUDIO = window.LAODEER_STUDIO || {};
  var TYPES = { "개발일지": "devlog", "생각": "thought", "그림": "drawing" };
  var FILTERS = ["전체", "개발일지", "생각", "그림"];
  var NAV = [
    ["HOME", "index.html", "home"],
    ["ABOUT", "about.html", "about"],
    ["GAMES", "games.html", "games"],
    ["DEVLOG", "devlog.html", "devlog"],
    ["PRESS KIT", "presskit.html", "presskit"],
    ["SOCIALS", "socials.html", "socials"],
    ["FAQ", "faq.html", "faq"]
  ];

  /* ---------- 준비 ---------- */

  /* itch.io 개발일지 (tools/sync-itch.mjs 가 만든 data/itch.js) 를 기록에 합침 */
  (window.LAODEER_ITCH || []).forEach(function (p) {
    RECORDS.push({
      id: p.id, date: p.date, type: "개발일지", title: p.title, body: p.excerpt || p.title,
      html: p.html || "", cover: p.cover, link: p.link, game: p.game, source: "itch"
    });
  });

  /* 여기서 직접 쓴 기록과 itch에서 가져온 글의 제목이 같으면, 본문이 더 온전한 itch 글만 보여줌 */
  (function () {
    function norm(t) { return String(t || "").toLowerCase().replace(/\s+/g, " ").trim(); }
    var itchTitles = {};
    RECORDS.forEach(function (r) { if (r.source === "itch") itchTitles[norm(r.title)] = true; });
    RECORDS = RECORDS.filter(function (r) { return r.source === "itch" || !r.title || !itchTitles[norm(r.title)]; });
  })();

  RECORDS.forEach(function (r, i) {
    r._i = i;
    if (!TYPES[r.type]) console.warn("[LaoDeer] 알 수 없는 분류:", r.type, r);
  });
  RECORDS = RECORDS.filter(function (r) { return r.date && TYPES[r.type] && r.body; });
  RECORDS.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a._i - b._i; });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function findGame(id) {
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
    return null;
  }
  function findRecord(id) {
    for (var i = 0; i < RECORDS.length; i++) if (RECORDS[i].id === id) return RECORDS[i];
    return null;
  }
  function isSoon(g) { return g.status === "공개 예정"; }
  function parseDate(d) {
    var p = String(d).split("-");
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function longDate(d) { var t = parseDate(d); return t.y + "년 " + t.m + "월 " + t.d + "일"; }

  /* 본문 → 블록: 빈 줄로 문단, "- " 줄은 목록 */
  function blocks(text) {
    return String(text).trim().split(/\n\s*\n/).filter(Boolean).map(function (chunk) {
      var lines = chunk.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length && lines.every(function (l) { return /^[-•]\s+/.test(l); })) {
        return { list: lines.map(function (l) { return l.replace(/^[-•]\s+/, ""); }) };
      }
      return { p: lines.join("\n") };
    });
  }
  function renderBlocks(bs, listHeading) {
    var headed = false;
    return bs.map(function (b) {
      if (b.list) {
        var h = "";
        if (listHeading && !headed) { h = '<p class="list-head">' + listHeading + "</p>"; headed = true; }
        return h + '<ul class="changes">' + b.list.map(function (li) { return "<li>" + esc(li) + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + esc(b.p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }
  function splitFirstSentence(text) {
    var m = String(text).match(/^[\s\S]*?[.!?。…](?=\s|$)/);
    if (!m) return [text, ""];
    return [m[0], text.slice(m[0].length).trim()];
  }

  function img(src, alt, eager) {
    return '<img src="' + esc(src) + '" alt="' + esc(alt || "") + '"' +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
  }
  function zoomable(src, alt, caption, eager) {
    return '<button type="button" class="zoom" data-src="' + esc(src) + '" data-caption="' + esc(caption || "") +
      '" aria-label="크게 보기: ' + esc(alt || caption || "이미지") + '">' + img(src, alt, eager) + "</button>";
  }
  function gameLink(r, ctxGame) {
    if (!r.game || ctxGame) return "";
    var g = findGame(r.game);
    if (!g) return "";
    return '<p class="rel">관련 게임 <a href="game.html?id=' + encodeURIComponent(g.id) + '">' + esc(g.title) + "</a></p>";
  }
  function exampleMark(o) { return o && o.example ? '<span class="ex" title="교체할 예시 자료">예시</span>' : ""; }
  function pageHead(title, ko) {
    return '<section class="phead dark"><h1 class="big-title">' + esc(title) + "</h1>" + (ko ? '<p class="phead-ko">' + esc(ko) + "</p>" : "") + "</section>";
  }

  /* ---------- 머리와 발 ---------- */

  function logoHTML() {
    if (STUDIO.logo) return '<img class="mark-img" src="' + esc(STUDIO.logo) + '" alt="LaoDeer">';
    var i = 0;
    function ch(c) { return '<span aria-hidden="true" style="--i:' + (i++) + '">' + c + "</span>"; }
    return ch("L") + ch("A") + '<span class="moon" aria-hidden="true" style="--i:' + (i++) + '"></span>' + ch("D") + ch("E") + ch("E") + ch("R");
  }
  function renderChrome(page) {
    var head = $("header"), foot = $("footer");
    var current = page === "game" ? "games" : page;
    if (head) {
      head.outerHTML =
        '<header class="site">' +
          '<nav class="site-nav" id="site-nav" aria-label="사이트">' +
            NAV.map(function (n) {
              return '<a href="' + n[1] + '"' + (n[2] === current ? ' aria-current="page"' : "") + ">" + n[0] + "</a>";
            }).join("") +
          "</nav>" +
          '<a class="mark" href="index.html" aria-label="LaoDeer 홈" data-split="1">' + logoHTML() + "</a>" +
          '<button type="button" class="menu-btn" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span><b class="sr">메뉴</b></button>' +
        "</header>";
      var btn = document.querySelector(".menu-btn");
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        document.documentElement.classList.toggle("menu-open", open);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.documentElement.classList.contains("menu-open")) btn.click();
      });
    }
    if (foot) {
      foot.outerHTML =
        '<footer class="site">' +
          '<div class="foot-brand"><span class="foot-mark">LaoDeer</span>' +
            (STUDIO.slogan ? '<span class="foot-slogan">' + esc(STUDIO.slogan.en) + "</span>" : "") + "</div>" +
        "</footer>";
    }
  }

  /* ---------- 태그 ---------- */

  function tagsHTML(r) {
    var tags = r.tags || [];
    if (!tags.length) return "";
    return '<p class="tags">' + tags.map(function (t) {
      return '<a class="tag-link" href="devlog.html?tag=' + encodeURIComponent(t) + '" data-tag="' + esc(t) + '">#' + esc(t) + "</a>";
    }).join("") + "</p>";
  }

  /* ---------- itch.io 에서 가져온 글 ---------- */

  function zoomifyHTML(h, caption) {
    return String(h).replace(/<img\b[^>]*?\ssrc="([^"]+)"[^>]*>/g, function (m, src) {
      return zoomable(src.replace(/&amp;/g, "&"), caption, caption, false);
    });
  }
  function renderItch(r, opts) {
    var dt = parseDate(r.date), rid = "more-" + r._i;
    var html = tagsHTML(r) + "<h3>" + esc(r.title) + "</h3>" +
      (r.cover ? '<figure class="shot">' + zoomable(r.cover, r.title, r.title, opts.index === 0 && !opts.lazy) + "</figure>" : "") +
      '<p class="lede itch-lede">' + esc(r.body) + "</p>" +
      (r.html ? '<div class="more post-html" id="' + rid + '" hidden>' + zoomifyHTML(r.html, r.title) + "</div>" : "") +
      '<p class="itch-actions">' +
        (r.html ? '<button class="read" type="button" aria-expanded="false" aria-controls="' + rid + '">이어 읽기</button>' : "") +
        (r.link ? '<a class="itch-link" href="' + esc(r.link) + '" target="_blank" rel="noopener">itch.io에서 보기</a>' : "") +
      "</p>" + gameLink(r, opts.game);
    var meta = '<div class="meta"><time datetime="' + esc(r.date) + '">' + dt.m + "월 " + dt.d + "일</time>" +
      '<span class="kind">개발일지</span><span class="src-itch">itch.io</span></div>';
    return '<article class="entry devlog itch" tabindex="-1" id="' + esc(r.id) + '"><div class="body">' + html + "</div>" + meta + "</article>";
  }

  /* ---------- 기록 한 개 ---------- */

  function renderRecord(r, opts) {
    if (r.source === "itch") return renderItch(r, opts);
    var kind = TYPES[r.type];
    var dt = parseDate(r.date);
    var first = opts.index === 0 && !opts.lazy;
    var html = "";
    var body = blocks(r.body);
    var cls = "entry " + kind;
    var firstLine = r.body.split("\n")[0];

    if (kind === "drawing") {
      if (r.image) {
        html += '<figure class="plate">' + zoomable(r.image, r.alt || firstLine, firstLine, first) +
          "<figcaption>" + renderBlocks(body) + gameLink(r, opts.game) + "</figcaption></figure>";
      } else {
        html += '<div class="note">' + renderBlocks(body) + gameLink(r, opts.game) + "</div>";
      }
    } else if (kind === "devlog") {
      html += r.title ? "<h3>" + esc(r.title) + "</h3>" : "";
      if (r.image) html += '<figure class="shot">' + zoomable(r.image, r.alt || r.title || "개발 화면 스크린샷", r.title || firstLine, first) + "</figure>";
      html += renderBlocks(body, "바꾼 점") + gameLink(r, opts.game);
    } else {
      var parts = splitFirstSentence(r.body);
      var isShort = !r.title || !parts[1];
      if (isShort) {
        cls += " short";
        html += (r.title ? "<h3>" + esc(r.title) + "</h3>" : "") + renderBlocks(body);
      } else {
        var rid = "more-" + r._i;
        html += "<h3>" + esc(r.title) + "</h3>" +
          '<p class="lede">' + esc(parts[0]) + "</p>" +
          '<div class="more" id="' + rid + '" hidden>' + renderBlocks(blocks(parts[1])) + "</div>" +
          '<button class="read" type="button" aria-expanded="false" aria-controls="' + rid + '">이어 읽기</button>';
      }
      if (r.image) html += '<figure class="shot">' + zoomable(r.image, r.alt || r.title || "", r.title || "", false) + "</figure>";
      html += gameLink(r, opts.game);
    }

    var meta = '<div class="meta"><time datetime="' + esc(r.date) + '">' + dt.m + "월 " + dt.d + "일</time>" +
      '<span class="kind">' + esc(r.type) + "</span>" + exampleMark(r) + "</div>";

    return '<article class="' + cls + '" tabindex="-1"' + (r.id ? ' id="' + esc(r.id) + '"' : "") + '><div class="body">' + tagsHTML(r) + html + "</div>" + meta + "</article>";
  }

  function renderFeed(el, list, opts) {
    opts = opts || {};
    if (!list.length) {
      el.innerHTML = '<p class="empty">' + (opts.emptyText || "아직 이 분류의 기록이 없어요.") + "</p>";
      return;
    }
    var out = "", lastMonth = "";
    list.forEach(function (r, i) {
      var dt = parseDate(r.date), key = dt.y + "-" + dt.m;
      if (key !== lastMonth) {
        out += '<h2 class="month">' + dt.y + "년 " + dt.m + "월</h2>";
        lastMonth = key;
      }
      out += renderRecord(r, { index: i, game: opts.game, lazy: opts.lazy });
    });
    el.innerHTML = out;
  }

  var activeTransition = null;
  function transition(fn) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce || activeTransition) return fn();
    activeTransition = document.startViewTransition(fn);
    activeTransition.finished.finally(function () { activeTransition = null; });
  }

  function setupFilters(nav, feed, source, opts) {
    var available = FILTERS.filter(function (f) {
      return f === "전체" || source.some(function (r) { return r.type === f; });
    });
    nav.innerHTML = available.map(function (f) {
      return '<button type="button" data-f="' + f + '">' + f + "</button>";
    }).join("");

    var current = "전체";
    var tagBar = opts.tagBar;
    var currentTag = opts.useHash ? (new URLSearchParams(location.search).get("tag") || "") : "";

    function counts() {
      var c = {};
      source.forEach(function (r) { (r.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
      return c;
    }
    function drawTagBar() {
      if (!tagBar) return;
      var c = counts();
      var tags = Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b, "ko"); });
      if (currentTag && !c[currentTag]) tags.unshift(currentTag);
      tagBar.hidden = !tags.length;
      tagBar.innerHTML = tags.map(function (t) {
        return '<button type="button" class="tag" data-tag="' + esc(t) + '" aria-pressed="' + (t === currentTag) + '">#' + esc(t) +
          (c[t] ? " <small>" + c[t] + "</small>" : "") + "</button>";
      }).join("") + (currentTag ? '<button type="button" class="tag-clear" data-tag="">태그 해제</button>' : "");
    }
    function draw() {
      var f = current, t = currentTag;
      [].forEach.call(nav.querySelectorAll("button"), function (b) {
        b.setAttribute("aria-pressed", b.dataset.f === f ? "true" : "false");
      });
      drawTagBar();
      var list = source.filter(function (r) {
        return (f === "전체" || r.type === f) && (!t || (r.tags || []).indexOf(t) >= 0);
      });
      renderFeed(feed, list, t && !list.length ? Object.assign({}, opts, { emptyText: "#" + esc(t) + " 태그가 붙은 기록이 아직 없어요." }) : opts);
    }
    function syncUrl() {
      if (!opts.useHash) return;
      history.replaceState(null, "", location.pathname +
        (currentTag ? "?tag=" + encodeURIComponent(currentTag) : "") +
        (current !== "전체" ? "#" + encodeURIComponent(current) : ""));
    }
    function apply(f, push) {
      if (available.indexOf(f) < 0) f = "전체";
      current = f;
      if (push) transition(draw); else draw();
      if (push) syncUrl();
    }
    function setTag(t) {
      currentTag = currentTag === t ? "" : t;
      transition(draw);
      syncUrl();
    }
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b) apply(b.dataset.f, true);
    });
    if (tagBar) {
      tagBar.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-tag]");
        if (b) setTag(b.dataset.tag);
      });
      // 기록 안의 #태그를 누르면 페이지를 다시 열지 않고 바로 거름
      feed.addEventListener("click", function (e) {
        var a = e.target.closest("a.tag-link");
        if (!a) return;
        e.preventDefault();
        currentTag = "";
        setTag(a.dataset.tag);
        tagBar.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }

    var hash = opts.useHash ? decodeURIComponent(location.hash.slice(1)) : "";
    if (hash && FILTERS.indexOf(hash) < 0) {
      apply("전체", false);
      var target = document.getElementById(hash);
      if (target) {
        var more = target.querySelector("button.read");
        if (more) more.click();
        target.scrollIntoView();
        target.focus({ preventScroll: true });
      }
      return;
    }
    apply(hash || "전체", false);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("button.read");
    if (!b) return;
    var more = document.getElementById(b.getAttribute("aria-controls"));
    var open = b.getAttribute("aria-expanded") === "true";
    more.hidden = open;
    var lede = b.closest(".entry") && b.closest(".entry").querySelector(".itch-lede");
    if (lede) lede.hidden = !open; // itch 글은 펼치면 요약 대신 본문 전체를 보여줌
    b.setAttribute("aria-expanded", open ? "false" : "true");
    b.textContent = open ? "이어 읽기" : "접기";
  });

  /* ---------- 게임 카드 (홈, GAMES) ---------- */

  function gameCards(list, opts) {
    opts = opts || {};
    return '<ul class="cards">' + list.map(function (g, i) {
      if (isSoon(g)) {
        return '<li class="card soon"><div class="card-art soon-art" aria-hidden="true"><span class="soon-shine"></span></div>' +
          '<p class="card-title">' + esc(g.title || "Coming Soon..") + "</p></li>";
      }
      var href = "game.html?id=" + encodeURIComponent(g.id);
      return '<li class="card">' +
        '<a class="card-link" href="' + href + '">' +
          '<span class="card-art tilt">' + (g.image ? img(g.image, g.alt || g.title, i < 3 && opts.eager) : "") + '<span class="glare" aria-hidden="true"></span></span>' +
          '<span class="card-title">' + esc(g.title) + "</span>" +
        "</a>" +
        (g.intro ? '<p class="card-intro">“' + esc(g.intro) + "”</p>" : "") +
        (opts.status && g.status ? '<p class="card-status">' + esc(g.status) + (g.devPeriod ? " " + esc(g.devPeriod) : "") + "</p>" : "") +
        '<a class="more-btn" href="' + href + '" aria-label="' + esc(g.title) + ' 더 보기">more..</a>' +
        exampleMark(g) +
      "</li>";
    }).join("") + "</ul>";
  }

  /* ---------- 페이지 ---------- */

  function initHome(main) {
    var s = STUDIO.slogan || {};
    main.innerHTML =
      '<section class="hero" aria-label="LaoDeer">' +
        '<div class="hero-bg" aria-hidden="true">' + (STUDIO.heroImage ? '<img src="' + esc(STUDIO.heroImage) + '" alt="" fetchpriority="high">' : "") + "</div>" +
        '<div class="hero-text">' +
          (s.en ? '<p class="slogan-en">' + esc(s.en) + "</p>" : "") +
          (s.ko ? '<p class="slogan-ko">' + esc(s.ko) + "</p>" : "") +
        "</div>" +
        '<a class="hero-cue" href="#our-games" aria-label="아래로"><span></span></a>' +
      "</section>" +
      '<section class="ourgames dark" id="our-games" aria-labelledby="og-title">' +
        '<h2 class="big-title" id="og-title">OUR GAMES</h2>' +
        gameCards(GAMES, { eager: true }) +
      "</section>" +
      '<section class="page recent" aria-labelledby="recent-title">' +
        '<h2 class="band" id="recent-title">최근 작업 기록</h2>' +
        '<div class="feed" id="feed"></div>' +
        '<p class="recent-more"><a class="btn" href="devlog.html">작업 기록 모두 보기</a></p>' +
      "</section>";
    renderFeed($("feed"), RECORDS.slice(0, 4), { lazy: true });
  }

  function initDevlog(main) {
    main.innerHTML = pageHead("DEVLOG", "작업 기록") +
      '<section class="page"><nav class="filters" id="filters" aria-label="기록 분류"></nav>' +
      '<nav class="tagbar" id="tagbar" aria-label="태그로 보기" hidden></nav><div class="feed" id="feed" aria-live="polite"></div></section>';
    setupFilters($("filters"), $("feed"), RECORDS, { useHash: true, tagBar: $("tagbar") });
  }

  function initGames(main) {
    main.innerHTML = '<section class="ourgames dark full" aria-labelledby="g-title"><h1 class="big-title" id="g-title">OUR GAMES</h1>' +
      (GAMES.length ? gameCards(GAMES, { eager: true, status: true }) : '<p class="empty">아직 등록한 게임이 없어요.</p>') + "</section>";
  }

  /* 인게임 갤러리: 이미지와 유튜브 영상. 큰 화면 한 칸 + 썸네일 줄.
     영상은 처음엔 썸네일과 재생 버튼만 보여주고, 누르면 그 자리에서 재생(youtube-nocookie). */
  var YT = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
  function ytId(u) { var m = String(u || "").match(YT); return m ? m[1] : ""; }
  function ytThumb(id) { return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"; }

  function shotsHTML(g, shots) {
    if (!shots.length) return "";
    var n = 0, v = 0;
    return '<div class="shots" aria-label="' + esc(g.title) + ' 인게임 이미지와 영상">' +
      '<figure class="shot-main"><div class="shot-stage"></div>' +
        (shots.length > 1 ? '<button type="button" class="shot-nav prev" data-step="-1" aria-label="이전">‹</button>' +
          '<button type="button" class="shot-nav next" data-step="1" aria-label="다음">›</button>' +
          '<span class="shot-count" aria-live="polite">1 / ' + shots.length + "</span>" : "") +
      "</figure>" +
      (shots.length > 1 ? '<div class="shot-thumbs">' + shots.map(function (src, i) {
        var id = ytId(src);
        var label = id ? "영상 " + (++v) + " 보기" : "인게임 이미지 " + (++n) + " 보기";
        return '<button type="button" class="shot-thumb' + (id ? " is-video" : "") + '" data-i="' + i + '" aria-label="' + label + '" aria-pressed="' + (i === 0) + '">' +
          img(id ? ytThumb(id) : src, "", i < 4) + (id ? '<span class="thumb-play" aria-hidden="true"></span>' : "") + "</button>";
      }).join("") + "</div>" : "") +
    "</div>";
  }

  function bindShots(g, shots) {
    var box = document.querySelector(".shots");
    if (!box) return;
    var stage = box.querySelector(".shot-stage");
    var thumbs = [].slice.call(box.querySelectorAll(".shot-thumb"));
    var strip = box.querySelector(".shot-thumbs");
    var count = box.querySelector(".shot-count");
    var cur = 0;
    function render(i, first) {
      var src = shots[i], id = ytId(src);
      stage.classList.toggle("is-video", !!id);
      stage.innerHTML = id
        ? '<button type="button" class="yt-facade" data-yt="' + id + '" aria-label="영상 재생: ' + esc(g.title) + '">' +
            '<img src="' + ytThumb(id) + '" alt="" decoding="async"' + (first ? ' fetchpriority="high"' : "") + '><span class="yt-play" aria-hidden="true"></span>' +
            (location.protocol === "file:" ? '<span class="yt-note">내 PC에서 열어서 유튜브 새 탭으로 재생돼요</span>' : "") + "</button>"
        : zoomable(src, g.title + " 인게임 이미지 " + (i + 1), g.title, !!first);
    }
    function show(i) {
      cur = (i + shots.length) % shots.length;
      render(cur);
      thumbs.forEach(function (t, k) { t.setAttribute("aria-pressed", String(k === cur)); });
      if (count) count.textContent = (cur + 1) + " / " + shots.length;
      var t = thumbs[cur];
      if (t && strip) strip.scrollTo({ left: t.offsetLeft - strip.clientWidth / 2 + t.clientWidth / 2, behavior: "smooth" });
    }
    box.addEventListener("click", function (e) {
      var f = e.target.closest(".yt-facade");
      if (f && location.protocol === "file:") {
        window.open("https://www.youtube.com/watch?v=" + f.dataset.yt, "_blank", "noopener");
        return;
      }
      if (f) {
        stage.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + f.dataset.yt + '?autoplay=1&rel=0&playsinline=1" title="' + esc(g.title) + ' 영상" ' +
          'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        return;
      }
      var t = e.target.closest(".shot-thumb");
      if (t) return show(+t.dataset.i);
      var n = e.target.closest(".shot-nav");
      if (n) show(cur + (+n.dataset.step));
    });
    render(0, true);
  }

  function initGame(main) {
    var id = new URLSearchParams(location.search).get("id");
    var g = id ? findGame(id) : GAMES.filter(function (x) { return !isSoon(x); })[0];
    if (!g || isSoon(g)) {
      main.innerHTML = pageHead("GAMES") + '<section class="page"><p class="empty">이 주소의 게임을 찾지 못했어요. <a href="games.html">게임 목록으로 돌아가기</a></p></section>';
      return;
    }
    document.title = g.title + " | LaoDeer";
    var facts = [["상태", g.status], ["출시일", g.released], ["개발 기간", g.devPeriod], ["플랫폼", (g.platforms || []).join(", ")]]
      .filter(function (f) { return f[1]; });
    var shots = (g.screenshots || []).filter(Boolean);
    main.innerHTML =
      '<section class="stage"><div class="game" id="game">' +
        '<p class="back"><a href="games.html">게임 목록</a></p>' +
        (g.image ? '<figure class="key"><span class="tilt soft">' + img(g.image, g.alt || g.title, true) + '<span class="glare" aria-hidden="true"></span></span></figure>' : "") +
        '<div class="game-body' + (shots.length ? " has-shots" : "") + '">' +
        '<div class="game-text">' +
          "<h1>" + esc(g.title) + exampleMark(g) + "</h1>" +
          (g.intro ? '<p class="intro">' + esc(g.intro) + "</p>" : "") +
          (facts.length ? '<dl class="facts">' + facts.map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" : "") +
          '<p class="stores">' + (g.stores || []).map(function (s) {
            return '<a class="store" href="' + esc(s.url) + '" rel="noopener">' + esc(s.label) + "</a>";
          }).join("") + '<a class="store ghost" href="presskit.html#' + encodeURIComponent(g.id) + '">프레스 킷</a></p>' +
        "</div>" +
        shotsHTML(g, shots) +
        "</div>" +
      "</div></section>" +
      '<section class="page game-records" id="game-records" aria-labelledby="gr-title">' +
        '<h2 class="band" id="gr-title">이 게임을 만들며 남긴 기록</h2>' +
        '<nav class="filters" id="filters" aria-label="기록 분류"></nav>' +
        '<nav class="tagbar" id="tagbar" aria-label="태그로 보기" hidden></nav>' +
        '<div class="feed" id="feed" aria-live="polite"></div>' +
      "</section>";
    bindShots(g, shots);
    var mine = RECORDS.filter(function (r) { return r.game === g.id; });
    setupFilters($("filters"), $("feed"), mine, { game: g, useHash: false, tagBar: $("tagbar"), emptyText: "이 게임에 연결된 기록이 아직 없어요." });
  }

  function initAbout(main) {
    var st = STUDIO.statement || {};
    var team = STUDIO.team || [];
    var essay = STUDIO.essay ? findRecord(STUDIO.essay) : null;
    main.innerHTML =
      '<section class="statement dark">' +
        (st.text ? '<blockquote' + (st.text.length > 120 ? ' class="long"' : "") + ">" +
          String(st.text).split(/\n\s*\n/).map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
          (st.by ? "<footer>" + esc(st.by) + "</footer>" : "") + "</blockquote>" : "") +
      "</section>" +
      (team.length ? '<section class="team-sec dark"><h2 class="big-title">LAODEER TEAM</h2><ul class="team">' +
        team.map(function (m) {
          var initials = String(m.name || "").split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
          return '<li class="member">' +
            '<span class="member-photo">' + (m.photo ? img(m.photo, m.name) : '<span class="initials" aria-hidden="true">' + esc(initials) + "</span>") + "</span>" +
            '<span class="member-name">' + esc(m.name) + "</span>" +
            (m.role ? '<span class="member-role">' + esc(m.role) + "</span>" : "") +
            (m.handle ? '<span class="member-handle">' + esc(m.handle) + "</span>" : "") +
          "</li>";
        }).join("") + "</ul></section>" : "") +
      '<div class="about page">' +
        ((STUDIO.intro || []).length ? '<section class="about-head"><h2 class="band">LaoDeer는</h2><div class="about-intro">' +
          STUDIO.intro.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
          (STUDIO.introExample ? '<p class="ex-line"><span class="ex">예시</span></p>' : "") + "</div></section>" : "") +
        (essay ? '<section class="about-essay" aria-labelledby="essay-title"><h2 class="band" id="essay-title">만드는 기준에 관한 글</h2>' +
          '<article class="essay" id="essay"><h3>' + esc(essay.title || "제목 없는 글") + "</h3>" +
          '<p class="essay-date"><time datetime="' + esc(essay.date) + '">' + longDate(essay.date) + "</time>" + exampleMark(essay) + "</p>" +
          '<div class="essay-body">' + renderBlocks(blocks(essay.body)) + "</div>" +
          '<p class="rel"><a href="devlog.html#' + encodeURIComponent(essay.id) + '">작업 기록에서 보기</a></p></article></section>' : "") +
        '<section class="about-pad" aria-labelledby="pad-title"><h2 class="band" id="pad-title">낙서장</h2>' +
          '<p class="pad-hint">마우스나 손가락, 펜으로 그려보세요. 그린 그림은 어디에도 올라가지 않아요.</p>' +
          '<div class="pad" id="pad"><div class="pad-tools" role="toolbar" aria-label="낙서 도구">' +
            '<span class="pad-group">' +
              '<button type="button" class="swatch" data-color="#06331E" aria-pressed="true" aria-label="초록 펜"><i style="background:#06331E"></i></button>' +
              '<button type="button" class="swatch" data-color="#FDA828" aria-pressed="false" aria-label="앰버 펜"><i style="background:#FDA828"></i></button>' +
              '<button type="button" class="chip" data-tool="erase" aria-pressed="false">지우개</button></span>' +
            '<span class="pad-group">' +
              '<button type="button" class="dot" data-size="2" aria-pressed="false" aria-label="가는 선"><i style="width:4px;height:4px"></i></button>' +
              '<button type="button" class="dot" data-size="4" aria-pressed="true" aria-label="보통 선"><i style="width:8px;height:8px"></i></button>' +
              '<button type="button" class="dot" data-size="9" aria-pressed="false" aria-label="굵은 선"><i style="width:14px;height:14px"></i></button></span>' +
            '<span class="pad-group">' +
              '<button type="button" class="chip" data-tool="undo">되돌리기</button>' +
              '<button type="button" class="chip" data-tool="clear">모두 지우기</button>' +
              '<button type="button" class="chip" data-tool="save">이미지로 저장</button></span>' +
          '</div><canvas tabindex="0" aria-label="낙서장. 마우스나 손가락으로 그릴 수 있어요."></canvas></div>' +
        "</section>" +
      "</div>";
  }

  function initPresskit(main) {
    var list = GAMES.filter(function (g) { return !isSoon(g); });
    var st = STUDIO.statement || {};
    main.innerHTML = (list.length ? list.map(function (g, i) {
      var facts = [
        ["Developers", g.developer], ["Publisher", g.publisher], ["Development time", g.devPeriod],
        ["Release Date", g.released], ["Platforms", (g.platforms || []).join(", ")], ["Press contact", STUDIO.pressContact]
      ].filter(function (f) { return f[1]; });
      var shots = (g.screenshots || []).filter(function (x) { return x && !ytId(x); }).map(function (src, k) { return { image: src, body: g.title + " 인게임 이미지 " + (k + 1) }; })
        .concat(RECORDS.filter(function (r) { return r.game === g.id && r.image; })).slice(0, 9);
      return '<section class="press" id="' + esc(g.id) + '" aria-labelledby="press-' + esc(g.id) + '">' +
        '<div class="press-head dark"><h1 class="big-title" id="press-' + esc(g.id) + '">' + esc(g.title) + '</h1><p class="phead-ko">PRESS KIT</p>' +
          (g.image ? '<figure class="press-key">' + zoomable(g.image, g.alt || g.title, g.title, i === 0) + "</figure>" : "") + "</div>" +
        '<div class="press-cols page">' +
          '<div class="press-desc"><h2>' + esc(g.title) + "</h2>" + (g.intro ? "<p>" + esc(g.intro) + "</p>" : "") +
            (shots.length ? '<h3>Images</h3><ul class="press-shots">' + shots.map(function (r) {
              return "<li>" + zoomable(r.image, r.alt || r.title || r.body.split("\n")[0], r.title || r.body.split("\n")[0], false) + "</li>";
            }).join("") + "</ul>" : "") +
          "</div>" +
          '<div class="factsheet"><h2>FACT SHEET</h2><dl>' +
            facts.map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") +
          "</dl></div>" +
        "</div></section>";
    }).join("") : pageHead("PRESS KIT") + '<section class="page"><p class="empty">공개한 게임이 생기면 여기에 프레스 킷이 보여요.</p></section>') +
      '<section class="press-studio dark"><h2 class="big-title">LAODEER</h2>' +
        (st.text ? "<p>" + esc(st.text) + "</p>" : "") +
        (STUDIO.pressContact ? '<p class="press-contact">Press contact ' + esc(STUDIO.pressContact) + "</p>" : "") +
      "</section>";
    if (location.hash) {
      var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView();
    }
  }

  function initSocials(main) {
    var list = STUDIO.socials || [];
    main.innerHTML = pageHead("SOCIALS", "LaoDeer 소식을 받는 곳") +
      '<section class="page">' + (list.length ? '<ul class="socials">' + list.map(function (s) {
        return '<li><a class="social" href="' + esc(s.url || "#") + '" target="_blank" rel="noopener">' +
          '<span class="social-label">' + esc(s.label) + "</span>" +
          (s.handle ? '<span class="social-handle">' + esc(s.handle) + "</span>" : "") +
          exampleMark(s) + "</a></li>";
      }).join("") + "</ul>" : '<p class="empty">아직 연결한 소셜 계정이 없어요.</p>') + "</section>";
  }

  function initFaq(main) {
    var list = STUDIO.faq || [];
    main.innerHTML = pageHead("FAQ", "자주 받는 질문") +
      '<section class="page">' + (list.length ? '<div class="faq">' + list.map(function (f) {
        return '<details class="qa"><summary><span>' + esc(f.q) + "</span>" + exampleMark(f) + '<i aria-hidden="true"></i></summary>' +
          '<div class="qa-a">' + renderBlocks(blocks(f.a || "")) + "</div></details>";
      }).join("") + "</div>" : '<p class="empty">아직 등록한 질문이 없어요.</p>') + "</section>";
  }

  /* 관리 화면 미리보기에서 같은 모양으로 그리기 위해 공개 */
  window.LaoDeer = { tagsHTML: tagsHTML, renderRecord: renderRecord, renderFeed: renderFeed, gameCards: gameCards, TYPES: TYPES };

  var page = document.body.dataset.page;
  var main = $("main");
  var PAGES = { home: initHome, devlog: initDevlog, games: initGames, game: initGame, about: initAbout, presskit: initPresskit, socials: initSocials, faq: initFaq };
  if (PAGES[page] && main) {
    renderChrome(page);
    PAGES[page](main);
  }
  document.dispatchEvent(new CustomEvent("laodeer:rendered"));
})();

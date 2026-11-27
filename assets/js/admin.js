/*
  LaoDeer 관리 화면
  - 브라우저의 File System Access API 로 내 PC의 사이트 폴더를 직접 읽고 씁니다. (크롬, 엣지)
  - 저장할 때마다 이전 파일을 _backup/ 폴더에 남깁니다. (최근 30개)
  - 그림은 images/연도/ 폴더에 복사돼요. 아주 큰 그림은 긴 변 2400px로 줄여서 저장합니다.
*/
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var TYPES = ["개발일지", "생각", "그림"];
  var FILES = {
    records: { path: "data/records.js", v: "LAODEER_RECORDS" },
    games: { path: "data/games.js", v: "LAODEER_GAMES" },
    studio: { path: "data/studio.js", v: "LAODEER_STUDIO" }
  };
  var DEFAULT_HEADERS = {
    records: "/* 작업 기록. 관리 화면(admin.html)에서 고치는 걸 권해요. */\n",
    games: "/* 게임 목록. 관리 화면(admin.html)에서 고치는 걸 권해요. */\n",
    studio: "/* 스튜디오 정보. 관리 화면(admin.html)에서 고치는 걸 권해요. */\n"
  };
  var STATUSES = ["개발 중", "출시", "공개 예정"];
  var BACKUP_KEEP = 30;
  var BIG_IMAGE = 3 * 1024 * 1024;
  var MAX_SIDE = 2400;

  var S = {
    root: null,
    headers: {},
    records: [],
    games: window.LAODEER_GAMES,  // site.js 와 같은 배열을 써서 미리보기의 게임 이름이 바로 맞춰지게
    studio: {},
    tab: "records",
    rec: { sel: null, draft: null, dirty: false, filter: "", q: "" },
    game: { sel: null, draft: null, dirty: false },
    sd: null,           // 스튜디오 탭에서 고치는 중인 사본
    studioDirty: false,
    blobs: {}
  };

  /* ---------- 작은 도구 ---------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }
  function rand() { return Math.random().toString(36).slice(2, 6); }
  var toastTimer;
  function toast(msg) {
    var t = $("#a-toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 3200);
  }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------- 지난번 폴더 기억 (IndexedDB) ---------- */

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("laodeer-admin", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function kvGet(k) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function kvSet(k, v) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put(v, k);
        t.oncomplete = res; t.onerror = res;
      });
    }).catch(function () {});
  }

  /* ---------- 폴더 읽고 쓰기 ---------- */

  async function dirOf(path, create) {
    var parts = path.split("/"), d = S.root;
    for (var i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i], { create: !!create });
    return [d, parts[parts.length - 1]];
  }
  async function readFile(path) {
    var x = await dirOf(path, false);
    return (await x[0].getFileHandle(x[1])).getFile();
  }
  async function readText(path) { return (await readFile(path)).text(); }
  async function writeFile(path, data) {
    var x = await dirOf(path, true);
    var h = await x[0].getFileHandle(x[1], { create: true });
    var w = await h.createWritable();
    await w.write(data);
    await w.close();
  }
  async function imgURL(path) {
    if (!path) return "";
    if (/^(blob:|data:|https?:)/.test(path)) return path;
    if (S.blobs[path]) return S.blobs[path];
    try { S.blobs[path] = URL.createObjectURL(await readFile(path)); return S.blobs[path]; }
    catch (e) { return path; }
  }

  function parseData(text, v) {
    var win = {};
    new Function("window", text)(win);
    return win[v];
  }
  function headerOf(text, key) {
    var m = text.match(/^\s*\/\*[\s\S]*?\*\//);
    return m ? m[0].trim() + "\n" : DEFAULT_HEADERS[key];
  }

  /* ---------- 저장할 모양으로 정리 ---------- */

  function pick(o, keys) {
    var out = {};
    keys.forEach(function (k) {
      var v = o[k];
      if (v === undefined || v === null || v === "" || v === false) return;
      if (Array.isArray(v) && !v.length) return;
      out[k] = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : v;
    });
    return out;
  }
  function cleanRecord(r) { return pick(r, ["id", "date", "type", "title", "body", "image", "alt", "game", "example"]); }
  function cleanGame(g) {
    var o = pick(g, ["id", "title", "intro", "status", "released", "devPeriod", "developer", "publisher", "platforms", "stores", "itch", "image", "alt", "example"]);
    if (o.platforms) o.platforms = o.platforms.map(function (p) { return p.trim(); }).filter(Boolean);
    if (o.stores) o.stores = o.stores.filter(function (s) { return s.label && s.label.trim(); })
      .map(function (s) { return { label: s.label.trim(), url: (s.url || "").trim() || "#" }; });
    return o;
  }
  function cleanRows(rows, keys, must) {
    return (rows || []).map(function (r) { return pick(r, keys); }).filter(function (r) { return r[must]; });
  }
  function cleanStudio(s) {
    var o = pick(s, ["slogan", "heroImage", "logo", "statement", "intro", "introExample", "essay", "team", "socials", "faq", "pressContact"]);
    if (o.slogan) { o.slogan = pick(o.slogan, ["en", "ko"]); if (!o.slogan.en && !o.slogan.ko) delete o.slogan; }
    if (o.statement) { o.statement = pick(o.statement, ["text", "by"]); if (!o.statement.text) delete o.statement; }
    if (o.team) o.team = cleanRows(o.team, ["name", "role", "handle", "photo"], "name");
    if (o.socials) o.socials = cleanRows(o.socials, ["label", "handle", "url", "example"], "label");
    if (o.faq) o.faq = cleanRows(o.faq, ["q", "a", "example"], "q");
    return o;
  }

  function sortRecords() {
    S.records.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  async function saveData(key) {
    var f = FILES[key], data;
    if (key === "records") { sortRecords(); data = S.records.map(cleanRecord); }
    else if (key === "games") data = S.games.map(cleanGame);
    else data = cleanStudio(S.studio);
    var text = S.headers[key] + "window." + f.v + " = " + JSON.stringify(data, null, 2) + ";\n";
    try {
      var old = await readText(f.path);
      await writeFile("_backup/" + key + "-" + stamp() + ".js", old);
      await pruneBackups(key);
    } catch (e) { /* 처음 저장이면 이전 파일이 없음 */ }
    await writeFile(f.path, text);
  }
  async function pruneBackups(key) {
    var d = await S.root.getDirectoryHandle("_backup", { create: true });
    var names = [];
    for await (var entry of d.values()) if (entry.kind === "file" && entry.name.indexOf(key + "-") === 0) names.push(entry.name);
    names.sort();
    while (names.length > BACKUP_KEEP) await d.removeEntry(names.shift());
  }

  /* ---------- 그림 저장 ---------- */

  function extOf(file) {
    var m = (file.name || "").match(/\.([a-z0-9]+)$/i);
    var e = (m ? m[1] : (file.type.split("/")[1] || "png")).toLowerCase();
    return e === "jpeg" ? "jpg" : e;
  }
  async function shrinkIfBig(file) {
    if (file.size <= BIG_IMAGE || !/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return file;
    var bmp = await createImageBitmap(file);
    var scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type !== "image/png") return file;
    var c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    var blob = await new Promise(function (res) { c.toBlob(res, file.type, 0.92); });
    if (!blob || blob.size >= file.size) return file;
    blob.name = file.name;
    toast("그림이 커서 긴 변 " + Math.max(c.width, c.height) + "px로 줄였어요. (" + (file.size / 1048576).toFixed(1) + "MB → " + (blob.size / 1048576).toFixed(1) + "MB)");
    return blob;
  }
  async function storeImage(file, date, prefix) {
    var small = await shrinkIfBig(file);
    var year = (date || today()).slice(0, 4);
    var path = "images/" + year + "/" + (prefix || date || today()) + "-" + rand() + "." + extOf(file);
    await writeFile(path, small);
    return path;
  }

  /* ---------- 폴더 열기 ---------- */

  async function connect(handle, ask) {
    if (handle.queryPermission) {
      var p = await handle.queryPermission({ mode: "readwrite" });
      if (p !== "granted") {
        if (!ask) throw new Error("permission");
        if ((await handle.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("폴더에 저장할 수 있게 허락해주세요.");
      }
    }
    S.root = handle;
    var recText;
    try { recText = await readText(FILES.records.path); }
    catch (e) { S.root = null; throw new Error("이 폴더에는 data/records.js 가 없어요. 사이트 파일이 든 laoDeer_web 폴더를 골라주세요."); }

    S.headers.records = headerOf(recText, "records");
    S.records = parseData(recText, FILES.records.v) || [];
    sortRecords();

    try {
      var gText = await readText(FILES.games.path);
      S.headers.games = headerOf(gText, "games");
      S.games.splice.apply(S.games, [0, S.games.length].concat(parseData(gText, FILES.games.v) || []));
    } catch (e) { S.headers.games = DEFAULT_HEADERS.games; S.games.length = 0; }

    try {
      var sText = await readText(FILES.studio.path);
      S.headers.studio = headerOf(sText, "studio");
      S.studio = parseData(sText, FILES.studio.v) || {};
    } catch (e) { S.headers.studio = DEFAULT_HEADERS.studio; S.studio = {}; }
    S.sd = null;

    try { await kvSet("root", handle); } catch (e) {}
    $("#folder-name").textContent = handle.name + " 폴더";
    $("#gate").hidden = true;
    $("#workspace").hidden = false;
    renderAll();
  }

  async function initGate() {
    var note = $("#gate-note");
    if (!("showDirectoryPicker" in window)) {
      $("#open-folder").disabled = true;
      note.textContent = "이 관리 화면은 크롬이나 엣지에서 열어주세요. 지금 브라우저는 폴더에 저장하는 기능을 지원하지 않아요.";
      return;
    }
    $("#open-folder").addEventListener("click", async function () {
      try {
        var h = await window.showDirectoryPicker({ id: "laodeer", mode: "readwrite" });
        await connect(h, true);
      } catch (e) {
        if (e && e.name === "AbortError") return;
        note.textContent = e.message || "폴더를 열지 못했어요.";
      }
    });
    var saved = await kvGet("root");
    if (saved) {
      var re = $("#reopen-folder");
      re.hidden = false;
      re.textContent = "지난번 폴더 다시 열기 (" + saved.name + ")";
      re.addEventListener("click", async function () {
        try { await connect(saved, true); }
        catch (e) { note.textContent = e.message === "permission" ? "폴더 권한을 허락해주세요." : (e.message || "폴더를 열지 못했어요."); }
      });
    }
  }

  /* ---------- 탭 ---------- */

  $$(".a-tabs button").forEach(function (b) {
    b.addEventListener("click", function () { setTab(b.dataset.tab); });
  });
  function setTab(t) {
    S.tab = t;
    $$(".a-tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"); });
    $$(".a-pane").forEach(function (p) { p.hidden = p.dataset.pane !== t; });
    if (t === "about") renderStudio();
  }
  function renderAll() { renderRecList(); renderRecEditor(); renderGameList(); renderGameEditor(); renderStudio(); }

  function confirmDiscard(part) {
    if (!part.dirty) return true;
    return window.confirm("저장하지 않은 내용이 있어요. 버리고 넘어갈까요?");
  }

  /* =====================================================
     기록
     ===================================================== */

  var HINTS = {
    "그림": { title: "보통 비워둬요", body: "그림 아래에 붙는 짧은 캡션", image: "그림을 넣어주세요. 원본 비율 그대로 보여요." },
    "개발일지": { title: "선택", body: '"- "로 시작하는 줄은 "바꾼 점" 목록이 돼요', image: "그날 스크린샷 (선택)" },
    "생각": { title: "제목이 있으면 홈에는 제목과 첫 문장만 보여요", body: "빈 줄로 문단을 나눠요", image: "선택" }
  };

  function draftFrom(r) {
    r = r || {};
    return {
      id: r.id || "", date: r.date || today(), type: r.type || "", title: r.title || "", body: r.body || "",
      image: r.image || "", alt: r.alt || "", game: r.game || "", example: !!r.example,
      _file: null, _blob: "", _remove: false
    };
  }

  function renderRecList() {
    var q = S.rec.q.trim().toLowerCase(), f = S.rec.filter;
    var items = S.records.filter(function (r) {
      if (f && r.type !== f) return false;
      if (!q) return true;
      return ((r.title || "") + " " + r.body + " " + r.date).toLowerCase().indexOf(q) >= 0;
    });
    $("#rec-list").innerHTML = items.length ? items.map(function (r) {
      var label = r.title || r.body.split("\n")[0];
      return '<li><button type="button" class="a-item' + (r === S.rec.sel ? " on" : "") + '" data-i="' + S.records.indexOf(r) + '">' +
        '<span class="a-item-top"><time>' + esc(r.date) + '</time><span class="kind">' + esc(r.type) + "</span>" +
        (r.image ? '<span class="a-tag">이미지</span>' : "") + (r.example ? '<span class="ex">예시</span>' : "") + "</span>" +
        '<span class="a-item-text">' + esc(label.length > 44 ? label.slice(0, 44) + "…" : label) + "</span></button></li>";
    }).join("") : '<li class="a-hint pad">' + (S.records.length ? "맞는 기록이 없어요." : "아직 기록이 없어요. 위의 새 기록 쓰기로 시작하세요.") + "</li>";
    var ex = S.records.filter(function (r) { return r.example; }).length + S.games.filter(function (g) { return g.example; }).length +
      ["socials", "faq"].reduce(function (n, k) { return n + ((S.studio || {})[k] || []).filter(function (x) { return x.example; }).length; }, 0);
    $("#clear-examples").hidden = !ex;
    $("#clear-examples").textContent = "예시 자료 한 번에 지우기 (" + ex + "개)";
  }

  $("#rec-list").addEventListener("click", function (e) {
    var b = e.target.closest(".a-item");
    if (!b) return;
    var r = S.records[+b.dataset.i];
    if (r === S.rec.sel || !confirmDiscard(S.rec)) return;
    selectRecord(r);
  });
  function selectRecord(r) {
    S.rec.sel = r || null;
    S.rec.draft = r || r === null ? draftFrom(r) : null;
    S.rec.dirty = false;
    renderRecList(); renderRecEditor();
  }
  $('[data-new="record"]').addEventListener("click", function () {
    if (!confirmDiscard(S.rec)) return;
    selectRecord(null);
    var t = $('#rec-form input[name="type"]');
    if (t) t.focus();
  });
  $("#rec-search").addEventListener("input", function (e) { S.rec.q = e.target.value; renderRecList(); });
  $("#rec-filter").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    S.rec.filter = b.dataset.f;
    $$("#rec-filter button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    renderRecList();
  });

  function dropZone(id, d, hint) {
    var has = (d._file || (d.image && !d._remove));
    return '<div class="a-drop' + (has ? " has" : "") + '" id="' + id + '" tabindex="0" role="button" aria-label="이미지 고르기">' +
      (has ? '<img alt="" class="a-thumb">' : "") +
      '<div class="a-drop-text">' +
        (has ? '<p class="a-drop-name">' + esc(d._file ? d._file.name + " (새로 넣음)" : d.image) + "</p>" : "<p><b>이미지를 여기로 끌어다 놓거나 눌러서 고르세요.</b><br>복사한 이미지는 Ctrl+V로 붙여넣을 수 있어요.</p>") +
        '<p class="a-hint" data-hint="image">' + esc(hint) + "</p>" +
        (has ? '<p class="a-drop-btns"><button type="button" class="a-btn small" data-img="change">바꾸기</button> <button type="button" class="a-btn small" data-img="remove">빼기</button></p>' : "") +
      "</div>" +
      '<input type="file" accept="image/*" hidden>' +
    "</div>";
  }
  function bindDrop(zone, onFile, onRemove) {
    var input = zone.querySelector("input[type=file]");
    zone.addEventListener("click", function (e) {
      var b = e.target.closest("[data-img]");
      if (b && b.dataset.img === "remove") { e.stopPropagation(); return onRemove(); }
      input.click();
    });
    zone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("click", function (e) { e.stopPropagation(); });
    input.addEventListener("change", function () { if (input.files[0]) onFile(input.files[0]); });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("over"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault(); zone.classList.remove("over");
      var f = [].slice.call(e.dataTransfer.files).filter(function (x) { return /^image\//.test(x.type); })[0];
      if (f) onFile(f); else toast("이미지 파일만 넣을 수 있어요.");
    });
  }
  async function paintThumb(zone, d) {
    var im = zone.querySelector(".a-thumb");
    if (!im) return;
    im.src = d._file ? d._blob : await imgURL(d.image);
  }

  function renderRecEditor() {
    var el = $("#rec-editor"), d = S.rec.draft;
    if (!d) {
      el.innerHTML = '<div class="a-empty"><p>왼쪽에서 기록을 고르거나<br><b>새 기록 쓰기</b>를 눌러주세요.</p><p class="a-hint">쓰는 중에는 Ctrl+S로 저장할 수 있어요.</p></div>';
      renderRecPreview();
      return;
    }
    var h = HINTS[d.type] || { title: "선택", body: "", image: "선택" };
    el.innerHTML =
      '<form class="a-form" id="rec-form" novalidate>' +
        "<h2>" + (S.rec.sel ? "기록 고치기" : "새 기록") + "</h2>" +
        '<fieldset class="a-field"><legend>분류 <em>필수</em></legend><div class="a-seg big">' +
          TYPES.map(function (t) {
            return '<label><input type="radio" name="type" value="' + t + '"' + (d.type === t ? " checked" : "") + "><span>" + t + "</span></label>";
          }).join("") +
        "</div></fieldset>" +
        '<label class="a-field"><span>날짜 <em>필수</em></span><input type="date" name="date" value="' + esc(d.date) + '"></label>' +
        '<label class="a-field"><span>제목 <small data-hint="title">' + esc(h.title) + '</small></span><input type="text" name="title" value="' + esc(d.title) + '" autocomplete="off"></label>' +
        '<label class="a-field"><span>본문 <em>필수</em> <small data-hint="body">' + esc(h.body) + '</small></span><textarea name="body" rows="9">' + esc(d.body) + "</textarea></label>" +
        '<div class="a-field"><span>그림·스크린샷 <small>선택</small></span>' + dropZone("rec-drop", d, h.image) + "</div>" +
        '<label class="a-field"><span>이미지 설명 <small>화면을 못 보는 분께 읽어줘요. 비우면 본문 첫 줄을 써요.</small></span><input type="text" name="alt" value="' + esc(d.alt) + '"></label>' +
        '<label class="a-field"><span>관련 게임 <small>선택. 고르면 그 게임 페이지에도 모여요.</small></span><select name="game"><option value="">없음</option>' +
          S.games.map(function (g) { return '<option value="' + esc(g.id) + '"' + (d.game === g.id ? " selected" : "") + ">" + esc(g.title) + "</option>"; }).join("") +
        "</select></label>" +
        (d.example ? '<label class="a-check"><input type="checkbox" name="example" checked> 예시 표시 유지 <small>실제 기록이면 체크를 풀어주세요</small></label>' : "") +
        '<p class="a-error" id="rec-error" role="alert"></p>' +
        '<div class="a-actions">' +
          '<button type="submit" class="a-btn primary">저장</button>' +
          (S.rec.sel ? '<button type="button" class="a-btn" data-act="revert">고친 내용 되돌리기</button>' : '<button type="button" class="a-btn" data-act="revert">비우기</button>') +
          (S.rec.sel ? '<button type="button" class="a-btn danger" data-act="delete">이 기록 지우기</button>' : "") +
          (S.rec.sel ? '<a class="a-link" target="_blank" rel="noopener" href="devlog.html">사이트에서 보기</a>' : "") +
        "</div>" +
      "</form>";

    var form = $("#rec-form");
    var zone = $("#rec-drop");
    paintThumb(zone, d);
    bindDrop(zone, function (file) { setRecImage(file); }, function () {
      if (d._blob) URL.revokeObjectURL(d._blob);
      d._file = null; d._blob = ""; d._remove = true;
      markRec(); renderRecEditor();
    });

    form.addEventListener("input", function () { readRecForm(); markRec(); });
    form.addEventListener("change", function (e) {
      if (e.target.name === "type") {
        var hh = HINTS[d.type];
        $$("[data-hint]", form).forEach(function (n) { n.textContent = hh[n.dataset.hint]; });
      }
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); saveRecord(); });
    form.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "revert") {
        S.rec.draft = draftFrom(S.rec.sel); S.rec.dirty = false; renderRecEditor();
      } else if (b.dataset.act === "delete") deleteRecord();
    });
    renderRecPreview();
  }

  function readRecForm() {
    var f = $("#rec-form"), d = S.rec.draft;
    if (!f || !d) return;
    var t = f.querySelector('input[name="type"]:checked');
    d.type = t ? t.value : "";
    d.date = f.date.value;
    d.title = f.title.value;
    d.body = f.body.value;
    d.alt = f.alt.value;
    d.game = f.game.value;
    if (f.example) d.example = f.example.checked;
  }
  var previewSoon = debounce(function () { renderRecPreview(); }, 150);
  function markRec() { S.rec.dirty = true; previewSoon(); }

  function setRecImage(file) {
    var d = S.rec.draft;
    if (!d) return;
    readRecFormSafe(); // 쓰던 내용을 먼저 담고
    if (d._blob) URL.revokeObjectURL(d._blob);
    d._file = file; d._blob = URL.createObjectURL(file); d._remove = false;
    if (!d.type) d.type = "그림";
    markRec(); renderRecEditor();
  }
  function readRecFormSafe() { try { readRecForm(); } catch (e) {} }

  async function renderRecPreview() {
    var box = $("#rec-preview"), d = S.rec.draft;
    if (!d) { box.innerHTML = '<p class="a-hint">기록을 고르면 사이트에서 보일 모습이 여기 나와요.</p>'; return; }
    var r = cleanRecord(d);
    r.type = r.type || "생각";
    r.date = r.date || today();
    if (!r.body) r.body = "본문을 쓰면 여기에 보여요.";
    if (d._file) r.image = d._blob;
    else if (d._remove) delete r.image;
    else if (r.image) r.image = await imgURL(r.image);
    r._i = 0;
    window.LaoDeer.renderFeed(box, [r], {});
  }

  async function saveRecord() {
    readRecFormSafe();
    var d = S.rec.draft, err = $("#rec-error");
    var problems = [];
    if (!d.type) problems.push("분류를 골라주세요.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) problems.push("날짜를 넣어주세요.");
    if (!d.body.trim()) problems.push(d.type === "그림" ? "캡션(본문)을 한 줄이라도 적어주세요." : "본문을 적어주세요.");
    if (problems.length) { err.textContent = problems.join(" "); return; }
    err.textContent = "";
    var btn = $('#rec-form [type="submit"]');
    btn.disabled = true; btn.textContent = "저장 중…";
    try {
      if (d._file) { d.image = await storeImage(d._file, d.date); }
      if (d._remove) { d.image = ""; d.alt = ""; }
      var rec = cleanRecord(d);
      if (S.rec.sel) S.records[S.records.indexOf(S.rec.sel)] = rec;
      else S.records.push(rec);
      await saveData("records");
      S.rec.sel = rec;
      S.rec.draft = draftFrom(rec);
      S.rec.dirty = false;
      renderRecList(); renderRecEditor();
      toast("저장했어요. 사이트에 올리려면 GitHub Desktop에서 Push 해주세요.");
    } catch (e) {
      console.error(e);
      err.textContent = "저장하지 못했어요. " + (e.message || "") + " 폴더 권한이나 파일이 다른 프로그램에서 열려 있는지 확인해주세요.";
      btn.disabled = false; btn.textContent = "저장";
    }
  }

  async function deleteRecord() {
    var r = S.rec.sel;
    if (!r) return;
    var label = r.title || r.body.split("\n")[0].slice(0, 30);
    if (!window.confirm("이 기록을 지울까요?\n\n" + r.date + " " + r.type + "\n" + label + "\n\n지운 기록은 _backup 폴더의 이전 파일에 남아 있어요.")) return;
    S.records.splice(S.records.indexOf(r), 1);
    if (S.studio.essay && S.studio.essay === r.id) { S.studio.essay = ""; S.sd = null; await saveData("studio"); }
    await saveData("records");
    selectRecord(undefined);
    toast("기록을 지웠어요.");
  }

  /* 클립보드 이미지 붙여넣기 */
  document.addEventListener("paste", function (e) {
    if (S.tab !== "records" || !S.rec.draft) return;
    var item = [].slice.call(e.clipboardData ? e.clipboardData.items : []).filter(function (i) { return i.kind === "file" && /^image\//.test(i.type); })[0];
    if (!item) return;
    e.preventDefault();
    var f = item.getAsFile();
    var named = new File([f], "붙여넣은-이미지." + (f.type.split("/")[1] || "png"), { type: f.type });
    setRecImage(named);
    toast("붙여넣은 이미지를 넣었어요.");
  });

  /* 예시 한 번에 지우기 */
  $("#clear-examples").addEventListener("click", async function () {
    var er = S.records.filter(function (r) { return r.example; });
    var eg = S.games.filter(function (g) { return g.example; });
    var es = ["socials", "faq"].reduce(function (n, k) { return n + (S.studio[k] || []).filter(function (x) { return x.example; }).length; }, 0);
    if (!window.confirm("예시 기록 " + er.length + "개, 예시 게임 " + eg.length + "개, 예시 소셜·FAQ " + es + "개를 지울까요?\n직접 쓴 것은 그대로 남아요.")) return;
    var gone = eg.map(function (g) { return g.id; });
    S.records = S.records.filter(function (r) { return !r.example; });
    S.records.forEach(function (r) { if (gone.indexOf(r.game) >= 0) delete r.game; });
    var keep = S.games.filter(function (g) { return !g.example; });
    S.games.splice.apply(S.games, [0, S.games.length].concat(keep));
    if (S.studio.essay && !S.records.some(function (r) { return r.id === S.studio.essay; })) S.studio.essay = "";
    ["socials", "faq"].forEach(function (k) { if (S.studio[k]) S.studio[k] = S.studio[k].filter(function (x) { return !x.example; }); });
    S.sd = null;
    await saveData("records"); await saveData("games"); await saveData("studio");
    S.rec.sel = null; S.rec.draft = null; S.rec.dirty = false;
    S.game.sel = null; S.game.draft = null; S.game.dirty = false;
    renderAll();
    toast("예시를 지웠어요. 소개 문단은 스튜디오 탭에서 고쳐주세요.");
  });

  /* =====================================================
     게임
     ===================================================== */

  function gameDraft(g) {
    g = g || {};
    return {
      id: g.id || "", title: g.title || "", intro: g.intro || "", released: g.released || "",
      status: g.status || "개발 중", devPeriod: g.devPeriod || "", developer: g.developer || "", publisher: g.publisher || "",
      itch: g.itch || "",
      platforms: (g.platforms || []).join(", "), stores: (g.stores || []).map(function (s) { return { label: s.label, url: s.url }; }),
      image: g.image || "", alt: g.alt || "", example: !!g.example, _idTouched: !!g.id,
      _file: null, _blob: "", _remove: false
    };
  }
  function slug(t) {
    var s = String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (s) return s;
    var n = 1;
    while (S.games.some(function (g) { return g.id === "game-" + n; })) n++;
    return "game-" + n;
  }

  function renderGameList() {
    $("#game-list").innerHTML = S.games.length ? S.games.map(function (g, i) {
      return '<li class="a-row"><button type="button" class="a-item' + (g === S.game.sel ? " on" : "") + '" data-i="' + i + '">' +
        '<span class="a-item-text big">' + esc(g.title) + "</span>" +
        '<span class="a-item-top"><span class="kind">' + esc(g.status || "개발 중") + "</span>" + (g.example ? '<span class="ex">예시</span>' : "") + "</span></button>" +
        '<span class="a-move"><button type="button" data-move="-1" data-i="' + i + '" aria-label="' + esc(g.title) + ' 위로" ' + (i === 0 ? "disabled" : "") + ">▲</button>" +
        '<button type="button" data-move="1" data-i="' + i + '" aria-label="' + esc(g.title) + ' 아래로" ' + (i === S.games.length - 1 ? "disabled" : "") + ">▼</button></span></li>";
    }).join("") : '<li class="a-hint pad">아직 게임이 없어요.</li>';
  }
  $("#game-list").addEventListener("click", async function (e) {
    var mv = e.target.closest("[data-move]");
    if (mv) {
      var i = +mv.dataset.i, j = i + (+mv.dataset.move);
      var t = S.games[i]; S.games[i] = S.games[j]; S.games[j] = t;
      await saveData("games");
      renderGameList();
      toast("순서를 바꿨어요.");
      return;
    }
    var b = e.target.closest(".a-item");
    if (!b) return;
    var g = S.games[+b.dataset.i];
    if (g === S.game.sel || !confirmDiscard(S.game)) return;
    S.game.sel = g; S.game.draft = gameDraft(g); S.game.dirty = false;
    renderGameList(); renderGameEditor();
  });
  $('[data-new="game"]').addEventListener("click", function () {
    if (!confirmDiscard(S.game)) return;
    S.game.sel = null; S.game.draft = gameDraft(null); S.game.dirty = false;
    renderGameList(); renderGameEditor();
    $("#game-form").title.focus();
  });

  function renderGameEditor() {
    var el = $("#game-editor"), d = S.game.draft;
    if (!d) {
      el.innerHTML = '<div class="a-empty"><p>왼쪽에서 게임을 고르거나<br><b>새 게임 추가</b>를 눌러주세요.</p></div>';
      renderGamePreview();
      return;
    }
    el.innerHTML =
      '<form class="a-form" id="game-form" novalidate>' +
        "<h2>" + (S.game.sel ? "게임 정보 고치기" : "새 게임") + "</h2>" +
        '<fieldset class="a-field"><legend>상태 <small>"공개 예정"은 OUR GAMES에 Coming Soon 카드로만 보여요</small></legend><div class="a-seg big">' +
          STATUSES.map(function (t) {
            return '<label><input type="radio" name="status" value="' + t + '"' + (d.status === t ? " checked" : "") + "><span>" + t + "</span></label>";
          }).join("") +
        "</div></fieldset>" +
        '<label class="a-field"><span>게임 이름 <em>필수</em></span><input type="text" name="title" value="' + esc(d.title) + '"></label>' +
        '<label class="a-field"><span>주소 이름 <em>필수</em> <small>영문 소문자, 숫자, -만. 게임 페이지 주소가 돼요: game.html?id=<b data-idview>' + esc(d.id || "…") + '</b></small></span><input type="text" name="id" value="' + esc(d.id) + '" pattern="[a-z0-9-]+" autocomplete="off"></label>' +
        '<label class="a-field"><span>짧은 소개 <small>어떤 게임인지 한두 문장. 카드와 게임 페이지에 보여요.</small></span><textarea name="intro" rows="3">' + esc(d.intro) + "</textarea></label>" +
        '<div class="a-two">' +
          '<label class="a-field"><span>출시일 <small>적은 그대로 보여요</small></span><input type="text" name="released" value="' + esc(d.released) + '" placeholder="2026년 3월 14일 / 미정"></label>' +
          '<label class="a-field"><span>개발 기간</span><input type="text" name="devPeriod" value="' + esc(d.devPeriod) + '" placeholder="2025년 말 ~"></label>' +
          '<label class="a-field"><span>개발 <small>프레스 킷 Developers</small></span><input type="text" name="developer" value="' + esc(d.developer) + '"></label>' +
          '<label class="a-field"><span>퍼블리셔</span><input type="text" name="publisher" value="' + esc(d.publisher) + '"></label>' +
        "</div>" +
        '<label class="a-field"><span>플랫폼 <small>쉼표로 나눠요</small></span><input type="text" name="platforms" value="' + esc(d.platforms) + '" placeholder="PC, Switch"></label>' +
        '<label class="a-field"><span>itch.io 게임 주소 <small>적으면 itch에 쓴 개발일지를 6시간마다 자동으로 가져와 DEVLOG에 보여줘요</small></span><input type="url" name="itch" value="' + esc(d.itch) + '" placeholder="https://laodeer.itch.io/게임이름"></label>' +
        '<div class="a-field"><span>스토어 링크</span><div class="a-stores" id="stores">' +
          d.stores.map(function (s, i) {
            return '<div class="a-store-row"><input type="text" data-s="label" data-i="' + i + '" value="' + esc(s.label) + '" placeholder="버튼 글자 (예: Steam에서 보기)" aria-label="버튼 글자">' +
              '<input type="url" data-s="url" data-i="' + i + '" value="' + esc(s.url) + '" placeholder="https://" aria-label="주소">' +
              '<button type="button" class="a-btn small" data-rm-store="' + i + '">빼기</button></div>';
          }).join("") +
          '<button type="button" class="a-btn small" data-add-store>스토어 추가</button></div></div>' +
        '<div class="a-field"><span>대표 장면 <small>게임 페이지 맨 위와 목록에 쓰여요</small></span>' + dropZone("game-drop", d, "가로로 긴 이미지가 잘 어울려요.") + "</div>" +
        '<label class="a-field"><span>대표 장면 설명</span><input type="text" name="alt" value="' + esc(d.alt) + '"></label>' +
        (d.example ? '<label class="a-check"><input type="checkbox" name="example" checked> 예시 표시 유지 <small>실제 게임이면 체크를 풀어주세요</small></label>' : "") +
        '<p class="a-error" id="game-error" role="alert"></p>' +
        '<div class="a-actions">' +
          '<button type="submit" class="a-btn primary">저장</button>' +
          (S.game.sel ? '<button type="button" class="a-btn danger" data-act="delete">이 게임 지우기</button>' : "") +
          (S.game.sel ? '<a class="a-link" target="_blank" rel="noopener" href="game.html?id=' + encodeURIComponent(S.game.sel.id) + '">사이트에서 보기</a>' : "") +
        "</div>" +
      "</form>";

    var form = $("#game-form");
    var zone = $("#game-drop");
    paintThumb(zone, d);
    bindDrop(zone, function (file) {
      readGameForm();
      if (d._blob) URL.revokeObjectURL(d._blob);
      d._file = file; d._blob = URL.createObjectURL(file); d._remove = false;
      S.game.dirty = true; renderGameEditor();
    }, function () {
      readGameForm();
      d._file = null; d._blob = ""; d._remove = true; S.game.dirty = true; renderGameEditor();
    });
    form.addEventListener("input", function (e) {
      if (e.target.name === "id") d._idTouched = true;
      readGameForm();
      if (e.target.name === "title" && !d._idTouched && !S.game.sel) { d.id = slug(d.title); form.id.value = d.id; }
      $("[data-idview]", form).textContent = d.id || "…";
      S.game.dirty = true;
      renderGamePreviewSoon();
    });
    form.addEventListener("click", function (e) {
      if (e.target.closest("[data-add-store]")) { readGameForm(); d.stores.push({ label: "", url: "" }); S.game.dirty = true; renderGameEditor(); return; }
      var rm = e.target.closest("[data-rm-store]");
      if (rm) { readGameForm(); d.stores.splice(+rm.dataset.rmStore, 1); S.game.dirty = true; renderGameEditor(); return; }
      if (e.target.closest('[data-act="delete"]')) deleteGame();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); saveGame(); });
    renderGamePreview();
  }
  function readGameForm() {
    var f = $("#game-form"), d = S.game.draft;
    if (!f || !d) return;
    d.title = f.title.value; d.id = f.id.value.trim(); d.intro = f.intro.value;
    d.released = f.released.value; d.platforms = f.platforms.value; d.alt = f.alt.value;
    d.itch = f.itch.value.trim();
    d.devPeriod = f.devPeriod.value; d.developer = f.developer.value; d.publisher = f.publisher.value;
    var st = f.querySelector('input[name="status"]:checked');
    d.status = st ? st.value : "개발 중";
    if (f.example) d.example = f.example.checked;
    $$("[data-s]", f).forEach(function (inp) { d.stores[+inp.dataset.i][inp.dataset.s] = inp.value; });
  }
  function gameFromDraft(d) {
    return cleanGame({
      id: d.id, title: d.title, intro: d.intro, released: d.released, status: d.status,
      devPeriod: d.devPeriod, developer: d.developer, publisher: d.publisher, itch: d.itch,
      platforms: d.platforms.split(","), stores: d.stores, image: d.image, alt: d.alt, example: d.example
    });
  }
  var renderGamePreviewSoon = debounce(function () { renderGamePreview(); }, 150);
  async function renderGamePreview() {
    var box = $("#game-preview"), d = S.game.draft;
    if (!d) { box.innerHTML = '<p class="a-hint on-green">게임을 고르면 게임 페이지 윗부분이 여기 보여요.</p>'; return; }
    var g = gameFromDraft(d);
    var src = d._file ? d._blob : (d._remove ? "" : await imgURL(d.image));
    if (g.status === "공개 예정") {
      box.innerHTML = '<p class="a-hint on-green">OUR GAMES에 이렇게 보여요.</p>' + window.LaoDeer.gameCards([g]);
      return;
    }
    box.innerHTML =
      (src ? '<figure class="key"><img src="' + esc(src) + '" alt=""></figure>' : '<p class="a-hint on-green">대표 장면이 아직 없어요.</p>') +
      '<div class="game-text">' +
        "<h1>" + esc(g.title || "게임 이름") + "</h1>" +
        '<p class="intro">' + esc(g.intro || "짧은 소개") + "</p>" +
        '<dl class="facts">' + [["상태", g.status], ["출시일", g.released], ["개발 기간", g.devPeriod], ["플랫폼", (g.platforms || []).join(", ")]]
          .filter(function (f) { return f[1]; }).map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" +
        '<p class="stores">' + (g.stores || []).map(function (s) { return '<span class="store">' + esc(s.label) + "</span>"; }).join("") + "</p>" +
      "</div>";
  }

  async function saveGame() {
    readGameForm();
    var d = S.game.draft, err = $("#game-error"), problems = [];
    if (!d.title.trim()) problems.push("게임 이름을 적어주세요.");
    if (!/^[a-z0-9-]+$/.test(d.id)) problems.push("주소 이름은 영문 소문자, 숫자, -만 쓸 수 있어요.");
    else if (S.games.some(function (g) { return g.id === d.id && g !== S.game.sel; })) problems.push("같은 주소 이름을 쓰는 게임이 이미 있어요.");
    if (!d.intro.trim() && d.status !== "공개 예정") problems.push("짧은 소개를 적어주세요.");
    if (d.itch && !/^https:\/\/[a-z0-9-]+\.itch\.io\/\S+$/i.test(d.itch)) problems.push("itch.io 주소는 https://아이디.itch.io/게임이름 모양이어야 해요.");
    if (problems.length) { err.textContent = problems.join(" "); return; }
    err.textContent = "";
    try {
      if (d._file) d.image = await storeImage(d._file, today(), "game-" + d.id);
      if (d._remove) { d.image = ""; }
      var g = gameFromDraft(d);
      var oldId = S.game.sel ? S.game.sel.id : null;
      if (S.game.sel) S.games[S.games.indexOf(S.game.sel)] = g; else S.games.push(g);
      await saveData("games");
      if (oldId && oldId !== g.id) {
        S.records.forEach(function (r) { if (r.game === oldId) r.game = g.id; });
        await saveData("records");
      }
      S.game.sel = g; S.game.draft = gameDraft(g); S.game.dirty = false;
      renderGameList(); renderGameEditor(); renderRecList();
      toast("게임 정보를 저장했어요.");
    } catch (e) {
      console.error(e);
      err.textContent = "저장하지 못했어요. " + (e.message || "");
    }
  }

  async function deleteGame() {
    var g = S.game.sel;
    var linked = S.records.filter(function (r) { return r.game === g.id; });
    var msg = "'" + g.title + "' 게임을 지울까요?" +
      (linked.length ? "\n\n이 게임에 연결된 기록 " + linked.length + "개는 지우지 않고 연결만 풀어요." : "") +
      "\n\n지운 정보는 _backup 폴더의 이전 파일에 남아 있어요.";
    if (!window.confirm(msg)) return;
    S.games.splice(S.games.indexOf(g), 1);
    await saveData("games");
    if (linked.length) { linked.forEach(function (r) { delete r.game; }); await saveData("records"); }
    S.game.sel = null; S.game.draft = null; S.game.dirty = false;
    renderGameList(); renderGameEditor(); renderRecList();
    toast("게임을 지웠어요.");
  }

  /* =====================================================
     스튜디오 (첫 화면, ABOUT, SOCIALS, FAQ, 프레스 연락처)
     ===================================================== */

  var ROWS = {
    team: { keys: ["name", "role", "handle"], labels: ["이름", "역할", "계정 (선택)"], add: "팀원 추가", photo: true },
    socials: { keys: ["label", "handle", "url"], labels: ["플랫폼 이름", "계정", "주소 https://"], add: "소셜 추가" },
    faq: { keys: ["q", "a"], labels: ["질문", "답"], add: "질문 추가", long: "a" }
  };

  function studioDraft() {
    var s = JSON.parse(JSON.stringify(S.studio || {}));
    s.slogan = s.slogan || {}; s.statement = s.statement || {};
    s.team = s.team || []; s.socials = s.socials || []; s.faq = s.faq || [];
    s._hero = null; s._heroBlob = ""; s._heroRemove = false;
    s._logo = null; s._logoBlob = ""; s._logoRemove = false;
    s.team.forEach(function (m) { m._file = null; m._blob = ""; });
    return s;
  }

  function rowsHTML(kind, list) {
    var R = ROWS[kind];
    return '<div class="a-rows" data-rows="' + kind + '">' + list.map(function (row, i) {
      return '<div class="a-rowbox">' +
        (R.photo ? '<button type="button" class="a-photo" data-photo="' + i + '" aria-label="' + esc(row.name || "팀원") + ' 사진 고르기">' +
          (row._blob || row.photo ? '<img alt="" data-photo-img="' + i + '">' : "<span>사진</span>") + '</button><input type="file" accept="image/*" hidden data-photo-input="' + i + '">' : "") +
        '<div class="a-rowfields">' + R.keys.map(function (k, j) {
          var v = esc(row[k] || "");
          return k === R.long
            ? '<textarea rows="3" data-k="' + k + '" data-i="' + i + '" placeholder="' + R.labels[j] + '" aria-label="' + R.labels[j] + '">' + v + "</textarea>"
            : '<input type="text" data-k="' + k + '" data-i="' + i + '" value="' + v + '" placeholder="' + R.labels[j] + '" aria-label="' + R.labels[j] + '">';
        }).join("") +
        (row.example ? '<span class="ex">예시</span>' : "") + "</div>" +
        '<span class="a-move"><button type="button" data-row-move="-1" data-i="' + i + '" ' + (i === 0 ? "disabled" : "") + ' aria-label="위로">▲</button>' +
        '<button type="button" data-row-move="1" data-i="' + i + '" ' + (i === list.length - 1 ? "disabled" : "") + ' aria-label="아래로">▼</button></span>' +
        '<button type="button" class="a-btn small" data-row-rm="' + i + '">빼기</button>' +
      "</div>";
    }).join("") + '<button type="button" class="a-btn small" data-row-add>' + R.add + "</button></div>";
  }

  function renderStudio() {
    var el = $("#about-editor");
    if (!S.sd) S.sd = studioDraft();
    var d = S.sd;
    var thoughts = S.records.filter(function (r) { return r.type === "생각" && r.title; });
    var heroD = { _file: d._hero, _blob: d._heroBlob, image: d._heroRemove ? "" : d.heroImage, _remove: d._heroRemove };
    var logoD = { _file: d._logo, _blob: d._logoBlob, image: d._logoRemove ? "" : d.logo, _remove: d._logoRemove };
    el.innerHTML =
      '<form class="a-form" id="studio-form" novalidate>' +
        "<h2>스튜디오</h2>" +
        '<h3 class="a-sub">첫 화면</h3>' +
        '<label class="a-field"><span>슬로건 (큰 글씨)</span><input type="text" name="sloganEn" value="' + esc(d.slogan.en) + '"></label>' +
        '<label class="a-field"><span>슬로건 (작은 글씨)</span><input type="text" name="sloganKo" value="' + esc(d.slogan.ko) + '"></label>' +
        '<div class="a-field"><span>배경 장면 <small>흐리고 어둡게 깔려요. 가로로 긴 게임 장면이 좋아요.</small></span>' + dropZone("hero-drop", heroD, "가로로 긴 이미지") + "</div>" +
        '<div class="a-field"><span>로고 이미지 <small>선택. 비우면 글자 로고(LA◐DEER)를 써요. 밝은 색 로고(투명 PNG, SVG)가 어울려요.</small></span>' + dropZone("logo-drop", logoD, "투명 배경 PNG나 SVG") + "</div>" +

        '<h3 class="a-sub">ABOUT</h3>' +
        '<label class="a-field"><span>스튜디오 문장 <small>ABOUT 맨 위에 크게 보여요</small></span><textarea name="stText" rows="3">' + esc(d.statement.text) + "</textarea></label>" +
        '<label class="a-field"><span>문장 쓴 사람</span><input type="text" name="stBy" value="' + esc(d.statement.by) + '"></label>' +
        '<label class="a-field"><span>LaoDeer 소개 <small>빈 줄로 문단을 나눠요</small></span><textarea name="intro" rows="5">' + esc((d.intro || []).join("\n\n")) + "</textarea></label>" +
        '<label class="a-field"><span>만드는 기준에 관한 글 <small>제목이 있는 "생각" 기록 중에서 골라요</small></span><select name="essay"><option value="">고르지 않음</option>' +
          thoughts.map(function (r) {
            var key = r.id || "__" + S.records.indexOf(r);
            return '<option value="' + esc(key) + '"' + (r.id && r.id === d.essay ? " selected" : "") + ">" + esc(r.date + "  " + r.title) + "</option>";
          }).join("") +
        "</select></label>" +
        '<div class="a-field"><span>팀</span>' + rowsHTML("team", d.team) + "</div>" +

        '<h3 class="a-sub">SOCIALS</h3>' + rowsHTML("socials", d.socials) +
        '<h3 class="a-sub">FAQ</h3>' + rowsHTML("faq", d.faq) +
        '<h3 class="a-sub">PRESS KIT</h3>' +
        '<label class="a-field"><span>프레스 연락처</span><input type="text" name="pressContact" value="' + esc(d.pressContact) + '" placeholder="이메일이나 계정"></label>' +

        (d.introExample ? '<p class="a-hint">지금 소개 문단은 예시예요. 저장하면 예시 표시가 사라져요.</p>' : "") +
        '<p class="a-error" id="studio-error" role="alert"></p>' +
        '<div class="a-actions"><button type="submit" class="a-btn primary">저장</button>' +
          '<button type="button" class="a-btn" data-act="revert">고친 내용 되돌리기</button>' +
          '<a class="a-link" target="_blank" rel="noopener" href="index.html">첫 화면 보기</a>' +
          '<a class="a-link" target="_blank" rel="noopener" href="about.html">ABOUT 보기</a></div>' +
      "</form>";

    var form = $("#studio-form");
    paintThumb($("#hero-drop"), heroD);
    paintThumb($("#logo-drop"), logoD);
    bindDrop($("#hero-drop"), function (f) { readStudio(); d._hero = f; d._heroBlob = URL.createObjectURL(f); d._heroRemove = false; S.studioDirty = true; renderStudio(); },
      function () { readStudio(); d._hero = null; d._heroRemove = true; S.studioDirty = true; renderStudio(); });
    bindDrop($("#logo-drop"), function (f) { readStudio(); d._logo = f; d._logoBlob = URL.createObjectURL(f); d._logoRemove = false; S.studioDirty = true; renderStudio(); },
      function () { readStudio(); d._logo = null; d._logoRemove = true; S.studioDirty = true; renderStudio(); });

    d.team.forEach(function (m, i) {
      var im = form.querySelector('[data-photo-img="' + i + '"]');
      if (im) (m._blob ? Promise.resolve(m._blob) : imgURL(m.photo)).then(function (u) { im.src = u; });
    });

    form.addEventListener("input", function () { S.studioDirty = true; });
    form.addEventListener("change", function (e) {
      var pi = e.target.dataset.photoInput;
      if (pi !== undefined && e.target.files[0]) {
        readStudio();
        var m = d.team[+pi];
        m._file = e.target.files[0]; m._blob = URL.createObjectURL(m._file);
        S.studioDirty = true; renderStudio();
      }
    });
    form.addEventListener("click", function (e) {
      var t = e.target;
      var photo = t.closest("[data-photo]");
      if (photo) { form.querySelector('[data-photo-input="' + photo.dataset.photo + '"]').click(); return; }
      var box = t.closest("[data-rows]");
      if (!box) { if (t.closest('[data-act="revert"]')) { S.sd = null; S.studioDirty = false; renderStudio(); } return; }
      var kind = box.dataset.rows, list = d[kind];
      if (t.closest("[data-row-add]")) { readStudio(); list.push({}); }
      else if (t.closest("[data-row-rm]")) { readStudio(); list.splice(+t.closest("[data-row-rm]").dataset.rowRm, 1); }
      else if (t.closest("[data-row-move]")) {
        readStudio();
        var b = t.closest("[data-row-move]"), i = +b.dataset.i, j = i + (+b.dataset.rowMove);
        var x = list[i]; list[i] = list[j]; list[j] = x;
      } else return;
      S.studioDirty = true; renderStudio();
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); saveStudio(); });
  }

  function readStudio() {
    var f = $("#studio-form"), d = S.sd;
    if (!f || !d) return;
    d.slogan.en = f.sloganEn.value; d.slogan.ko = f.sloganKo.value;
    d.statement.text = f.stText.value; d.statement.by = f.stBy.value;
    d.intro = f.intro.value.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    d._essayKey = f.essay.value;
    d.pressContact = f.pressContact.value;
    $$("[data-rows] [data-k]", f).forEach(function (inp) {
      var kind = inp.closest("[data-rows]").dataset.rows;
      var row = d[kind][+inp.dataset.i];
      if (row[inp.dataset.k] !== inp.value) { row[inp.dataset.k] = inp.value; delete row.example; }
    });
  }

  async function saveStudio() {
    readStudio();
    var d = S.sd, err = $("#studio-error");
    try {
      var key = d._essayKey || "", essay = "";
      if (key.indexOf("__") === 0) {
        var r = S.records[+key.slice(2)];
        var base = "essay-" + r.date, id = base, n = 2;
        while (S.records.some(function (x) { return x.id === id; })) id = base + "-" + n++;
        r.id = id;
        await saveData("records");
        essay = id;
      } else essay = key;
      if (d._hero) d.heroImage = await storeImage(d._hero, today(), "hero");
      if (d._heroRemove) d.heroImage = "";
      if (d._logo) d.logo = await storeImage(d._logo, today(), "logo");
      if (d._logoRemove) d.logo = "";
      for (var i = 0; i < d.team.length; i++) {
        if (d.team[i]._file) d.team[i].photo = await storeImage(d.team[i]._file, today(), "team");
      }
      S.studio = {
        slogan: d.slogan, heroImage: d.heroImage, logo: d.logo, statement: d.statement,
        intro: d.intro, // 저장하면 예시 표시는 사라짐
        essay: essay, team: d.team, socials: d.socials, faq: d.faq, pressContact: d.pressContact
      };
      await saveData("studio");
      S.sd = null; S.studioDirty = false;
      renderStudio(); renderRecList();
      toast("스튜디오 정보를 저장했어요.");
    } catch (e) {
      console.error(e);
      err.textContent = "저장하지 못했어요. " + (e.message || "");
    }
  }

  /* ---------- 공통 ---------- */

  $("#publish-help").addEventListener("click", function () { $("#publish-dialog").showModal(); });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      var f = S.tab === "records" ? $("#rec-form") : S.tab === "games" ? $("#game-form") : $("#studio-form");
      if (f) { e.preventDefault(); f.requestSubmit(); }
    }
  });
  window.addEventListener("beforeunload", function (e) {
    if (S.rec.dirty || S.game.dirty || S.studioDirty) { e.preventDefault(); e.returnValue = ""; }
  });

  initGate();
  window.__laodeerAdmin = S; // 테스트·디버깅용
})();

/*
  LaoDeer 작업실: 움직임과 놀이
  - 그림 크게 보기 (휠·핀치 확대, 끌어서 이동, 좌우 넘기기, 키보드)
  - 게임 카드 기울이기 (마우스를 따라 3D로 기울고 빛이 지나감)
  - 게임 패드처럼 J/K로 기록 사이 이동, ?로 단축키 보기
  - 효과음 (Web Audio로 그 자리에서 합성, 기본은 꺼짐)
  - 로고 글자 통통 튀기
  - 소개 페이지 낙서장 (펜 압력, 되돌리기, 이미지로 저장)
  - 숨은 커맨드 하나
  움직임 줄이기 설정을 켠 사람에게는 움직임 효과를 끕니다.
*/
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && matchMedia("(pointer: fine)").matches;

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* ---------- 알림 ---------- */

  var toastEl = el("div", { class: "toast", role: "status", "aria-live": "polite" });
  document.body.appendChild(toastEl);
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  }

  /* ---------- 효과음 ---------- */

  var Sound = (function () {
    var ctx = null;
    var on = store("laodeer-sound") === "on";
    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, start, dur, type, gain, slideTo) {
      var c = ac(); if (!c) return;
      var t = c.currentTime + start;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    var sfx = {
      tick: function () { tone(880, 0, 0.06, "square", 0.035); },
      select: function () { tone(523, 0, 0.07, "square", 0.04); tone(784, 0.06, 0.09, "square", 0.04); },
      open: function () { tone(392, 0, 0.16, "triangle", 0.08, 784); },
      close: function () { tone(784, 0, 0.14, "triangle", 0.07, 392); },
      page: function () { tone(660, 0, 0.05, "triangle", 0.06); },
      secret: function () {
        [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.12, "square", 0.045); });
      }
    };
    return {
      get on() { return on; },
      set: function (v) { on = v; store("laodeer-sound", v ? "on" : "off"); },
      play: function (name) { if (on && sfx[name]) sfx[name](); }
    };
  })();

  /* ---------- 발 띠: 소리, 단축키 ---------- */

  var foot = document.querySelector("footer.site");
  if (foot) {
    var tools = el("div", { class: "foot-tools" },
      '<button type="button" class="chip" id="sound-toggle" aria-pressed="' + Sound.on + '">효과음</button>' +
      '<button type="button" class="chip" id="help-open" aria-haspopup="dialog">단축키</button>');
    foot.appendChild(tools);
    var sb = document.getElementById("sound-toggle");
    sb.addEventListener("click", function () {
      Sound.set(!Sound.on);
      sb.setAttribute("aria-pressed", String(Sound.on));
      Sound.play("select");
      toast(Sound.on ? "효과음을 켰어요." : "효과음을 껐어요.");
    });
    document.getElementById("help-open").addEventListener("click", openHelp);
  }

  /* 버튼 소리 */
  document.addEventListener("click", function (e) {
    if (e.target.closest(".filters button")) Sound.play("select");
    else if (e.target.closest("button.read")) Sound.play("tick");
  });

  /* ---------- 로고 글자 ---------- */

  var mark = document.querySelector(".mark");
  if (mark && !mark.dataset.split) {
    var word = mark.textContent;
    mark.dataset.split = "1";
    mark.setAttribute("aria-label", word);
    mark.innerHTML = word.split("").map(function (ch, i) {
      return '<span aria-hidden="true" style="--i:' + i + '">' + ch + "</span>";
    }).join("");
  }

  /* ---------- 기울이기 ---------- */

  function bindTilt(root) {
    if (!finePointer || reduceMotion) return;
    [].forEach.call((root || document).querySelectorAll(".tilt:not([data-tilt])"), function (t) {
      t.dataset.tilt = "1";
      var max = t.classList.contains("soft") ? 2.5 : 9;
      var raf = 0, px = 0, py = 0;
      function paint() {
        raf = 0;
        t.style.transform = "perspective(900px) rotateX(" + (-py * max) + "deg) rotateY(" + (px * max) + "deg) scale(1.015)";
        t.style.setProperty("--gx", (px + 0.5) * 100 + "%");
        t.style.setProperty("--gy", (py + 0.5) * 100 + "%");
      }
      t.addEventListener("pointermove", function (e) {
        var r = t.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width - 0.5;
        py = (e.clientY - r.top) / r.height - 0.5;
        t.classList.add("tilting");
        if (!raf) raf = requestAnimationFrame(paint);
      });
      t.addEventListener("pointerleave", function () {
        t.classList.remove("tilting");
        t.style.transform = "";
      });
    });
  }

  /* ---------- 그림 크게 보기 ---------- */

  var Viewer = (function () {
    var dlg, stage, pic, cap, count, items = [], idx = 0;
    var s = 1, tx = 0, ty = 0;
    var pointers = new Map(), pinch = null, drag = null;

    function build() {
      dlg = el("dialog", { class: "viewer", "aria-label": "그림 크게 보기" },
        '<div class="v-stage"><img alt=""></div>' +
        '<div class="v-bar">' +
          '<p class="v-cap"></p>' +
          '<p class="v-count" aria-live="polite"></p>' +
          '<div class="v-btns">' +
            '<button type="button" data-act="prev" aria-label="이전 그림">이전</button>' +
            '<button type="button" data-act="next" aria-label="다음 그림">다음</button>' +
            '<button type="button" data-act="out" aria-label="축소">−</button>' +
            '<button type="button" data-act="in" aria-label="확대">+</button>' +
            '<button type="button" data-act="close" class="v-close">닫기</button>' +
          "</div>" +
        "</div>");
      document.body.appendChild(dlg);
      stage = dlg.querySelector(".v-stage");
      pic = stage.querySelector("img");
      cap = dlg.querySelector(".v-cap");
      count = dlg.querySelector(".v-count");

      dlg.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-act]");
        if (b) return act(b.dataset.act);
        if (e.target === dlg || (e.target === stage && s === 1)) close();
      });
      dlg.addEventListener("close", function () { Sound.play("close"); document.documentElement.classList.remove("viewing"); });
      dlg.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { act("prev"); e.preventDefault(); }
        else if (e.key === "ArrowRight") { act("next"); e.preventDefault(); }
        else if (e.key === "+" || e.key === "=") act("in");
        else if (e.key === "-" || e.key === "_") act("out");
        else if (e.key === "0") reset();
      });

      stage.addEventListener("wheel", function (e) {
        e.preventDefault();
        zoomAt(s * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
      }, { passive: false });
      stage.addEventListener("dblclick", function (e) {
        zoomAt(s > 1 ? 1 : 2.5, e.clientX, e.clientY);
      });
      stage.addEventListener("pointerdown", function (e) {
        stage.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          var p = [].slice.call(pointers.values());
          pinch = { d: dist(p[0], p[1]), s: s };
          drag = null;
        } else if (pointers.size === 1) {
          drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, t: Date.now() };
        }
      });
      stage.addEventListener("pointermove", function (e) {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pointers.size === 2) {
          var p = [].slice.call(pointers.values());
          zoomAt(pinch.s * dist(p[0], p[1]) / pinch.d, (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
        } else if (drag && s > 1) {
          tx = drag.tx + (e.clientX - drag.x);
          ty = drag.ty + (e.clientY - drag.y);
          paint();
        } else if (drag) {
          pic.style.transform = "translateX(" + (e.clientX - drag.x) * 0.4 + "px)";
        }
      });
      function up(e) {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (drag && s === 1) {
          var dx = e.clientX - drag.x;
          if (Math.abs(dx) > 60 && Date.now() - drag.t < 800) act(dx < 0 ? "next" : "prev");
          else paint();
        }
        drag = null;
      }
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointercancel", up);
    }

    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function paint() {
      pic.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
      stage.classList.toggle("zoomed", s > 1);
    }
    function reset() { s = 1; tx = 0; ty = 0; paint(); }
    function zoomAt(next, cx, cy) {
      next = Math.min(5, Math.max(1, next));
      var r = stage.getBoundingClientRect();
      var px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
      tx = px - (px - tx) * (next / s);
      ty = py - (py - ty) * (next / s);
      s = next;
      if (s === 1) { tx = 0; ty = 0; }
      paint();
    }
    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      pic.src = it.dataset.src;
      pic.alt = (it.getAttribute("aria-label") || "").replace(/^크게 보기: /, "");
      cap.textContent = it.dataset.caption || "";
      count.textContent = items.length > 1 ? (idx + 1) + " / " + items.length : "";
      reset();
    }
    function act(a) {
      if (a === "close") return close();
      if (a === "in") return zoomAt(s * 1.5, innerWidth / 2, innerHeight / 2);
      if (a === "out") return zoomAt(s / 1.5, innerWidth / 2, innerHeight / 2);
      if (items.length < 2) return;
      Sound.play("page");
      show(idx + (a === "next" ? 1 : -1));
    }
    function open(btn) {
      if (!dlg) build();
      items = [].slice.call(document.querySelectorAll(".zoom"));
      dlg.querySelector('[data-act="prev"]').hidden = items.length < 2;
      dlg.querySelector('[data-act="next"]').hidden = items.length < 2;
      show(items.indexOf(btn));
      document.documentElement.classList.add("viewing");
      dlg.showModal();
      Sound.play("open");
    }
    function close() { if (dlg && dlg.open) dlg.close(); }
    return { open: open, close: close, get el() { return dlg; } };
  })();

  document.addEventListener("click", function (e) {
    var z = e.target.closest(".zoom");
    if (z) Viewer.open(z);
  });

  /* ---------- 단축키 도움말 ---------- */

  var helpDlg;
  function openHelp() {
    if (!helpDlg) {
      helpDlg = el("dialog", { class: "help", "aria-labelledby": "help-title" },
        '<h2 id="help-title">단축키</h2>' +
        '<dl>' +
          "<div><dt><kbd>J</kbd></dt><dd>다음 기록</dd></div>" +
          "<div><dt><kbd>K</kbd></dt><dd>이전 기록</dd></div>" +
          "<div><dt><kbd>Enter</kbd></dt><dd>고른 기록의 그림 크게 보기</dd></div>" +
          "<div><dt><kbd>1</kbd>~<kbd>4</kbd></dt><dd>분류 고르기</dd></div>" +
          "<div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>크게 보기에서 그림 넘기기</dd></div>" +
          "<div><dt><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd></dt><dd>확대, 축소, 원래 크기</dd></div>" +
          "<div><dt><kbd>Esc</kbd></dt><dd>닫기</dd></div>" +
        "</dl>" +
        '<form method="dialog"><button class="chip">닫기</button></form>');
      document.body.appendChild(helpDlg);
      helpDlg.addEventListener("click", function (e) { if (e.target === helpDlg) helpDlg.close(); });
    }
    if (!helpDlg.open) { helpDlg.showModal(); Sound.play("open"); }
  }

  /* ---------- 게임 패드처럼 기록 이동 ---------- */

  function entries() { return [].slice.call(document.querySelectorAll(".entry")); }
  function currentIndex(list) {
    var a = document.activeElement;
    var i = list.indexOf(a && a.closest ? a.closest(".entry") : null);
    if (i >= 0) return i;
    for (var k = 0; k < list.length; k++) if (list[k].getBoundingClientRect().top > 10) return k - 1;
    return list.length - 1;
  }
  function step(dir) {
    var list = entries();
    if (!list.length) return;
    var i = Math.min(list.length - 1, Math.max(0, currentIndex(list) + dir));
    var t = list[i];
    t.focus({ preventScroll: true });
    t.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    Sound.play("tick");
  }

  /* ---------- 숨은 커맨드 ---------- */

  var CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  var codePos = 0;
  function secret() {
    Sound.play("secret");
    toast("숨은 커맨드를 찾았어요!");
    document.documentElement.classList.add("secret");
    setTimeout(function () { document.documentElement.classList.remove("secret"); }, 4200);
    if (!reduceMotion) leaves();
  }
  function leaves() {
    var c = el("canvas", { class: "leaves", "aria-hidden": "true" });
    document.body.appendChild(c);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    var colors = ["#FDA828", "#06331E", "#FDA828", "#2E6B47"];
    var ps = [];
    for (var i = 0; i < 90; i++) {
      ps.push({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
        vy: 1.2 + Math.random() * 2.2, sway: Math.random() * Math.PI * 2,
        r: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.12,
        c: colors[i % colors.length]
      });
    }
    var start = performance.now();
    (function frame(now) {
      var t = (now - start) / 1000;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = t > 3.2 ? Math.max(0, 1 - (t - 3.2) / 0.8) : 1;
      ps.forEach(function (p) {
        p.sway += 0.04; p.y += p.vy; p.x += Math.sin(p.sway) * 1.3; p.rot += p.vr;
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = p.c;
        g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      });
      if (t < 4) requestAnimationFrame(frame); else c.remove();
    })(start);
  }

  /* ---------- 키보드 ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    codePos = k === CODE[codePos] ? codePos + 1 : (k === CODE[0] ? 1 : 0);
    if (codePos === CODE.length) { codePos = 0; secret(); return; }

    if (document.querySelector("dialog[open]")) return;
    if (k === "j") { step(1); e.preventDefault(); }
    else if (k === "k") { step(-1); e.preventDefault(); }
    else if (k === "?") { openHelp(); e.preventDefault(); }
    else if (/^[1-4]$/.test(k)) {
      var b = document.querySelectorAll(".filters button")[+k - 1];
      if (b) b.click();
    } else if (k === "Enter" && document.activeElement && document.activeElement.classList.contains("entry")) {
      var z = document.activeElement.querySelector(".zoom");
      if (z) { z.click(); e.preventDefault(); }
    }
  });

  /* ---------- 낙서장 (소개 페이지) ---------- */

  function initPad() {
    var pad = document.getElementById("pad");
    if (!pad) return;
    var canvas = pad.querySelector("canvas");
    var g = canvas.getContext("2d", { willReadFrequently: true });
    var PAPER = "#FEEFD7";
    var color = "#06331E", size = 4, erasing = false;
    var undo = [], drawing = null, dpr = 1;

    function fit() {
      var old = document.createElement("canvas");
      old.width = canvas.width; old.height = canvas.height;
      if (canvas.width) old.getContext("2d").drawImage(canvas, 0, 0);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = PAPER; g.fillRect(0, 0, canvas.width, canvas.height);
      if (old.width) g.drawImage(old, 0, 0, canvas.width, canvas.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineCap = "round"; g.lineJoin = "round";
    }
    fit();
    if (window.ResizeObserver) {
      var lastW = canvas.clientWidth;
      new ResizeObserver(function () {
        if (Math.abs(canvas.clientWidth - lastW) > 2) { lastW = canvas.clientWidth; fit(); }
      }).observe(canvas);
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure && e.pointerType === "pen" ? e.pressure : 0.5 };
    }
    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture(e.pointerId);
      undo.push(g.getImageData(0, 0, canvas.width, canvas.height));
      if (undo.length > 20) undo.shift();
      var p = pos(e);
      drawing = { last: p, mid: p };
      g.strokeStyle = g.fillStyle = erasing ? PAPER : color;
      g.beginPath(); g.arc(p.x, p.y, (erasing ? size * 3 : size) * (0.5 + p.p) / 2, 0, Math.PI * 2); g.fill();
      pad.classList.add("used");
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach(function (ev) {
        var p = pos(ev), l = drawing.last;
        var mid = { x: (l.x + p.x) / 2, y: (l.y + p.y) / 2 };
        g.lineWidth = (erasing ? size * 3 : size) * (0.5 + p.p);
        g.beginPath();
        g.moveTo(drawing.mid.x, drawing.mid.y);
        g.quadraticCurveTo(l.x, l.y, mid.x, mid.y);
        g.stroke();
        drawing.last = p; drawing.mid = mid;
      });
    });
    function end() { drawing = null; }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    function doUndo() {
      var d = undo.pop();
      if (d) { g.putImageData(d, 0, 0); Sound.play("tick"); }
    }

    pad.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.color) {
        color = b.dataset.color; erasing = false;
        pad.querySelectorAll("[data-color],[data-tool=erase]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      } else if (b.dataset.size) {
        size = +b.dataset.size;
        pad.querySelectorAll("[data-size]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      } else if (b.dataset.tool === "erase") {
        erasing = true;
        pad.querySelectorAll("[data-color],[data-tool=erase]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      } else if (b.dataset.tool === "undo") {
        return doUndo();
      } else if (b.dataset.tool === "clear") {
        undo.push(g.getImageData(0, 0, canvas.width, canvas.height));
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, canvas.width, canvas.height); g.restore();
        pad.classList.remove("used");
        toast("낙서장을 비웠어요. 되돌리기로 다시 살릴 수 있어요.");
      } else if (b.dataset.tool === "save") {
        canvas.toBlob(function (blob) {
          var a = el("a", { href: URL.createObjectURL(blob), download: "laodeer-낙서.png" });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          toast("낙서를 이미지로 저장했어요.");
        });
      }
      Sound.play("tick");
    });
    pad.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); }
    });
  }

  /* ---------- 첫 화면 장면: 마우스와 스크롤에 따라 천천히 움직임 ---------- */

  function initHero() {
    var hero = document.querySelector(".hero");
    var bg = hero && hero.querySelector(".hero-bg img");
    if (!bg || reduceMotion) return;
    var mx = 0, my = 0, raf = 0;
    function paint() {
      raf = 0;
      var sy = Math.min(window.scrollY, hero.offsetHeight) * 0.25;
      bg.style.setProperty("--px", (mx * -14).toFixed(1) + "px");
      bg.style.setProperty("--py", (my * -10 + sy).toFixed(1) + "px");
    }
    function ask() { if (!raf) raf = requestAnimationFrame(paint); }
    if (finePointer) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = (e.clientY - r.top) / r.height - 0.5;
        ask();
      });
      hero.addEventListener("pointerleave", function () { mx = 0; my = 0; ask(); });
    }
    window.addEventListener("scroll", ask, { passive: true });
  }

  /* ---------- 시작 ---------- */

  function boot() {
    bindTilt(document);
    initPad();
    initHero();
  }
  boot();
  document.addEventListener("laodeer:rendered", function () { bindTilt(document); });
})();

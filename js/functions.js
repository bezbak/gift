"use strict";
/* =============================================================================
   ФУНКЦИИ — движок и логика (зависит от js/models.js, работает с DOM)
   -----------------------------------------------------------------------------
   Разделы:
     1.  AUDIO            — мини-синтез звука на WebAudio (без файлов)
     2.  DOM + ХЕЛПЕРЫ    — ссылки на узлы, инвентарь, toast, эффекты
     3.  ПРИМИТИВЫ СЦЕНЫ  — layerImg / ph / hotspot
     4.  buildScene()     — описание всех видов (стены + крупные планы)
     5.  SVG-ХЕЛПЕРЫ      — плейсхолдерная графика
     6.  ЛОГИКА ГОЛОВОЛОМОК — morseTap / quiltTap / stainTap / tryCombine
     7.  РЕНДЕР + НАВИГАЦИЯ — renderBar / refresh / go / turn / back
     8.  ПОДСКАЗКИ        — currentHint()
     9.  ФИНАЛ            — endGame()
     10. АВТОТЕСТ         — selfTest()  (вызывается из main.js по ?selftest)

   Как добавить новый вид (объект / крупный план / даже новую комнату):
     - добавить `case "my_view":` в switch внутри buildScene()
     - вернуть слои (B.layers), декор (B.nodes) и зоны клика (B.hs)
     - переход в него: go("my_view")
   ============================================================================= */

/* =========================================================================
   1. AUDIO — крошечные блипы на WebAudio, ассеты не нужны
   ========================================================================= */
const Audio2 = (() => {
  let ctx = null;
  const on = () => {
    if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    return ctx;
  };
  function beep(freq, dur, type, vol) {
    const c = on(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(c.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.12));
    o.stop(c.currentTime + (dur || 0.12) + 0.02);
  }
  return {
    click: () => beep(320, 0.06, "square", 0.03),
    pick:  () => { beep(520, 0.08, "sine"); setTimeout(() => beep(780, 0.1, "sine"), 70); },
    good:  () => { beep(523, 0.1); setTimeout(() => beep(659, 0.1), 90); setTimeout(() => beep(880, 0.16), 180); },
    bad:   () => beep(140, 0.22, "sawtooth", 0.05),
    crack: () => { for (let i = 0; i < 7; i++) setTimeout(() => beep(90 + Math.random() * 400, 0.05, "sawtooth", 0.05), i * 35); },
    grow:  () => { beep(200, 0.5, "sine", 0.04); setTimeout(() => beep(400, 0.4, "sine", 0.03), 120); },
  };
})();

/* =========================================================================
   2. DOM + ХЕЛПЕРЫ
   ========================================================================= */
const $ = s => document.querySelector(s);
const scene   = $("#scene"),
      fx      = $("#fx"),
      bar     = $("#bar"),
      navL    = $("#navL"),
      navR    = $("#navR"),
      backBtn = $("#backBtn"),
      toastEl = $("#toast"),
      stage   = $("#stage");

let toastT = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("show"), 1900);
}

function has(id)  { return S.inv.includes(id); }
function give(id) { if (!has(id)) { S.inv.push(id); Audio2.pick(); } renderBar(); }
function take(id) { S.inv = S.inv.filter(x => x !== id); if (S.selected === id) S.selected = null; renderBar(); }
function select(id) {
  S.selected = (S.selected === id ? null : id);
  renderBar();
  stage.classList.toggle("holding", !!S.selected);
}

function flashFX() {
  const d = document.createElement("div");
  d.className = "flash";
  fx.appendChild(d);
  setTimeout(() => d.remove(), 520);
}
function shakeScene() {
  scene.classList.add("shake");
  setTimeout(() => scene.classList.remove("shake"), 420);
}

/* =========================================================================
   3. ПРИМИТИВЫ СЦЕНЫ
   ========================================================================= */
function layerImg(src) {
  const i = document.createElement("img");
  i.className = "layer";
  i.src = IMG + src;
  return i;
}

/* Прямоугольный CSS-плейсхолдер мебели. cls: "" | "wood" | "metal" | "glasswin" */
function ph(cls, label, l, t, w, h) {
  const d = document.createElement("div");
  d.className = "ph " + cls;
  d.textContent = label || "";
  d.style.left = l + "%"; d.style.top = t + "%";
  d.style.width = w + "%"; d.style.height = h + "%";
  return d;
}

/* Зона клика. o = { r:[left,top,w,h] в %, title, zoom?, click?(), use?(item) }
   use() возвращает: true — применено (предмет уходит из руки),
                     "keep" — применено, предмет остаётся в руке,
                     иначе  — «ничего не происходит». */
function hotspot(o) {
  const d = document.createElement("div");
  d.className = "hs" + (o.zoom ? " zoomable" : "");
  d.style.left = o.r[0] + "%"; d.style.top = o.r[1] + "%";
  d.style.width = o.r[2] + "%"; d.style.height = o.r[3] + "%";
  d.title = o.title || "";
  d.addEventListener("click", e => {
    e.stopPropagation();
    Audio2.click();
    if (S.selected) {
      const it = S.selected;
      const res = o.use && o.use(it);
      if (res === true) { select(null); }
      else if (res === "keep") { /* предмет остаётся в руке */ }
      else { toast("Ничего не происходит."); }
    } else {
      if (o.click) o.click();
      else if (o.title) toast(o.title);
    }
  });
  return d;
}

/* =========================================================================
   4. buildScene() — описания видов
   Возвращает { layers:[], nodes:[], hs:[], nav:bool }
   ========================================================================= */
function buildScene() {
  const B = { layers: [], nodes: [], hs: [], nav: false };
  const f = S.f;

  switch (S.view) {

    /* ============ WALL 0 : кровать + тумбочка ============ */
    case "wall0": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"), layerImg("bed.png"), layerImg("nightstand.png"));
      B.hs.push(hotspot({
        r: [14, 40, 26, 34], title: "Лоскутное одеяло на кровати.", zoom: true,
        click: () => go("quilt")
      }));
      B.hs.push(hotspot({
        r: [10, 40, 6, 26], title: "Резное изголовье кровати.", zoom: true,
        click: () => go("headboard")
      }));
      B.hs.push(hotspot({
        r: [70, 64, 17, 24], title: "Старая прикроватная тумбочка.", zoom: true,
        click: () => go("nightstand")
      }));
      B.hs.push(hotspot({
        r: [71, 58, 15, 7], title: "Верхняя крышка тумбочки — вся в тёмных пятнах.", zoom: true,
        click: () => go("stains")
      }));
      if (f.sap && !f.handkerchief) {
        B.hs.push(hotspot({
          r: [22, 86, 12, 9], title: "Что-то белеет на полу за ножкой кровати…",
          click: () => { give("handkerchief_dry"); f.handkerchief = true; toast("Сухая салфетка."); refresh(); }
        }));
        const g = ph("", "", 23, 88, 7, 5);
        g.style.borderRadius = "50%";
        g.style.background = "rgba(230,225,210,.85)";
        B.nodes.push(g);
      }
      break;
    }

    /* ============ WALL 1 : окно, горшок, полка, фонограф, холодильник ============ */
    case "wall1": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"));
      // окна
      B.nodes.push(ph("glasswin", "", 15, 12, 27, 30));
      B.nodes.push(ph("glasswin", "", 57, 12, 27, 30));
      // птицы на окнах (подсказка для памяти)
      BIRD_CELLS.forEach(c => {
        const col = c % 4, row = Math.floor(c / 4);
        const winL = col < 2 ? 15 : 57;
        const x = winL + (col % 2) * 13.5 + 7;
        const y = 12 + row * 15 + 7.5;
        const b = document.createElement("div");
        b.className = "bird";
        b.style.left = x + "%"; b.style.top = y + "%";
        b.innerHTML = '<svg viewBox="0 0 40 40"><path d="M4 26c8-10 12-2 16 0 4-2 8-10 16 0-6 2-10 8-16 6-6 2-10-4-16-6z" fill="' + BIRD_COLORS[c] + '" stroke="#20140a" stroke-width="2"/></svg>';
        B.nodes.push(b);
      });
      // горшок на подоконнике (в зазоре между окнами)
      const potState = f.grown ? "цветок" : (f.planted ? "росток" : "пустой горшок");
      B.nodes.push(ph("wood", "", 43, 44, 14, 4));
      B.hs.push(hotspot({
        r: [44, 26, 12, 20], title: "Керамический горшок с землёй на подоконнике (" + potState + ").", zoom: true,
        click: () => go("pot")
      }));
      const potBox = document.createElement("div");
      potBox.style.cssText = "position:absolute;left:45%;top:30%;width:10%;height:14%;background:linear-gradient(160deg,#a05a34,#5f331c);border:2px solid #14100c;border-radius:4px 4px 40% 40%;pointer-events:none";
      if (f.grown) {
        const fl = document.createElement("div");
        fl.style.cssText = "position:absolute;left:50%;bottom:90%;width:220%;height:180%;transform:translateX(-50%);";
        fl.innerHTML = flowerSVG(f.cut, f.brokenOff);
        potBox.appendChild(fl);
      } else if (f.planted) {
        const s = document.createElement("div");
        s.style.cssText = "position:absolute;left:44%;bottom:80%;width:12%;height:70%;background:#4a6a1a";
        potBox.appendChild(s);
      }
      B.nodes.push(potBox);
      // полка + валик
      B.nodes.push(ph("wood", "полка", 6, 40, 12, 3));
      if (!f.roller) {
        B.hs.push(hotspot({
          r: [7, 36, 10, 5], title: "На полке лежит малярный валик.",
          click: () => { give("roller"); f.roller = true; toast("Малярный валик."); refresh(); }
        }));
        B.nodes.push(ph("metal", "валик", 8, 36, 7, 4));
      }
      // фонограф
      B.nodes.push(ph("wood", "фонограф", 6, 55, 16, 20));
      B.hs.push(hotspot({
        r: [6, 55, 16, 20],
        title: f.phono ? "Фонограф. Отсек открыт." : "Старый фонограф с большим раструбом.",
        zoom: true, click: () => go("phono")
      }));
      // мини-холодильник
      B.nodes.push(ph("metal", f.fridgeOpen ? "холодильник (открыт)" : "мини-холодильник", 80, 58, 16, 26));
      B.hs.push(hotspot({
        r: [80, 56, 16, 30], title: "Мини-холодильник тихо гудит.", zoom: true,
        click: () => go("fridge")
      }));
      break;
    }

    /* ============ WALL 2 : картина + зеркало ============ */
    case "wall2": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"));
      // картина
      B.nodes.push(layerImg("painting.png"));
      B.hs.push(hotspot({
        r: [24, 12, 18, 20], title: "Картина в декоративной рамке из точек и тире.", zoom: true,
        click: () => go("painting")
      }));
      // портрет-подсказка
      B.nodes.push(ph("wood", "портрет-подсказка", 60, 16, 13, 17));
      const inner = document.createElement("div");
      inner.style.cssText = "position:absolute;left:62%;top:19%;width:9%;height:11%;background:#d8c39a;border:1px solid #3a2c1c;display:flex;align-items:center;justify-content:center;color:#3a2c1c;font-size:9px;text-align:center;line-height:1.1;pointer-events:none";
      inner.textContent = "цветок — за ухо";
      B.nodes.push(inner);
      B.hs.push(hotspot({ r: [60, 16, 13, 17], title: "На портрете стрелка указывает Варе за ухо." }));
      // зеркало
      B.hs.push(hotspot({
        r: [38, 42, 24, 40],
        title: f.mirrorCracked ? "Треснувшее зеркало. Один осколок держится еле-еле." : "Большое зеркало. В нём — отражение Вари.",
        zoom: true, click: () => go("mirror")
      }));
      const m = document.createElement("div");
      m.style.cssText = "position:absolute;left:38%;top:42%;width:24%;height:40%;border:6px solid #6b4a2a;border-radius:60% 60% 8% 8%;background:linear-gradient(160deg,rgba(180,200,210,.45),rgba(120,140,160,.3));pointer-events:none";
      B.nodes.push(m);
      if (f.mirrorCracked) {
        const c = document.createElement("div");
        c.className = "cracks on";
        c.style.cssText += "position:absolute;left:38%;top:42%;width:24%;height:40%;pointer-events:none;";
        c.innerHTML = crackSVG();
        B.nodes.push(c);
      }
      break;
    }

    /* ============ WALL 3 : сапог + банки ============ */
    case "wall3": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"));
      // сапог
      B.nodes.push(ph("metal", "чугунный сапог", 42, 58, 16, 30));
      B.hs.push(hotspot({
        r: [41, 54, 18, 34],
        title: f.knife ? "В сапоге больше ничего нет." : "Тяжёлый чугунный сапог. На боку — жёлтые точки и коричневая звезда.",
        zoom: true, click: () => go("boot")
      }));
      // банки
      const j1 = ph("", "жёлтая", 26, 64, 9, 16);
      j1.style.background = "linear-gradient(160deg,#e9d24e,#b9a11f)"; j1.style.borderColor = "#3a2c1c";
      const j2 = ph("", "коричневая", 64, 64, 9, 16);
      j2.style.background = "linear-gradient(160deg,#7a4a24,#4a2c14)"; j2.style.borderColor = "#3a2c1c"; j2.style.color = "#eee";
      B.nodes.push(j1, j2);
      if (!f.morse) {
        B.hs.push(hotspot({
          r: [26, 62, 9, 20], title: "Банка с жёлтой жижей.",
          click: () => toast("Чтобы залить жижу, откройте сапог крупным планом.")
        }));
        B.hs.push(hotspot({
          r: [64, 62, 9, 20], title: "Банка с коричневой жижей.",
          click: () => toast("Чтобы залить жижу, откройте сапог крупным планом.")
        }));
      }
      break;
    }

    /* ============ ZOOM: painting (Морзе) ============ */
    case "painting": {
      B.layers.push(layerImg("room_bg.png"));
      const p = document.createElement("div");
      p.style.cssText = "position:absolute;left:22%;top:14%;width:56%;height:64%;background:#cbb58a;border:14px solid #3c2a16;box-shadow:0 10px 40px #000;pointer-events:none";
      B.nodes.push(p);
      const inside = document.createElement("div");
      inside.style.cssText = "position:absolute;left:27%;top:20%;width:46%;height:52%;background:linear-gradient(160deg,#6b7b8c,#3a4653);pointer-events:none;display:flex;align-items:center;justify-content:center;color:#cdd6df;font-size:13px";
      inside.textContent = "«Портрет в тумане»";
      B.nodes.push(inside);
      // узор рамки из точек/тире вдоль верхнего края
      const mrow = document.createElement("div");
      mrow.className = "morse";
      mrow.style.left = "30%"; mrow.style.top = "17%";
      MORSE.forEach(m => { const i = document.createElement("i"); i.className = m; mrow.appendChild(i); });
      B.nodes.push(mrow);
      const cap = document.createElement("div");
      cap.style.cssText = "position:absolute;left:50%;top:80%;transform:translateX(-50%);color:#e9dcc3;font-size:13px;text-align:center;width:70%";
      cap.textContent = "Узор рамки: точка · точка · тире — точка ·";
      B.nodes.push(cap);
      break;
    }

    /* ============ ZOOM: boot (ввод Морзе) ============ */
    case "boot": {
      B.layers.push(layerImg("room_bg.png"));
      const boot = document.createElement("div");
      boot.style.cssText = "position:absolute;left:26%;top:16%;width:48%;height:66%;background:linear-gradient(160deg,#8a9098,#3c4044);border:3px solid #14100c;border-radius:14px 14px 40px 40px;pointer-events:none";
      B.nodes.push(boot);
      const legend = document.createElement("div");
      legend.style.cssText = "position:absolute;left:31%;top:24%;color:#f2ead6;font-size:13px;line-height:1.7;pointer-events:none;text-shadow:0 1px 2px #000";
      legend.innerHTML = "жёлтая жижа&nbsp;=&nbsp;точка&nbsp;·<br>коричневая жижа&nbsp;=&nbsp;тире&nbsp;—";
      B.nodes.push(legend);

      if (!S.f.morse) {
        const prog = document.createElement("div");
        prog.style.cssText = "position:absolute;left:33%;top:60%;width:34%;color:#fff;font-size:20px;letter-spacing:6px;text-align:center;pointer-events:none";
        prog.textContent = S.morseInput.map(x => x === "dot" ? "·" : "—").join(" ") || "…";
        B.nodes.push(prog);
        B.hs.push(hotspot({ r: [16, 30, 16, 40], title: "Лить жёлтую жижу (точка).", click: () => morseTap("dot") }));
        B.hs.push(hotspot({ r: [68, 30, 16, 40], title: "Лить коричневую жижу (тире).", click: () => morseTap("dash") }));
        const jy = ph("", "·", 16, 30, 16, 40);
        jy.style.background = "linear-gradient(160deg,#e9d24e,#b9a11f)"; jy.style.fontSize = "22px";
        const jb = ph("", "—", 68, 30, 16, 40);
        jb.style.background = "linear-gradient(160deg,#7a4a24,#4a2c14)"; jb.style.color = "#fff"; jb.style.fontSize = "22px";
        B.nodes.push(jy, jb);
        B.hs.push(hotspot({ r: [40, 84, 20, 10], title: "Слить всё и начать заново.", click: () => { S.morseInput = []; refresh(); } }));
        B.nodes.push(ph("metal", "сброс", 40, 84, 20, 10));
      } else if (!S.f.knife) {
        const kn = document.createElement("div");
        kn.style.cssText = "position:absolute;left:38%;top:44%;width:24%;height:10%;pointer-events:none";
        kn.innerHTML = knifeSVG();
        B.nodes.push(kn);
        B.hs.push(hotspot({
          r: [36, 40, 28, 18], title: "На дне сапога лежит нож.",
          click: () => { give("knife"); S.f.knife = true; toast("Нож."); refresh(); }
        }));
      } else {
        const e = document.createElement("div");
        e.style.cssText = "position:absolute;left:50%;top:52%;transform:translateX(-50%);color:#b7a67f;font-size:14px";
        e.textContent = "Пусто.";
        B.nodes.push(e);
      }
      break;
    }

    /* ============ ZOOM: fridge ============ */
    case "fridge": {
      B.layers.push(layerImg("room_bg.png"));
      const fr = document.createElement("div");
      fr.style.cssText = "position:absolute;left:20%;top:8%;width:60%;height:80%;background:linear-gradient(160deg,#c9ced3,#8f959b);border:4px solid #14100c;border-radius:10px;pointer-events:none";
      B.nodes.push(fr);
      if (!S.f.fridgeOpen) {
        B.hs.push(hotspot({
          r: [20, 8, 60, 80], title: "Открыть холодильник.",
          click: () => { S.f.fridgeOpen = true; toast("Внутри — лёд, кусок мяса и стакан."); refresh(); }
        }));
      } else {
        const inn = document.createElement("div");
        inn.style.cssText = "position:absolute;left:26%;top:16%;width:48%;height:64%;background:linear-gradient(180deg,#dfe6ea,#aeb7bd);pointer-events:none";
        B.nodes.push(inn);
        for (let i = 0; i < 4; i++) {
          const c = document.createElement("div");
          c.style.cssText = "position:absolute;width:5%;height:7%;background:rgba(255,255,255,.7);border:1px solid #9fb;pointer-events:none;left:" + (30 + i * 6) + "%;top:" + (20 + (i % 2) * 6) + "%";
          B.nodes.push(c);
        }
        if (!S.f.glass) {
          B.hs.push(hotspot({
            r: [30, 52, 12, 18], title: "Пустой гранёный стакан.",
            click: () => { give("glass_empty"); S.f.glass = true; toast("Пустой стакан."); refresh(); }
          }));
          const g = ph("", "стакан", 30, 52, 10, 18);
          g.style.background = "rgba(220,230,235,.6)"; g.style.color = "#123";
          B.nodes.push(g);
        }
        const meat = document.createElement("div");
        meat.style.cssText = "position:absolute;left:52%;top:44%;width:16%;height:22%;background:linear-gradient(160deg,#9c3b3b,#5f1f1f);border:2px solid #2a0f0f;border-radius:20% 40% 30% 50%;pointer-events:none";
        if (!S.f.aniline) {
          const film = document.createElement("div");
          film.style.cssText = "position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(180,200,120,.5) 0 4px,transparent 4px 8px)";
          meat.appendChild(film);
        }
        B.nodes.push(meat);
        B.hs.push(hotspot({
          r: [51, 42, 18, 26],
          title: S.f.aniline ? "Кусок мяса. Налёт соскоблен." : "Кусок красного мяса, покрытый странным химическим налётом.",
          use: (it) => {
            if (it === "knife" && !S.f.aniline) {
              S.f.aniline = true; flashFX(); give("aniline"); toast("Соскоблили налёт → анилин."); refresh();
              return true;
            }
            return false;
          }
        }));
      }
      break;
    }

    /* ============ ZOOM: phonograph ============ */
    case "phono": {
      B.layers.push(layerImg("room_bg.png"));
      const body = document.createElement("div");
      body.style.cssText = "position:absolute;left:22%;top:22%;width:56%;height:56%;background:linear-gradient(160deg,#7a5236,#432a19);border:3px solid #14100c;border-radius:10px;pointer-events:none";
      B.nodes.push(body);
      const horn = document.createElement("div");
      horn.style.cssText = "position:absolute;left:54%;top:10%;width:34%;height:34%;background:radial-gradient(circle at 60% 60%,#caa96b,#6b4a2a);border:3px solid #14100c;border-radius:50% 50% 50% 4%;pointer-events:none";
      B.nodes.push(horn);
      if (!S.f.phono) {
        const slot = document.createElement("div");
        slot.style.cssText = "position:absolute;left:30%;top:44%;width:14%;height:6%;background:#14100c;pointer-events:none";
        B.nodes.push(slot);
        B.hs.push(hotspot({
          r: [28, 40, 20, 14],
          title: S.f.rollerIn ? "Валик вставлен, механизм щёлкает…" : "Узкая щель в корпусе — будто под валик.",
          use: (it) => {
            if (it === "roller") {
              take("roller"); S.f.phono = true; Audio2.crack();
              toast("С треском открылся отсек — внутри чай «Золотой лепесток».");
              refresh(); return true;
            }
            return false;
          }
        }));
      } else {
        const drw = document.createElement("div");
        drw.style.cssText = "position:absolute;left:26%;top:52%;width:48%;height:22%;background:#2a1c0e;border:2px solid #14100c;pointer-events:none";
        B.nodes.push(drw);
        if (!S.f.tea) {
          B.hs.push(hotspot({
            r: [30, 54, 22, 18], title: "Пачка чая «Золотой лепесток».",
            click: () => { give("tea"); S.f.tea = true; toast("Чай «Золотой лепесток»."); refresh(); }
          }));
          const t = ph("", "чай", 32, 55, 16, 15);
          t.style.background = "linear-gradient(160deg,#d8b24a,#8a6a1e)";
          B.nodes.push(t);
        }
      }
      break;
    }

    /* ============ ZOOM: nightstand drawer ============ */
    case "nightstand": {
      B.layers.push(layerImg(S.f.drawerOpen ? "nightstand_zoom_open.png" : "nightstand_zoom.png"));
      if (!S.f.drawerOpen) {
        B.hs.push(hotspot({
          r: [15, 52, 70, 16], title: "Выдвинуть нижний ящик.",
          click: () => { S.f.drawerOpen = true; toast("Ящик выдвинут."); refresh(); }
        }));
      } else if (!S.f.bulb) {
        B.hs.push(hotspot({
          r: [18, 54, 64, 22], title: "В ящике — сморщенная луковица какого-то цветка.",
          click: () => { give("bulb"); S.f.bulb = true; toast("Луковица мистического цветка."); refresh(); }
        }));
        const bl = document.createElement("div");
        bl.style.cssText = "position:absolute;left:44%;top:60%;width:12%;height:12%;background:radial-gradient(circle at 40% 35%,#caa46b,#6b4a24);border-radius:50% 50% 45% 45%;pointer-events:none";
        B.nodes.push(bl);
      } else {
        const e = document.createElement("div");
        e.style.cssText = "position:absolute;left:50%;top:58%;transform:translateX(-50%);color:#3a2c1c;font-size:14px";
        e.textContent = "Ящик пуст.";
        B.nodes.push(e);
      }
      break;
    }

    /* ============ ZOOM: pot / flower ============ */
    case "pot": {
      B.layers.push(layerImg("room_bg.png"));
      const pot = document.createElement("div");
      pot.style.cssText = "position:absolute;left:36%;top:54%;width:28%;height:32%;background:linear-gradient(160deg,#a05a34,#5f331c);border:3px solid #14100c;border-radius:6px 6px 30% 30%;pointer-events:none";
      B.nodes.push(pot);
      const soil = document.createElement("div");
      soil.style.cssText = "position:absolute;left:38%;top:56%;width:24%;height:8%;background:#3a2416;pointer-events:none";
      B.nodes.push(soil);

      if (S.f.grown) {
        const fl = document.createElement("div");
        fl.style.cssText = "position:absolute;left:50%;top:22%;width:26%;height:40%;transform:translateX(-50%);pointer-events:none;transform-origin:bottom center";
        fl.innerHTML = flowerSVG(S.f.cut, S.f.brokenOff);
        if (S.__justGrew) fl.style.animation = "grow .9s ease-out";
        B.nodes.push(fl);
        const style = document.createElement("style");
        style.textContent = "@keyframes grow{0%{transform:translateX(-50%) scaleY(.03)}60%{transform:translateX(-50%) scaleY(1.1)}100%{transform:translateX(-50%) scaleY(1)}}";
        B.nodes.push(style);

        if (!S.f.cut) {
          B.hs.push(hotspot({
            r: [38, 20, 26, 44], title: "Пышный мистический цветок на толстом стебле.",
            use: it => { if (it === "knife") { S.f.cut = true; flashFX(); toast("Сделали надрез на стебле."); refresh(); return true; } return false; }
          }));
        } else if (!S.f.brokenOff) {
          B.hs.push(hotspot({
            r: [38, 16, 26, 40], title: "Надрезанный цветок. Верхушка держится на волокне.",
            click: () => {
              S.f.brokenOff = true; give("broken_flower"); Audio2.click();
              toast("Отломили верхушку — из излома капает густой сок."); refresh();
            }
          }));
        } else {
          const drip = document.createElement("div");
          drip.style.cssText = "position:absolute;left:49%;top:40%;width:3%;height:22%;background:linear-gradient(#7a9a3a,#4a6a1a);border-radius:40%;pointer-events:none;animation:drip 1.4s infinite";
          B.nodes.push(drip);
          const ds = document.createElement("style");
          ds.textContent = "@keyframes drip{0%,100%{opacity:.5;transform:scaleY(.8)}50%{opacity:1;transform:scaleY(1.15)}}";
          B.nodes.push(ds);
          if (!S.f.sap) {
            B.hs.push(hotspot({
              r: [42, 38, 16, 28], title: "Из стебля капает густой сок.",
              use: it => {
                if (it === "glass_empty") {
                  take("glass_empty"); give("glass_sap"); S.f.sap = true;
                  toast("Набрали сок цветка в стакан."); refresh(); return true;
                }
                return false;
              }
            }));
          }
        }
      } else if (S.f.planted) {
        const spr = document.createElement("div");
        spr.style.cssText = "position:absolute;left:50%;top:44%;width:3%;height:14%;transform:translateX(-50%);background:#4a6a1a;border-radius:40%;pointer-events:none";
        B.nodes.push(spr);
        B.hs.push(hotspot({
          r: [40, 40, 20, 20], title: "Из земли торчит бледный росток. Ему бы питания…",
          use: it => {
            if (it === "glass_mix") {
              take("glass_mix"); give("glass_empty");
              S.f.poured = true; S.f.grown = true; S.__justGrew = true;
              Audio2.grow(); flashFX();
              toast("Смесь впиталась — цветок распустился мгновенно!");
              refresh();
              setTimeout(() => { S.__justGrew = false; }, 1000);
              return true;
            }
            return false;
          }
        }));
      } else {
        B.hs.push(hotspot({
          r: [38, 52, 24, 14], title: "Горшок с рыхлой землёй.",
          use: it => { if (it === "bulb") { take("bulb"); S.f.planted = true; toast("Посадили луковицу."); refresh(); return true; } return false; }
        }));
      }
      break;
    }

    /* ============ ZOOM: quilt (грид памяти) ============ */
    case "quilt": {
      B.layers.push(layerImg(S.f.quilt ? "bed_zoom_open.png" : "bed_zoom.png"));
      if (!S.f.quilt) {
        const g = document.createElement("div");
        g.className = "grid";
        g.style.left = "9%"; g.style.top = "52%"; g.style.width = "82%"; g.style.height = "31%";
        g.style.gridTemplateColumns = "repeat(4,1fr)"; g.style.gridTemplateRows = "repeat(2,1fr)";
        for (let i = 0; i < 8; i++) {
          const c = document.createElement("div");
          c.className = "cell";
          c.innerHTML = '<div class="bead"></div>';
          c.addEventListener("click", e => { e.stopPropagation(); quiltTap(i, c); });
          g.appendChild(c);
        }
        B.nodes.push(g);
        const hint = document.createElement("div");
        hint.style.cssText = "position:absolute;left:50%;top:49%;transform:translateX(-50%);color:#f2ead6;font-size:12px;text-shadow:0 1px 2px #000;pointer-events:none";
        hint.textContent = "Нажмите ячейки там, где на окнах сидели птицы.";
        B.nodes.push(hint);
      } else if (!S.f.toy) {
        B.hs.push(hotspot({
          r: [34, 60, 32, 30], title: "В потайной полости под одеялом — тряпичная игрушка.",
          click: () => { give("toy"); S.f.toy = true; toast("Тряпичная игрушка."); refresh(); }
        }));
        const t = document.createElement("div");
        t.style.cssText = "position:absolute;left:44%;top:66%;width:12%;height:16%;background:linear-gradient(160deg,#b98,#875);border-radius:40% 40% 30% 30%;border:2px solid #543;pointer-events:none";
        B.nodes.push(t);
      } else {
        const e = document.createElement("div");
        e.style.cssText = "position:absolute;left:50%;top:70%;transform:translateX(-50%);color:#f2ead6;font-size:14px;text-shadow:0 1px 2px #000";
        e.textContent = "Полость пуста.";
        B.nodes.push(e);
      }
      break;
    }

    /* ============ ZOOM: headboard (подсказка порядка пятен) ============ */
    case "headboard": {
      B.layers.push(layerImg("room_bg.png"));
      const hb = document.createElement("div");
      hb.style.cssText = "position:absolute;left:18%;top:20%;width:64%;height:56%;background:linear-gradient(160deg,#6b4a2a,#3f2a17);border:3px solid #14100c;border-radius:10px 10px 4px 4px;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px";
      const t = document.createElement("div");
      t.style.cssText = "color:#e9dcc3;font-size:13px;letter-spacing:.1em";
      t.textContent = "вырезано ножом по дереву:";
      hb.appendChild(t);
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:12px";
      STAIN_ORDER.forEach((c, idx) => {
        const d = document.createElement("div");
        d.style.cssText = "width:26px;height:26px;border-radius:50%;border:2px solid #1b120a;background:" + swatch(c) + ";display:flex;align-items:center;justify-content:center;font-size:11px;color:#1b120a";
        d.textContent = (idx + 1);
        row.appendChild(d);
      });
      hb.appendChild(row);
      B.nodes.push(hb);
      if (!S.f.headboard) S.f.headboard = true;
      break;
    }

    /* ============ ZOOM: nightstand top (последовательность пятен) ============ */
    case "stains": {
      B.layers.push(layerImg("room_bg.png"));
      const top = document.createElement("div");
      top.style.cssText = "position:absolute;left:10%;top:14%;width:80%;height:66%;background:linear-gradient(160deg,#6b4a2a,#4a3018);border:4px solid #14100c;border-radius:8px;pointer-events:none;box-shadow:inset 0 0 60px rgba(0,0,0,.5)";
      B.nodes.push(top);

      if (!S.f.stains) {
        ["blue", "red", "cyan", "green", "yellow"].forEach(c => B.nodes.push(layerImg("stain_" + c + ".png")));
        Object.keys(STAIN_POS).forEach(c => {
          const [x, y] = STAIN_POS[c];
          B.hs.push(hotspot({
            r: [x * 100 - 7, y * 100 - 7, 14, 14], title: "Тёмное въевшееся пятно.",
            use: it => {
              if (it === "handkerchief_wet") { stainTap(c); return "keep"; }
              if (it === "handkerchief_dry") { toast("Сухая салфетка не берёт. Нужно смочить."); return "keep"; }
              return false;
            }
          }));
        });
        const hint = document.createElement("div");
        hint.style.cssText = "position:absolute;left:50%;top:84%;transform:translateX(-50%);color:#e9dcc3;font-size:12px;pointer-events:none";
        hint.textContent = S.f.wet ? "Три пятна в порядке с изголовья…" : "Пятна не оттираются насухо.";
        B.nodes.push(hint);
      } else {
        const latch = document.createElement("div");
        latch.style.cssText = "position:absolute;left:44%;top:40%;width:12%;height:14%;background:#14100c;border:2px solid #caa96b;pointer-events:none";
        B.nodes.push(latch);
        if (!S.f.screwdriver) {
          B.hs.push(hotspot({
            r: [42, 38, 16, 20], title: "Открылся потайной механизм — в нише лежит отвёртка.",
            click: () => { give("screwdriver"); S.f.screwdriver = true; toast("Отвёртка."); refresh(); }
          }));
        } else {
          const e = document.createElement("div");
          e.style.cssText = "position:absolute;left:50%;top:60%;transform:translateX(-50%);color:#e9dcc3;font-size:14px";
          e.textContent = "Ниша пуста.";
          B.nodes.push(e);
        }
      }
      break;
    }

    /* ============ ZOOM: mirror (финал) ============ */
    case "mirror": {
      B.layers.push(layerImg("room_bg.png"));
      const fr = document.createElement("div");
      fr.style.cssText = "position:absolute;left:20%;top:8%;width:60%;height:82%;border:12px solid #6b4a2a;border-radius:50% 50% 6% 6%;background:linear-gradient(160deg,rgba(180,200,210,.5),rgba(110,130,150,.35));pointer-events:none;overflow:hidden";
      const sil = document.createElement("div");
      sil.style.cssText = "position:absolute;left:50%;top:60%;width:42%;height:70%;transform:translateX(-50%);background:radial-gradient(circle at 50% 30%,#3a3550,#1c1a2b);border-radius:45% 45% 20% 20%;";
      fr.appendChild(sil);
      B.nodes.push(fr);

      if (!S.f.mirrorCracked) {
        B.hs.push(hotspot({
          r: [54, 26, 12, 12], title: "За ухом у отражения Вари.",
          use: it => {
            if (it === "broken_flower") {
              take("broken_flower"); S.f.mirrorCracked = true;
              Audio2.crack(); shakeScene(); flashFX();
              toast("Зеркало пошло трещинами!");
              refresh(); return true;
            }
            return false;
          }
        }));
        B.hs.push(hotspot({ r: [20, 8, 60, 82], title: "Отражение Вари смотрит прямо на тебя." }));
      } else {
        const c = document.createElement("div");
        c.className = "cracks on";
        c.style.cssText += "position:absolute;left:20%;top:8%;width:60%;height:82%;pointer-events:none;";
        c.innerHTML = crackSVG();
        B.nodes.push(c);
        if (!S.f.shard) {
          B.hs.push(hotspot({
            r: [30, 50, 16, 22], title: "Осколок держится еле-еле — подцепить бы чем-то.",
            use: it => {
              if (it === "screwdriver") {
                S.f.shard = true; Audio2.crack();
                toast("Осколок выпал — за ним ниша в стене!");
                refresh(); return true;
              }
              return false;
            }
          }));
        } else if (!S.f.done) {
          const niche = document.createElement("div");
          niche.style.cssText = "position:absolute;left:31%;top:50%;width:14%;height:20%;background:#0a0806;border:2px solid #2a1c0e;pointer-events:none";
          B.nodes.push(niche);
          const btn = document.createElement("div");
          btn.style.cssText = "position:absolute;left:35%;top:56%;width:6%;height:8%;pointer-events:none";
          btn.innerHTML = '<img src="' + IMG + 'button.png" style="width:100%;height:100%;object-fit:contain">';
          B.nodes.push(btn);
          B.hs.push(hotspot({
            r: [31, 50, 14, 20], title: "В нише лежит одна-единственная пуговица.",
            click: () => { give("button"); S.f.done = true; endGame(); }
          }));
        }
      }
      break;
    }

  } // switch
  return B;
}

/* =========================================================================
   5. SVG-ХЕЛПЕРЫ (плейсхолдерная графика)
   ========================================================================= */
function knifeSVG() {
  return '<svg viewBox="0 0 200 60" preserveAspectRatio="none">' +
    '<polygon points="0,30 120,10 120,50" fill="#d7dde2" stroke="#14100c" stroke-width="3"/>' +
    '<rect x="120" y="20" width="70" height="20" rx="6" fill="#5b3a24" stroke="#14100c" stroke-width="3"/></svg>';
}
function flowerSVG(cut, broken) {
  const stem = broken
    ? '<rect x="46" y="55" width="8" height="45" fill="#4a6a1a"/>'
    : '<rect x="46" y="8" width="8" height="92" fill="#4a6a1a"/>';
  const head = broken ? '' :
    '<g transform="translate(50,' + (cut ? '16' : '12') + ')">' +
    '<circle r="16" fill="#caa2d6"/>' +
    '<circle cx="16" r="12" fill="#b98ccb"/><circle cx="-16" r="12" fill="#b98ccb"/>' +
    '<circle cy="16" r="12" fill="#b98ccb"/><circle cy="-16" r="12" fill="#b98ccb"/>' +
    '<circle r="7" fill="#f0e6a8"/></g>';
  const nick = cut && !broken ? '<path d="M46 54 l8 4 M54 54 l-8 4" stroke="#2a1c0e" stroke-width="2"/>' : '';
  return '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' + stem + nick + head + '</svg>';
}
function crackSVG() {
  return '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
    '<g stroke="#e9eef2" stroke-width="0.7" fill="none" opacity="0.9">' +
    '<path d="M50 0 L46 30 L55 55 L40 100"/>' +
    '<path d="M46 30 L10 20 M46 30 L85 25 M55 55 L90 70 M55 55 L8 68 M40 100 L20 60"/>' +
    '<path d="M0 40 L46 30 M100 45 L55 55 M30 0 L46 30 M70 100 L55 55"/>' +
    '</g></svg>';
}
function swatch(c) {
  return { red: "#d64b4b", blue: "#5570d6", cyan: "#7fe8ef", green: "#66d07a", yellow: "#ecd94a" }[c];
}

/* =========================================================================
   6. ЛОГИКА ГОЛОВОЛОМОК
   ========================================================================= */

/* SequenceInput — Морзе в сапог */
function morseTap(sym) {
  S.morseInput.push(sym);
  const i = S.morseInput.length - 1;
  if (S.morseInput[i] !== MORSE[i]) {
    Audio2.bad(); shakeScene(); toast("Не тот порядок — жижа вытекла.");
    S.morseInput = []; refresh(); return;
  }
  if (S.morseInput.length === MORSE.length) {
    Audio2.good(); S.f.morse = true; flashFX();
    toast("Жижа с шипением ушла — на дне блеснул нож.");
  }
  refresh();
}

/* MemoryPattern — грид одеяла по позициям птиц */
function quiltTap(i, cell) {
  if (!BIRD_CELLS.includes(i)) {
    Audio2.bad(); shakeScene(); toast("Не там. Ячейки сбросились.");
    S.quiltInput = [];
    document.querySelectorAll(".cell.lit").forEach(c => c.classList.remove("lit"));
    return;
  }
  const expected = BIRD_CELLS.slice().sort((a, b) => a - b)[S.quiltInput.length];
  if (i !== expected) {
    Audio2.bad(); shakeScene(); toast("Порядок сбит. Ячейки сбросились.");
    S.quiltInput = [];
    document.querySelectorAll(".cell.lit").forEach(c => c.classList.remove("lit"));
    return;
  }
  cell.classList.add("lit"); Audio2.click(); S.quiltInput.push(i);
  if (S.quiltInput.length === BIRD_CELLS.length) {
    Audio2.good(); S.f.quilt = true;
    setTimeout(() => { toast("Одеяло разошлось — под ним потайная полость."); refresh(); }, 420);
  }
}

/* SequenceInput — очистка пятен по подсказке с изголовья */
function stainTap(c) {
  const idx = S.stainInput.length;
  if (c !== STAIN_ORDER[idx]) {
    Audio2.bad(); shakeScene(); toast("Не тот порядок — пятна проступили снова.");
    S.stainInput = []; refresh(); return;
  }
  S.stainInput.push(c);
  Audio2.click();
  refreshStainVisual();
  if (S.stainInput.length === STAIN_ORDER.length) {
    Audio2.good(); take("handkerchief_wet");
    S.f.stains = true; flashFX();
    toast("Пятна сошли. Что-то щёлкнуло внутри тумбочки.");
    refresh();
  }
}
function refreshStainVisual() {
  const cleaned = new Set(S.stainInput);
  document.querySelectorAll('#scene img.layer').forEach(im => {
    STAIN_ORDER.forEach(c => {
      if (im.src.includes("stain_" + c + ".png")) im.style.opacity = cleaned.has(c) ? 0 : 1;
    });
  });
}

/* CraftChain / комбинирование в инвентаре.
   Рецепты — таблица «отсортированная пара id -> действие». */
function tryCombine(a, b) {
  if (!has(a) || !has(b)) return;
  const key = [a, b].sort().join("+");
  const R = {};
  R[["glass_sap", "handkerchief_dry"].sort().join("+")] = () => {
    take("glass_sap"); take("handkerchief_dry"); give("handkerchief_wet"); S.f.wet = true;
    toast("Смочили салфетку соком цветка.");
  };
  R[["knife", "toy"].sort().join("+")] = () => {
    take("toy"); flashFX(); Audio2.click();
    give("heart"); S.f.heart = true;
    toast("Вспорол игрушку — внутри анатомическое сердце.");
  };
  R[["glass_empty", "heart"].sort().join("+")]   = () => craftMix("heart");
  R[["glass_empty", "aniline"].sort().join("+")] = () => craftMix("aniline");
  R[["glass_empty", "tea"].sort().join("+")]     = () => craftMix("tea");

  if (R[key]) { R[key](); select(null); renderBar(); return; }
  Audio2.bad(); toast("Из этого ничего не выйдет.");
}
function craftMix(ing) {
  S.f.mix[ing] = true; take(ing);
  const left = Object.keys(S.f.mix).filter(k => !S.f.mix[k]);
  if (left.length) {
    toast("Добавили в стакан: " + ITEMS[ing].name.toLowerCase() + ". Осталось " + left.length + ".");
  } else {
    take("glass_empty"); give("glass_mix"); S.f.mixDone = true; Audio2.good();
    toast("Стакан наполнился густой питательной смесью.");
  }
  renderBar();
}

/* =========================================================================
   7. РЕНДЕР + НАВИГАЦИЯ
   ========================================================================= */
function renderBar() {
  bar.innerHTML = "";
  S.inv.forEach(id => {
    const it = ITEMS[id];
    const s = document.createElement("div");
    s.className = "slot" + (S.selected === id ? " sel" : "");
    if (it.img) {
      s.style.backgroundImage = "url(" + IMG + it.img + ")";
    } else {
      s.classList.add("chip");
      s.textContent = shortName(it.name);
    }
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = it.name;
    s.appendChild(cap);
    s.addEventListener("click", e => {
      e.stopPropagation(); Audio2.click();
      if (S.selected && S.selected !== id) tryCombine(S.selected, id);
      else select(id);
    });
    bar.appendChild(s);
  });
  stage.classList.toggle("holding", !!S.selected);
}

/* Короткие подписи для текстовых чипов инвентаря (у кого нет иконки). */
function shortName(n) {
  const m = {
    "Нож": "нож", "Пустой стакан": "стакан", "Стакан с питательной смесью": "смесь", "Стакан с соком цветка": "сок",
    "Анилин": "анилин", "Малярный валик": "валик", "Чай «Золотой лепесток»": "чай", "Луковица мистического цветка": "луковица",
    "Тряпичная игрушка": "игрушка", "Анатомическое сердце": "сердце", "Надломленный цветок": "цветок",
  };
  return m[n] || n;
}

/* Полная перерисовка текущего вида из состояния. */
function refresh() {
  const B = buildScene();
  scene.innerHTML = "";
  B.layers.forEach(l => scene.appendChild(l));
  B.nodes.forEach(n => scene.appendChild(n));
  B.hs.forEach(h => scene.appendChild(h));
  navL.style.display = B.nav ? "flex" : "none";
  navR.style.display = B.nav ? "flex" : "none";
  backBtn.classList.toggle("hidden", B.nav);
  if (S.view === "stains" && !S.f.stains) setTimeout(refreshStainVisual, 0);
}

let swapping = false;
/* ZoomView — переход в любой вид с cross-fade. */
function go(view) {
  if (swapping) return;
  swapping = true;
  scene.classList.add("swap");
  setTimeout(() => {
    S.view = view;
    if (WALLS.includes(view)) S.wallIndex = WALLS.indexOf(view);
    if (view === "quilt") S.quiltInput = [];
    if (view === "stains") S.stainInput = [];
    refresh();
    scene.classList.remove("swap");
    swapping = false;
  }, 280);
}
function back() { go(WALLS[S.wallIndex]); }
function turn(dir) { go(WALLS[(S.wallIndex + dir + 4) % 4]); }

/* =========================================================================
   8. ПОДСКАЗКИ — следующий шаг по текущему прогрессу
   ========================================================================= */
function currentHint() {
  const f = S.f;
  if (!f.morse) return "Рамка картины (стена с зеркалом) — это код Морзе. Открой сапог крупным планом и залей жижу в том же порядке: жёлтая=точка, коричневая=тире.";
  if (!f.knife) return "Забери нож со дна сапога.";
  if (!f.glass) return "Открой мини-холодильник и возьми пустой стакан.";
  if (!f.aniline) return "Примени нож на кусок мяса в холодильнике — получишь анилин.";
  if (!f.roller) return "На полке у окна лежит малярный валик.";
  if (!f.phono) return "Вставь валик в щель фонографа.";
  if (!f.tea) return "Забери чай «Золотой лепесток» из открывшегося отсека фонографа.";
  if (!f.bulb) return "Выдвини нижний ящик тумбочки — там луковица.";
  if (!f.planted) return "Посади луковицу в горшок на подоконнике.";
  if (!f.quilt) return "Посмотри, на каких окнах сидят птицы, и нажми те же ячейки на одеяле (крупный план кровати) слева-направо, сверху-вниз.";
  if (!f.toy) return "Забери тряпичную игрушку из полости под одеялом.";
  if (!f.heart) return "В инвентаре объедини нож и игрушку — получишь сердце.";
  if (!f.mixDone) return "Поочерёдно объедини пустой стакан с сердцем, анилином и чаем.";
  if (!f.grown) return "Вылей смесь из стакана в горшок с ростком.";
  if (!f.cut) return "Примени нож на выросший цветок (крупный план горшка).";
  if (!f.brokenOff) return "Кликни рукой по надрезанному цветку — отломишь верхушку.";
  if (!f.sap) return "Набери капающий сок в пустой стакан.";
  if (!f.handkerchief) return "На стене с кроватью на полу за ножкой лежит сухая салфетка.";
  if (!f.wet) return "В инвентаре объедини сухую салфетку со стаканом сока цветка.";
  if (!f.headboard) return "Изучи подсказку на изголовье кровати — порядок цветов.";
  if (!f.stains) return "Крупный план крышки тумбочки: мокрой салфеткой протри пятна в порядке с изголовья (жёлтое, голубое, красное, зелёное, синее).";
  if (!f.screwdriver) return "Забери отвёртку из открывшегося механизма тумбочки.";
  if (!f.mirrorCracked) return "Стена с зеркалом: примени надломленный цветок Варе за ухо (сверься с портретом-подсказкой).";
  if (!f.shard) return "Подцепи болтающийся осколок зеркала отвёрткой.";
  if (!f.done) return "Забери предмет из ниши за зеркалом.";
  return "Комната пройдена!";
}

/* =========================================================================
   9. ФИНАЛ
   ========================================================================= */
function endGame() {
  renderBar();
  $("#endText").innerHTML =
    "Варя держит на ладони маленькую костяную пуговицу из ниши за разбитым зеркалом. " +
    "Она тёплая — как будто её только что кто-то носил.<br><br>" +
    "<i>Открытый вопрос из ТЗ: именно эта пуговица станет ключом-переходом в комнату&nbsp;2 " +
    "— «ту самую яркую и розовую».</i>";
  $("#endScreen").classList.remove("hidden");
}

/* =========================================================================
   10. АВТОТЕСТ — полное прохождение всех 28 шагов сценария.
   Запускается из main.js при ?selftest. Рисует отчёт поверх страницы.
   ========================================================================= */
function selfTest() {
  const log = []; let ok = true;
  const step = (name, fn) => {
    try { fn(); log.push("✓ " + name); }
    catch (e) { ok = false; log.push("✗ " + name + " — " + e.message); }
  };
  const hs = (view, title) => {
    S.view = view; refresh();
    const n = [...document.querySelectorAll('#scene .hs')].find(d => d.title === title);
    if (!n) throw new Error("no hotspot: " + title);
    n.click();
  };
  const assert = (c, m) => { if (!c) throw new Error(m); };

  $("#startScreen").classList.add("hidden");

  step("морзе: ввод кода", () => { S.view = "boot"; refresh(); MORSE.forEach(morseTap); assert(S.f.morse, "morse not solved"); });
  step("забрать нож", () => { hs("boot", "На дне сапога лежит нож."); assert(has("knife"), "no knife"); });
  step("открыть холодильник + стакан", () => { hs("fridge", "Открыть холодильник."); hs("fridge", "Пустой гранёный стакан."); assert(has("glass_empty"), "no glass"); });
  step("нож -> мясо -> анилин", () => { S.selected = "knife"; hs("fridge", "Кусок красного мяса, покрытый странным химическим налётом."); assert(has("aniline"), "no aniline"); S.selected = null; });
  step("взять валик", () => { hs("wall1", "На полке лежит малярный валик."); assert(has("roller"), "no roller"); });
  step("валик -> фонограф", () => { S.selected = "roller"; hs("phono", "Узкая щель в корпусе — будто под валик."); assert(S.f.phono, "phono closed"); S.selected = null; });
  step("забрать чай", () => { hs("phono", "Пачка чая «Золотой лепесток»."); assert(has("tea"), "no tea"); });
  step("ящик тумбочки -> луковица", () => { hs("nightstand", "Выдвинуть нижний ящик."); hs("nightstand", "В ящике — сморщенная луковица какого-то цветка."); assert(has("bulb"), "no bulb"); });
  step("посадить луковицу", () => { S.selected = "bulb"; hs("pot", "Горшок с рыхлой землёй."); assert(S.f.planted, "not planted"); S.selected = null; });
  step("одеяло: паттерн птиц", () => {
    S.view = "quilt"; S.quiltInput = []; refresh();
    const cells = [...document.querySelectorAll('#scene .cell')];
    BIRD_CELLS.slice().sort((a, b) => a - b).forEach(i => quiltTap(i, cells[i]));
    assert(S.f.quilt, "quilt not solved");
  });
  step("забрать игрушку", () => { hs("quilt", "В потайной полости под одеялом — тряпичная игрушка."); assert(has("toy"), "no toy"); });
  step("нож+игрушка -> сердце", () => { tryCombine("knife", "toy"); assert(has("heart") && !has("toy"), "no heart"); });
  step("смесь: сердце+анилин+чай", () => {
    tryCombine("glass_empty", "heart"); tryCombine("glass_empty", "aniline"); tryCombine("glass_empty", "tea");
    assert(has("glass_mix"), "no mix");
  });
  step("вылить смесь -> рост", () => { S.selected = "glass_mix"; hs("pot", "Из земли торчит бледный росток. Ему бы питания…"); assert(S.f.grown, "not grown"); S.selected = null; });
  step("нож -> надрез", () => { S.selected = "knife"; hs("pot", "Пышный мистический цветок на толстом стебле."); assert(S.f.cut, "not cut"); S.selected = null; });
  step("отломить верхушку", () => { hs("pot", "Надрезанный цветок. Верхушка держится на волокне."); assert(has("broken_flower"), "no broken flower"); });
  step("стакан -> сок", () => { S.selected = "glass_empty"; hs("pot", "Из стебля капает густой сок."); assert(has("glass_sap"), "no sap glass"); S.selected = null; });
  step("взять салфетку", () => { hs("wall0", "Что-то белеет на полу за ножкой кровати…"); assert(has("handkerchief_dry"), "no napkin"); });
  step("салфетка+сок -> мокрая", () => { tryCombine("glass_sap", "handkerchief_dry"); assert(has("handkerchief_wet"), "not wet"); });
  step("изголовье: подсказка", () => { S.view = "headboard"; refresh(); assert(S.f.headboard, "headboard not read"); });
  step("пятна: порядок", () => {
    S.view = "stains"; S.stainInput = []; refresh();
    STAIN_ORDER.forEach(c => stainTap(c));
    assert(S.f.stains, "stains not solved");
  });
  step("забрать отвёртку", () => { hs("stains", "Открылся потайной механизм — в нише лежит отвёртка."); assert(has("screwdriver"), "no screwdriver"); });
  step("цветок Варе за ухо", () => { S.selected = "broken_flower"; hs("mirror", "За ухом у отражения Вари."); assert(S.f.mirrorCracked, "mirror not cracked"); S.selected = null; });
  step("отвёртка -> осколок", () => { S.selected = "screwdriver"; hs("mirror", "Осколок держится еле-еле — подцепить бы чем-то."); assert(S.f.shard, "shard not pried"); S.selected = null; });
  step("забрать пуговицу -> финал", () => { hs("mirror", "В нише лежит одна-единственная пуговица."); assert(S.f.done, "not done"); });

  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;inset:0;z-index:99;background:#000;color:" + (ok ? "#7f7" : "#f77") + ";font:13px/1.5 monospace;padding:20px;white-space:pre-wrap;overflow:auto";
  box.textContent = (ok ? "ALL PASS " : "FAIL ") + "\n\n" + log.join("\n");
  document.body.appendChild(box);
  document.title = ok ? "SELFTEST PASS" : "SELFTEST FAIL";
}

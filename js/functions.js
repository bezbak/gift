"use strict";
/* =============================================================================
   ФУНКЦИИ — движок и логика (зависит от js/models.js, работает с DOM)
   -----------------------------------------------------------------------------
   Разделы:
     1.  AUDIO            — мини-синтез звука на WebAudio (без файлов)
     2.  DOM + ХЕЛПЕРЫ    — ссылки на узлы, инвентарь, toast, эффекты, wait()
     3.  ПРИМИТИВЫ СЦЕНЫ  — layerImg / hotspot / makeDrag
     4.  ЛОГИКА ГОЛОВОЛОМОК И ДЕЙСТВИЙ — по одному блоку на шаг сценария
     5.  КРАФТ В ИНВЕНТАРЕ — tryCombine
     6.  РЕНДЕР + НАВИГАЦИЯ — renderBar / refresh / go / turn / back
     7.  ПОДСКАЗКИ        — currentHint()
     8.  ФИНАЛ            — finale() / endGame()

   Описания видов (стены, крупные планы) и плейсхолдерная графика — в js/scenes.js.
   Автотест полного прохождения — js/selftest.js.

   Контракт use() у hotspot:  true — применено, предмет убрать из руки;
                              "keep" — применено, предмет остаётся в руке;
                              false/undefined — «ничего не происходит».
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
  const seq = (n, ms, fn) => { for (let i = 0; i < n; i++) setTimeout(() => fn(i), i * ms); };
  return {
    click: () => beep(320, 0.06, "square", 0.03),
    pick:  () => { beep(520, 0.08, "sine"); setTimeout(() => beep(780, 0.1, "sine"), 70); },
    good:  () => { beep(523, 0.1); setTimeout(() => beep(659, 0.1), 90); setTimeout(() => beep(880, 0.16), 180); },
    bad:   () => beep(140, 0.22, "sawtooth", 0.05),
    crack: () => seq(7, 35, () => beep(90 + Math.random() * 400, 0.05, "sawtooth", 0.05)),
    grow:  () => { beep(200, 0.5, "sine", 0.04); setTimeout(() => beep(400, 0.4, "sine", 0.03), 120); },
    pour:  () => { beep(260, 0.3, "sine", 0.03); setTimeout(() => beep(200, 0.25, "sine", 0.025), 120); },
    whirr: () => seq(14, 90, i => beep(110 + (i % 4) * 25, 0.1, "sawtooth", 0.03)),
    snip:  () => { beep(900, 0.05, "square", 0.03); setTimeout(() => beep(600, 0.06, "square", 0.03), 60); },
    thud:  () => beep(70, 0.25, "sine", 0.08),
    whoosh: () => seq(12, 70, i => beep(200 + i * 60, 0.12, "sine", 0.02)),
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

/* Пауза для скриптовых сцен; в автотесте (window.__FAST) схлопывается. */
const wait = ms => new Promise(r => setTimeout(r, window.__FAST ? 1 : ms));

let toastT = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function has(id)  { return S.inv.includes(id); }
function give(id) { if (!has(id)) { S.inv.push(id); Audio2.pick(); } renderBar(); }
function take(id) { S.inv = S.inv.filter(x => x !== id); if (S.selected === id) S.selected = null; renderBar(); }
function select(id) {
  S.selected = (S.selected === id ? null : id);
  renderBar();
  stage.classList.toggle("holding", !!S.selected);
}
/* Предмет «не подошёл»: ничего не происходит, он остаётся в инвентаре. */
function bounce(it) {
  Audio2.bad();
  toast("«" + ITEMS[it].name + "» не подходит — вернулось в инвентарь.");
  return true;
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
/* Плавное затемнение / проявление всей сцены. to: 1 — в чёрное, 0 — обратно. */
function fadeBlack(to, ms) {
  let d = fx.querySelector(".blackout");
  if (!d) { d = document.createElement("div"); d.className = "blackout"; fx.appendChild(d); void d.offsetWidth; }
  d.style.transitionDuration = ms + "ms";
  d.style.opacity = to;
  return wait(ms + 40).then(() => { if (!to) d.remove(); });
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

/* Зона клика. o = { r:[left,top,w,h] в %, title, zoom?, circle?, click?(e), use?(item, e) }
   Если предмет в руке, а у зоны есть zoom, но нет use — предмет остаётся в руке,
   и мы просто заходим в крупный план (так удобно носить предмет между видами). */
function hotspot(o) {
  const d = document.createElement("div");
  d.className = "hs" + (o.zoom ? " zoomable" : "") + (o.circle ? " circle" : "");
  d.style.left = o.r[0] + "%"; d.style.top = o.r[1] + "%";
  d.style.width = o.r[2] + "%"; d.style.height = o.r[3] + "%";
  d.dataset.name = o.title || "";      // имя зоны нужно только автотесту — игроку не показываем
  d.addEventListener("click", e => {
    e.stopPropagation();
    if (S.lock) return;
    Audio2.click();
    if (S.selected) {
      const res = o.use ? o.use(S.selected, e) : undefined;
      if (res === true) { select(null); }
      else if (res === "keep") { /* предмет остаётся в руке */ }
      else if (!o.use && o.zoom && o.click) { o.click(e); }
      else { toast("Ничего не происходит."); }
    } else {
      if (o.click) o.click(e);
    }
  });
  return d;
}

/* Перетаскивание (мышь и тач). Элемент можно тащить к любому узлу с атрибутом
   data-drop; opts.onDrop(target|null) вызывается при отпускании, opts.onTap() —
   если сдвига почти не было. */
function makeDrag(el, opts) {
  el.style.touchAction = "none";
  el.addEventListener("click", e => e.stopPropagation());
  el.addEventListener("pointerdown", e => {
    if (e.button || S.lock) return;
    e.preventDefault(); e.stopPropagation();
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("ghost");
    ghost.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width +
      "px;height:" + r.height + "px;margin:0;pointer-events:none;z-index:60;";
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        moved = true; document.body.appendChild(ghost); el.classList.add("dragging");
      }
      if (moved) ghost.style.transform = "translate(" + (ev.clientX - sx) + "px," + (ev.clientY - sy) + "px)";
    };
    const up = ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      ghost.remove(); el.classList.remove("dragging");
      if (!moved) { if (opts.onTap) opts.onTap(); return; }
      const t = document.elementsFromPoint(ev.clientX, ev.clientY).find(n => n.dataset && n.dataset.drop !== undefined);
      if (opts.onDrop) opts.onDrop(t || null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  });
}

/* =========================================================================
   4. ЛОГИКА ГОЛОВОЛОМОК И ДЕЙСТВИЙ
   ========================================================================= */

/* ---- Шаги 3-5: Морзе -> сапог -> нож ----------------------------------- */
const morsePrefixOk = inp => MORSE_CODES.some(c => inp.every((s, i) => c[i] === s));
const morseDone = inp => MORSE_CODES.some(c => c.length === inp.length && c.every((s, i) => s === inp[i]));

async function morseTap(sym) {
  if (S.lock || S.f.morse) return;
  S.morseInput.push(sym);
  S.bootFill = MORSE_FILL[sym];
  Audio2.pour(); refresh();
  if (!morsePrefixOk(S.morseInput)) {            // ошибка: жижа сама стекает
    S.lock = true; Audio2.bad(); shakeScene();
    await wait(1000);
    S.morseInput = []; S.bootFill = null; S.lock = false;
    toast("Жижа сама стекла со дна.");
    refresh(); return;
  }
  if (morseDone(S.morseInput)) {                  // верно: вся жижа исчезает
    S.lock = true;
    await wait(900);
    S.bootFill = null; S.f.morse = true; S.lock = false;
    Audio2.good(); flashFX();
    toast("Жижа исчезла — на дне что-то блеснуло.");
    refresh();
  }
}

/* ---- Шаг 6: кодовый замок холодильника (ДИТЯ) -------------------------- */
function fridgeWord() { return S.fridgeCode.map(i => ALPHABET[i]).join(""); }
function fridgeTurn(i, d) {
  if (S.lock || S.f.fridgeOpen) return;
  S.fridgeCode[i] = (S.fridgeCode[i] + d + ALPHABET.length) % ALPHABET.length;
  Audio2.click();
  if (fridgeWord() === FRIDGE_CODE) {
    S.f.fridgeOpen = true; Audio2.good();
    toast("Щёлк — замок открылся.");
  }
  refresh();
}
function meatUse(it) {
  if (it === "knife" && !S.f.aniline) {
    S.f.aniline = true; give("aniline"); Audio2.snip(); flashFX();
    toast("Соскоблили химический налёт — получился анилин.");
    refresh(); return true;
  }
  return false;
}

/* ---- Шаги 8-9: валик -> фонограф -> чай -------------------------------- */
async function rollerIn() {
  take("roller"); S.f.phono = true; S.lock = true;
  Audio2.click(); refresh();
  toast("Валик встал на место. Игла побежала по дорожке…");
  await wait(1800);
  S.f.teaFell = true; Audio2.thud(); S.lock = false;
  toast("Из трубы выпала пачка чая «Золотой лепесток».");
  refresh();
}

/* ---- Шаги 13-14: бусины -> одеяло -------------------------------------- */
function quiltSolved() {
  for (let i = 0; i < 8; i++) if ((S.quiltBeads[i] || null) !== (WINDOW_PATTERN[i] || null)) return false;
  return true;
}
/* Вызывается после любого изменения S.quiltBeads: перерисовать и проверить решение. */
async function quiltChanged() {
  if (S.f.quilt) return;
  Audio2.click(); refresh();
  if (!quiltSolved()) return;
  S.lock = true; Audio2.good();
  toast("Бусины встали на места — одеяло шевельнулось.");
  await wait(1000);
  S.f.quilt = true; S.__lift = true; S.lock = false;
  refresh();
  setTimeout(() => { S.__lift = false; }, 1400);
}

/* ---- Шаг 16: нож -> зайчик -> сердце ----------------------------------- */
async function cutBunny() {
  S.lock = true; Audio2.snip(); S.__cutting = true; refresh();
  await wait(1100);
  S.__cutting = false; S.f.heart = true; S.lock = false;
  give("heart"); flashFX();
  toast("Зайчик рассыпался лоскутами — внутри билось анатомическое сердце.");
  refresh();
}

/* ---- Шаг 17: смеситель ------------------------------------------------- */
const MIX_ITEMS = ["heart", "aniline", "tea"];
function mixerUse(it) {
  const f = S.f;
  if (!f.mixGlass) {
    if (it === "glass_empty" && !f.mixDone) {
      take("glass_empty"); f.mixGlass = true; Audio2.click();
      toast("Стакан встал под смеситель.");
      refresh(); return true;
    }
    return bounce(it);
  }
  if (f.mixDone) { toast("Смесь готова."); return "keep"; }
  if (MIX_ITEMS.includes(it) && !f.mix[it]) {
    take(it); f.mix[it] = true; Audio2.pour();
    if (MIX_ITEMS.every(k => f.mix[k])) runMixer();
    else { toast("Смеситель принял: " + ITEMS[it].short + "."); refresh(); }
    return true;
  }
  return bounce(it);
}
async function runMixer() {
  S.lock = true; S.__mixing = true; Audio2.whirr(); refresh();
  toast("Смеситель завыл…");
  await wait(2000);
  S.__mixing = false; S.f.mixDone = true; S.lock = false;
  Audio2.good(); toast("Стакан наполнился густой питательной смесью.");
  refresh();
}
function mixerGlassClick() {
  const f = S.f;
  if (f.mixDone) {
    f.mixGlass = false; give("glass_mix"); toast("Стакан с питательной смесью."); refresh();
  } else if (!MIX_ITEMS.some(k => f.mix[k])) {
    f.mixGlass = false; give("glass_empty"); toast("Пустой стакан."); refresh();
  } else {
    toast("Стакан не вынуть.");
  }
}

/* ---- Шаги 11, 18-21: горшок, рост, надрез, сок ------------------------- */
function potUse(it) {
  const f = S.f;
  if (it === "bulb" && !f.planted) {
    take("bulb"); f.planted = true; Audio2.click();
    toast("Луковица легла в рыхлую землю."); refresh(); return true;
  }
  if (it === "glass_mix" && f.planted && !f.grown) {
    take("glass_mix"); give("glass_empty");
    f.grown = true; S.__justGrew = true;
    Audio2.grow(); flashFX();
    toast("Смесь впиталась — цветок распустился мгновенно!");
    refresh(); setTimeout(() => { S.__justGrew = false; }, 1200);
    return true;
  }
  if (it === "knife" && f.grown && !f.cut) {
    f.cut = true; Audio2.snip(); toast("Сделали надрез на стебле."); refresh(); return true;
  }
  if (it === "glass_empty" && f.brokenOff && !f.sap) {
    take("glass_empty"); give("glass_sap"); f.sap = true;
    toast("Набрали густой сок цветка в стакан."); refresh(); return true;
  }
  return false;
}
function breakFlower() {
  S.f.brokenOff = true; give("broken_flower"); Audio2.crack();
  toast("Отломили верхушку — из излома капает густой сок."); refresh();
}

/* ---- Шаги 24-26: пятна ------------------------------------------------- */
function stainTap(c) {
  const idx = S.stainInput.length;
  if (c !== STAIN_ORDER[idx]) {
    Audio2.bad(); shakeScene(); toast("Пятна проступили снова.");
    S.stainInput = []; refresh(); return;
  }
  S.stainInput.push(c); Audio2.click();
  if (S.stainInput.length === STAIN_ORDER.length) {
    Audio2.good(); take("handkerchief_wet"); S.f.stains = true; flashFX();
    toast("Все пятна сошли — салфетка истлела. Что-то щёлкнуло в тумбочке.");
  }
  refresh();
}

/* ---- Шаги 27-30: зеркало, дверь, синяк, карта --------------------------- */
async function flowerOnEar() {
  take("broken_flower"); S.lock = true;
  S.f.mirrorStage = 1; Audio2.crack(); shakeScene(); flashFX(); refresh();
  await wait(1500);
  S.f.mirrorStage = 2; Audio2.thud(); refresh();
  await wait(1400);
  S.f.mirrorStage = 3; S.lock = false;
  toast("Трещины исчезли. В нише остались кусочки цветка-пазла.");
  refresh();
}
async function openDoor() {
  S.lock = true; S.f.doorOpen = true; Audio2.thud(); refresh();
  toast("За дверью кто-то стоит…");
  await wait(2400);
  await fadeBlack(1, 1500);
  S.f.mirrorDoor = false; S.f.doorOpen = false; S.f.mirrorReset = true; refresh();
  await wait(900);
  await fadeBlack(0, 1500);
  S.lock = false;
  toast("Всё вернулось на свои места.");
}
function bruiseUse(it) {
  if (it === "ice" && !S.f.hole) {
    take("ice"); S.f.hole = true; Audio2.crack(); flashFX();
    toast("Лёд растаял — на месте синяка зияет дыра.");
    refresh(); return true;
  }
  return false;
}
function hangMap() {
  take("map"); S.f.mapHung = true; Audio2.click();
  toast("Карта легла в пустую раму."); refresh();
}

/* ---- Шаг 31: стол с фишками -------------------------------------------- */
async function tableMove(row, col) {
  if (S.lock || S.f.tableSolved) return;
  S.tablePos[row] = col; Audio2.click(); refresh();
  if (!TABLE_ROWS.every(r => S.tablePos[r.id] === TABLE_SOLUTION[r.id])) return;
  S.lock = true; S.f.tableSolved = true; S.__crumple = true; Audio2.good(); refresh();
  toast("Листок сморщился, дёрнулся…");
  await wait(2600);
  S.__crumple = false; S.f.noteDone = true; S.lock = false;
  toast("Листок расправился — на нём лежит провод.");
  refresh();
}

/* ---- Шаги 32-33: прожектор, выключатель, картина ----------------------- */
function projectorUse(it) {
  if (it === "wire" && !S.f.projectorWired) {
    take("wire"); S.f.projectorWired = true; Audio2.good();
    toast("Прожектор загудел."); refresh(); return true;
  }
  return false;
}
function switchUse(it) {
  if (it === "key" && !S.f.switchFixed) {
    take("key"); S.f.switchFixed = true; Audio2.click();
    toast("Клавиша встала на место."); refresh(); return true;
  }
  return false;
}
function toggleLight() {
  if (!S.f.switchFixed) { toast("Выключатель не работает."); return; }
  S.f.lightOff = !S.f.lightOff; Audio2.thud(); refresh();
  toast(S.f.lightOff ? "Свет погас." : "Свет включился.");
}
function paintingUse(it) {
  const f = S.f;
  if (it !== "knife") return false;
  if (f.pin)         { toast("Картина уже разрезана."); return "keep"; }
  if (!f.switchFixed) { toast("Нож здесь ни к чему."); return "keep"; }
  if (!f.lightOff)   { toast("Нож здесь ни к чему."); return "keep"; }
  f.pin = true; give("pin"); Audio2.snip(); flashFX();
  toast("Из-под холста выпала булавка!");
  f.lightOff = false;           // свет возвращается сам
  refresh(); return true;
}

/* ---- Шаг 34: булавка в карту ------------------------------------------- */
function mapUse(it, e) {
  if (it !== "pin") return false;
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  const dist = Math.hypot(x - MAP_TARGET.x, (y - MAP_TARGET.y) * r.height / r.width);
  if (dist <= MAP_TARGET.r) { finale(x, y); return true; }
  Audio2.bad();
  S.pinMarks.push([x, y]);
  toast("Булавка вошла в бумагу — и ничего. Не то место.");
  refresh(); return "keep";
}

/* =========================================================================
   5. КРАФТ В ИНВЕНТАРЕ — рецепты: «отсортированная пара id -> действие»
   ========================================================================= */
function tryCombine(a, b) {
  if (!has(a) || !has(b)) return;
  const key = [a, b].sort().join("+");
  const R = {};
  R[["glass_sap", "handkerchief_dry"].sort().join("+")] = () => {
    take("glass_sap"); take("handkerchief_dry"); give("handkerchief_wet"); S.f.wet = true;
    toast("Смочили салфетку соком цветка.");
  };
  if (R[key]) { R[key](); select(null); renderBar(); return; }
  Audio2.bad(); toast("Из этого ничего не выйдет.");
}

/* Осмотр предмета из инвентаря (фотография). photoSVG — в scenes.js. */
function showPhoto() {
  const v = document.createElement("div");
  v.className = "viewer";
  v.innerHTML = '<div class="photo">' + photoSVG() + "</div>";
  v.addEventListener("click", () => v.remove());
  stage.appendChild(v);
}

/* =========================================================================
   6. РЕНДЕР + НАВИГАЦИЯ
   ========================================================================= */
function renderBar() {
  bar.innerHTML = "";
  S.inv.forEach(id => {
    const it = ITEMS[id];
    const s = document.createElement("div");
    s.className = "slot" + (S.selected === id ? " sel" : "");
    s.title = it.name;
    const ico = document.createElement("div");
    ico.className = "ico";
    if (it.img) {
      ico.style.backgroundImage = "url(" + IMG + it.img + ")";
      if (it.filter) ico.style.filter = it.filter;
    } else ico.textContent = it.icon;
    const nm = document.createElement("div");
    nm.className = "nm"; nm.textContent = it.short || it.name;
    s.append(ico, nm);
    s.addEventListener("click", e => {
      e.stopPropagation();
      if (S.lock) return;
      Audio2.click();
      if (S.selected && S.selected !== id) tryCombine(S.selected, id);
      else if (it.look && !S.selected) showPhoto();
      else select(id);
    });
    bar.appendChild(s);
  });
  stage.classList.toggle("holding", !!S.selected);
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
}

let swapping = false;
/* ZoomView — переход в любой вид с cross-fade. */
function go(view) {
  if (swapping || S.lock) return;
  swapping = true;
  scene.classList.add("swap");
  setTimeout(() => {
    // шаг 29: выйдя из зума зеркала с пазлом в руках, зеркало на стене превращается в дверь
    if (S.view === "mirror" && S.f.puzzle && !S.f.mirrorReset) S.f.mirrorDoor = true;
    S.view = view;
    if (WALLS.includes(view)) S.wallIndex = WALLS.indexOf(view);
    if (view === "headboard") S.f.headboard = true;
    refresh();
    scene.classList.remove("swap");
    swapping = false;
  }, window.__FAST ? 0 : 280);
}
function back() { go(WALLS[S.wallIndex]); }
function turn(dir) { go(WALLS[(S.wallIndex + dir + WALLS.length) % WALLS.length]); }

/* =========================================================================
   7. ПОДСКАЗКИ — следующий шаг по текущему прогрессу
   ========================================================================= */
function currentHint() {
  const f = S.f;
  if (!f.morse) return "Плакат на стене с кроватью — код Морзе. Откройте сапог крупным планом и залейте жижу в том же порядке: жёлтая = точка, коричневая = тире.";
  if (!f.knife) return "Заберите нож со дна сапога.";
  if (!f.drawerOpen) return "Нижний ящик тумбочки выдвигается. На нём что-то нацарапано.";
  if (!f.fridgeOpen) return "Холодильник на стене с окнами закрыт кодовым замком из четырёх букв. Слово — на открытом ящике.";
  if (!f.glass || !f.ice) return "Возьмите из холодильника пустой стакан и лёд.";
  if (!f.aniline) return "Примените нож на кусок красного мяса в холодильнике — получите анилин.";
  if (!f.roller) return "На полке (стена с кроватью) лежит валик.";
  if (!f.phono) return "Вставьте валик в фонограф.";
  if (!f.tea) return "Из трубы фонографа выпал чай — заберите его.";
  if (!f.bulb) return "В нижнем ящике тумбочки лежит луковица.";
  if (!f.planted) return "Посадите луковицу в горшок на полке.";
  if (!f.quilt) return "Запомните птиц (большие пуговицы) и яйца (маленькие) на окнах и разложите такие же бусины по ячейкам одеяла.";
  if (!f.heart) return "Из-под одеяла достаньте зайчика (он остаётся на месте) и примените на него нож.";
  if (!f.mixDone) return "Поставьте пустой стакан в смеситель и по очереди применяйте на него предметы: сердце, анилин, чай.";
  if (!f.grown) return "Заберите стакан со смесью и вылейте в горшок.";
  if (!f.cut) return "Примените нож на выросший цветок.";
  if (!f.brokenOff) return "Кликните рукой по надрезанному цветку — отломите верхушку.";
  if (!f.sap) return "Подставьте пустой стакан под капающий сок.";
  if (!f.napkin) return "Сухая салфетка лежит на полу за ножками кровати.";
  if (!f.wet) return "В инвентаре совместите сухую салфетку со стаканом сока.";
  if (!f.headboard) return "Осмотрите изголовье кровати — там спрятана подсказка.";
  if (!f.stains) return "Крышка тумбочки: мокрой салфеткой сотрите пятна в порядке цветов человечков с изголовья.";
  if (!f.photo) return "В открывшемся механизме тумбочки лежит фотография.";
  if (!f.puzzle) return "Зеркало: приложите надломленный цветок Варе за ухо — как на портрете-подсказке.";
  if (!f.mirrorReset) return "Выйдите из зеркала. Что-то изменилось.";
  if (!f.hole) return "У Вари в зеркале синяк — приложите лёд.";
  if (!f.map) return "Из дыры торчит карта — заберите её.";
  if (!f.mapHung) return "Повесьте карту в пустую рамку на стене с зеркалом.";
  if (!f.wire) return "Стол на четвёртой стене: фишки в таблице нужно расставить по подсказке на листке.";
  if (!f.projectorWired) return "Вставьте провод в сломанный прожектор.";
  if (!f.key) return "Откройте люк прожектора и достаньте клавишу.";
  if (!f.switchFixed) return "Вставьте клавишу в сломанный выключатель.";
  if (!f.pin) return "Выключите свет. Прожектор высветит угол картины — разрежьте её ножом.";
  return "Посмотрите фото и ткните булавкой в карту там, где стоял человек (посередине между двумя объектами).";
}

/* =========================================================================
   8. ФИНАЛ — рука из карты, полёт Вари, экран «пройдено»
   ========================================================================= */
async function finale(px, py) {
  S.lock = true; take("pin"); select(null);
  Audio2.crack(); shakeScene(); flashFX();
  const c = document.createElement("div");
  c.id = "cine";
  c.innerHTML = cineHTML(px, py);        // scenes.js
  stage.appendChild(c);
  await wait(2300);                      // рука рвёт карту и тянется к Варе
  c.classList.add("p2"); Audio2.whoosh();
  await wait(2300);                      // хватает, вспыхивает свет
  c.classList.add("p3");
  await wait(7500);                      // полёт вверх мимо предметов комнаты
  c.classList.add("p4");
  await wait(1600);                      // вспышка
  S.f.done = true; S.lock = false;
  endGame();
  c.remove();
}

function endGame() {
  renderBar();
  $("#endText").innerHTML =
    "Рука из карты подхватила Варю, и она, слегка покачиваясь, поплыла вверх — в свет, мимо кровати, " +
    "сапога и тумбочки.<br><br>" +
    "Кусочки цветка-пазла из ниши за зеркалом остались у вас в инвентаре — наверняка они пригодятся в комнате&nbsp;2.";
  $("#endScreen").classList.remove("hidden");
}

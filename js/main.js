"use strict";
/* =============================================================================
   ЗАПУСК — точка входа (грузится последней)
   -----------------------------------------------------------------------------
   Только связывание: навешивает обработчики на кнопки/клавиши, прелоадит
   картинки, делает первый refresh() и разбирает dev-параметры URL.
   Никакой игровой логики здесь нет — она в js/functions.js.
   ============================================================================= */

/* ---- Кнопки экранов ---- */
$("#startBtn").addEventListener("click", () => {
  Audio2.click();
  $("#startScreen").classList.add("hidden");
  refresh();
});
$("#againBtn").addEventListener("click", () => location.reload());

/* ---- Навигация ---- */
navL.addEventListener("click", () => { Audio2.click(); turn(-1); });
navR.addEventListener("click", () => { Audio2.click(); turn(1); });
backBtn.addEventListener("click", () => { Audio2.click(); back(); });
$("#hintBtn").addEventListener("click", () => { toast(currentHint()); });

/* ---- Клик по пустому месту сцены — снять предмет с руки ---- */
scene.addEventListener("click", () => { if (S.selected) select(null); });

/* ---- Клавиатура: ← / → стены, Esc назад, D — хитбоксы ---- */
window.addEventListener("keydown", e => {
  if ($("#startScreen").classList.contains("hidden") === false) return;
  if (S.lock) return;
  if (e.key === "ArrowLeft" && WALLS.includes(S.view)) turn(-1);
  if (e.key === "ArrowRight" && WALLS.includes(S.view)) turn(1);
  if (e.key === "Escape" && !WALLS.includes(S.view)) back();
  if (e.key.toLowerCase() === "d") stage.classList.toggle("debug");
});

/* ---- Прелоад ключевых картинок ---- */
[
  "wall_bed.png", "room_bg.png", "poster_zoom.png", "boot_empty.png", "boot_yellow.png", "boot_brown.png",
  "bed_zoom.png", "bed_zoom_open.png", "nightstand_zoom.png", "nightstand_zoom_open.png",
  "handkerchief.png", "bed.png", "nightstand.png", "painting.png",
  "stain_red.png", "stain_blue.png", "stain_cyan.png", "stain_green.png", "stain_yellow.png",
].forEach(s => { const i = new Image(); i.src = IMG + s; });

/* ---- Первый рендер ---- */
refresh();

/* ---- Dev-хуки:  ?start  &view=wall1  &give=knife,glass_empty  &set=morse,knife
                  &state={"bootFill":"yellow"}  &debug  &selftest ----
   set — выставить флаги S.f (true); state — слить JSON в S (верхний уровень). */
(function dev() {
  const q = new URLSearchParams(location.search);
  if (q.has("start")) $("#startScreen").classList.add("hidden");
  if (q.get("give")) q.get("give").split(",").forEach(give);
  if (q.get("set")) q.get("set").split(",").forEach(kv => {
    const [k, v] = kv.split("=");
    S.f[k] = v === undefined ? true : JSON.parse(v);                  // set=morse,mirrorStage=2
  });
  if (q.get("state")) Object.assign(S, JSON.parse(q.get("state")));   // например {"bootFill":"yellow"}
  if (q.get("view")) {
    S.view = q.get("view");
    if (WALLS.includes(S.view)) S.wallIndex = WALLS.indexOf(S.view);
  }
  if (q.has("debug")) stage.classList.add("debug");
  if (q.get("cine")) {                          // ?cine=p2 или p2,p3 — показать фазы финала
    S.view = "map"; refresh();
    const c = document.createElement("div");
    c.id = "cine"; c.innerHTML = cineHTML(MAP_TARGET.x, MAP_TARGET.y);
    q.get("cine").split(",").forEach(p => c.classList.add(p));
    stage.appendChild(c);
  }
  if (q.has("start") || q.get("view") || q.get("set") || q.get("state")) refresh();
  if (q.has("selftest")) setTimeout(selfTest, 400);
})();

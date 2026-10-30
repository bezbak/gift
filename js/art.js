"use strict";
/* =============================================================================
   ГРАФИКА-ПЛЕЙСХОЛДЕРЫ — SVG-рисунки и геометрия (без логики игры)
   -----------------------------------------------------------------------------
   Реальный арт есть для: стены с кроватью, плаката, сапога (3 состояния),
   кровати/тумбочки (крупные планы), пятен, салфетки. Всё остальное нарисовано
   здесь и заменяется подстановкой файла в js/scenes.js.

   Frame(vbW, vbH, l, t, w) — рамка в % сцены с известным соотношением сторон.
   Любую точку рисунка (в координатах viewBox) переводят в % сцены через
   frame.pt(x,y) / frame.r(x,y,w,h) — так хитбоксы и оверлеи всегда попадают
   в нарисованные детали.
   ============================================================================= */

const INK = "#17120d";
const PAL = {
  wood: "#a67c52", woodD: "#7a5236", woodL: "#c19a6b", plum: "#8d5f4d",
  paper: "#f2e3b8", glass: "#cfe1e6", metal: "#b7c0c4", maroon: "#6a2230",
  gold: "#e0b070", skin: "#f0cfae", hair: "#4a2e22",
};

/* ---------------------------------------------------------------------------
   Геометрия
   --------------------------------------------------------------------------- */
function el(cls, css, html) {
  const d = document.createElement("div");
  d.className = cls;
  if (css) d.style.cssText = css;
  if (html) d.innerHTML = html;
  return d;
}
function box(r, cls, html) {
  return el("abs " + (cls || ""), "left:" + r[0] + "%;top:" + r[1] + "%;width:" + r[2] + "%;height:" + r[3] + "%", html);
}
function hs(r, o) { return hotspot(Object.assign({ r }, o)); }

/* Рамка под рисунок vbW x vbH шириной w% сцены (сцена 4:3 -> высота считается). */
function Frame(vbW, vbH, l, t, w) {
  const h = w * 4 * vbH / (3 * vbW);
  const f = {
    l, t, w, h, vbW, vbH,
    r:  (x, y, ww, hh) => [l + w * x / vbW, t + h * y / vbH, w * ww / vbW, h * hh / vbH],
    pt: (x, y) => [l + w * x / vbW, t + h * y / vbH],
    svg(inner, cls) {
      return box([l, t, w, h], "art" + (cls ? " " + cls : ""),
        '<svg viewBox="0 0 ' + vbW + " " + vbH + '" preserveAspectRatio="xMidYMid meet">' + inner + "</svg>");
    },
  };
  return f;
}
/* Квадратный по пикселям элемент шириной w%, центр в точке p (в % сцены). */
function centered(p, w) { return Frame(100, 100, p[0] - w / 2, p[1] - (w * 4 / 3) / 2, w); }

/* Кроп из 4:3-картинки: показываем полосу от y0 до y1 (доли высоты) на всю ширину w%.
   Дети кладутся в % от самой полосы. */
function cropBox(src, y0, y1, l, t, w) {
  const hf = y1 - y0, h = w * hf;
  const d = el("abs crop", "left:" + l + "%;top:" + t + "%;width:" + w + "%;height:" + h + "%;" +
    "background-image:url(" + IMG + src + ");background-repeat:no-repeat;" +
    "background-size:100% " + (100 / hf) + "%;background-position:0 " + (y0 / (1 - hf) * 100) + "%");
  d.h = h;
  return d;
}

/* Спрайт-вырезка из полнокадрового прозрачного PNG по bbox (% изображения). */
function spriteDiv(src, bb, wPct, css) {
  const bw = bb[1] - bb[0], bh = bb[3] - bb[2];
  return el("abs", "width:" + wPct + "%;height:" + (wPct * bh / bw) + "%;background:url(" + IMG + src + ") no-repeat;" +
    "background-size:" + (10000 / bw) + "% auto;background-position:" + (bb[0] / (100 - bw) * 100) + "% " +
    (bb[2] / (100 - bh) * 100) + "%;" + (css || ""));
}
const BBOX = {
  bed:        [11.4, 47.1, 57.7, 91.4],
  nightstand: [71.1, 85.5, 66.6, 89.8],
  painting:   [27.4, 35.8, 14.1, 28.5],
  napkin:     [18.9, 78.1, 7.0, 93.3],
};

/* ---------------------------------------------------------------------------
   Предметы и мелкие детали
   --------------------------------------------------------------------------- */
/* Пуговица: big — «птичка», small — «яйцо». bird:true добавляет клюв и хвост. */
function artButton(kind, bird) {
  if (kind === "big") {
    const r = bird ? 36 : 43, cx = bird ? 46 : 50;
    return (bird ? '<path class="o" d="M82 44 L99 50 L82 57 Z" fill="#e08a2c"/>' +
                   '<path class="o" d="M10 50 L0 40 L3 51 L0 62 Z" fill="#c9852c"/>' : "") +
      '<circle class="o" cx="' + cx + '" cy="50" r="' + r + '" fill="#efe3c8"/>' +
      '<circle class="t" cx="' + cx + '" cy="50" r="' + (r - 9) + '" fill="none"/>' +
      [[-11, -11], [11, -11], [-11, 11], [11, 11]].map(p =>
        '<circle cx="' + (cx + p[0]) + '" cy="' + (50 + p[1]) + '" r="4.6" fill="#3b2c1e"/>').join("") +
      '<path d="M' + (cx - 11) + " 39 L" + (cx + 11) + " 61 M" + (cx + 11) + " 39 L" + (cx - 11) + ' 61" stroke="#b5483a" stroke-width="2.4" fill="none"/>';
  }
  return '<ellipse class="o" cx="50" cy="50" rx="27" ry="35" fill="#f6efd8"/>' +
    '<circle cx="50" cy="40" r="4" fill="#3b2c1e"/><circle cx="50" cy="60" r="4" fill="#3b2c1e"/>' +
    '<path d="M50 40 L50 60" stroke="#b5483a" stroke-width="2.2"/>' +
    '<circle cx="40" cy="48" r="1.6" fill="#a88f66"/><circle cx="60" cy="56" r="1.6" fill="#a88f66"/><circle cx="56" cy="36" r="1.4" fill="#a88f66"/>';
}
function svgWrap(vb, inner) { return '<svg viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">' + inner + "</svg>"; }

const artRoller = () =>
  '<rect class="o" x="6" y="8" width="48" height="24" rx="9" fill="#d8b878"/>' +
  '<path class="t" d="M18 8 v24 M30 8 v24 M42 8 v24" fill="none"/>' +
  '<ellipse class="o" cx="8" cy="20" rx="4" ry="12" fill="#6b4a2a"/>';
const artBulb = () =>
  '<path class="o" d="M30 6 Q34 16 44 22 Q56 36 44 50 Q30 60 16 50 Q4 36 16 22 Q26 16 30 6 Z" fill="#caa46b"/>' +
  '<path class="t" d="M30 14 Q22 34 26 52 M30 14 Q38 34 34 52" fill="none"/>' +
  '<path d="M26 56 q-4 6 -8 6 M30 57 v6 M34 56 q4 6 8 6" stroke="#5a3a1a" stroke-width="2" fill="none"/>';
const artTea = () =>
  '<rect class="o" x="6" y="4" width="48" height="62" rx="4" fill="#d8b24a"/>' +
  '<rect class="t" x="12" y="10" width="36" height="22" rx="3" fill="#8a5a1e"/>' +
  '<path d="M20 22 q10 -10 20 0 q-10 6 -20 0z" fill="#e6d27a"/>' +
  '<path class="t" d="M12 42 h36 M12 50 h36" fill="none"/>';
const artKnife = () =>
  '<path class="o" d="M4 30 L108 8 Q116 22 108 34 Z" fill="#d7dde2"/>' +
  '<rect class="o" x="104" y="12" width="64" height="24" rx="8" fill="#5b3a24"/>' +
  '<path d="M20 26 L96 14" stroke="#fff" stroke-width="2" opacity=".7"/>';
const artPhoto = () =>
  '<rect class="o" x="3" y="3" width="54" height="44" fill="#f4ecd6"/><rect x="8" y="8" width="44" height="30" fill="#b9a67a"/>' +
  '<circle cx="30" cy="20" r="4" fill="#4a3a28"/><path d="M30 24 l-6 12 h12 z" fill="#4a3a28"/>';
const artPuzzle = () =>
  '<path class="o" d="M6 14 h12 q-2 -8 4 -8 t4 8 h12 v12 q8 -2 8 4 t-8 4 v12 h-12 q2 8 -4 8 t-4 -8 h-12 z" fill="#d97aa8"/>';
const artWire = () =>
  '<path d="M4 40 Q14 6 28 36 T54 14" stroke="#b83a2a" stroke-width="5" fill="none" stroke-linecap="round"/>' +
  '<path d="M4 40 Q14 6 28 36 T54 14" stroke="#17120d" stroke-width="1.2" fill="none"/>' +
  '<rect class="o" x="0" y="36" width="8" height="8" rx="2" fill="#c9c9c9"/><rect class="o" x="52" y="10" width="8" height="8" rx="2" fill="#c9c9c9"/>';
const artKey = () =>
  '<rect class="o" x="6" y="10" width="40" height="28" rx="6" fill="#efe6d0"/>' +
  '<path class="t" d="M14 24 h24" fill="none"/><circle cx="26" cy="24" r="3" fill="#b5483a"/>';

/* Цветок-орхидея. cx,cy — центр в viewBox. */
function artOrchid(cx, cy, k) {
  k = k || 1;
  const petal = (a, rx, ry, fill) =>
    '<ellipse class="o" cx="0" cy="' + (-ry * .85) + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" transform="rotate(' + a + ')"/>';
  return '<g transform="translate(' + cx + " " + cy + ") scale(" + k + ')">' +
    petal(0, 8, 13, "#c970b8") + petal(72, 8, 13, "#c970b8") + petal(144, 8, 13, "#c970b8") +
    petal(216, 8, 13, "#c970b8") + petal(288, 8, 13, "#c970b8") +
    '<ellipse class="o" cx="0" cy="3" rx="7" ry="9" fill="#f6b4de"/><circle cx="0" cy="-1" r="3.2" fill="#f3d96a"/></g>';
}
function artSmallFlower(x, y) {
  return [0, 72, 144, 216, 288].map(a =>
    '<circle cx="' + (x + 3.4 * Math.sin(a * Math.PI / 180)) + '" cy="' + (y - 3.4 * Math.cos(a * Math.PI / 180)) +
    '" r="2.4" fill="#f08cc4" stroke="' + INK + '" stroke-width=".5"/>').join("") +
    '<circle cx="' + x + '" cy="' + y + '" r="1.8" fill="#f3d96a"/>';
}

/* Горшок и растение. st: { planted, grown, cut, broken } ; viewBox 100x150 */
function artPlant(st) {
  let s =
    '<path class="o" d="M26 108 h48 l-6 36 h-36 z" fill="#b8693e"/>' +
    '<rect class="o" x="21" y="101" width="58" height="11" rx="3" fill="#c97b4d"/>' +
    '<ellipse cx="50" cy="104" rx="25" ry="3.6" fill="#3a2416"/>';
  if (st.grown) {
    const top = st.broken ? 66 : 34;
    s += '<path d="M50 104 Q44 ' + (top + 36) + " 50 " + top + '" stroke="#17120d" stroke-width="8" fill="none" stroke-linecap="round"/>' +
         '<path d="M50 104 Q44 ' + (top + 36) + " 50 " + top + '" stroke="#4f8a2e" stroke-width="5" fill="none" stroke-linecap="round"/>' +
         '<path class="o" d="M48 100 Q22 92 14 70 Q36 70 48 92 Z" fill="#5f9a38"/>' +
         '<path class="o" d="M52 98 Q80 90 88 66 Q64 68 52 90 Z" fill="#5f9a38"/>';
    if (st.cut && !st.broken) s += '<path d="M44 68 l12 5 M45 74 l10 -3" stroke="#17120d" stroke-width="1.8" fill="none"/>' +
                                   '<ellipse cx="50" cy="70" rx="4" ry="2" fill="#c8e080" opacity=".9"/>';
    if (!st.broken) s += artOrchid(50, 30, 1);
    else s += '<path class="o" d="M45 66 l3 -4 l3 3 l3 -4 l1 5 z" fill="#4f8a2e"/>';
  } else if (st.planted) {
    s += '<path d="M50 104 Q49 96 53 90" stroke="#17120d" stroke-width="5" fill="none" stroke-linecap="round"/>' +
         '<path d="M50 104 Q49 96 53 90" stroke="#8cb84a" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  }
  return s;
}

/* ---------------------------------------------------------------------------
   Окно (200x200): панели 2x2, птицы/яйца кладутся поверх как отдельные элементы
   --------------------------------------------------------------------------- */
const artWindow = () =>
  '<defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe9ed"/><stop offset="1" stop-color="#a9c0c8"/></linearGradient></defs>' +
  '<rect class="o" x="6" y="6" width="188" height="186" rx="8" fill="' + PAL.woodD + '"/>' +
  '<rect class="o" x="18" y="18" width="164" height="162" fill="url(#gw)"/>' +
  '<path d="M28 28 L68 28 L38 96 Z" fill="#fff" opacity=".3"/>' +
  '<rect class="o" x="95" y="18" width="10" height="162" fill="' + PAL.wood + '"/>' +
  '<rect class="o" x="18" y="94" width="164" height="10" fill="' + PAL.wood + '"/>' +
  '<rect class="o" x="0" y="186" width="200" height="12" rx="4" fill="' + PAL.woodL + '"/>';
/* центры «посадочных мест» на рамах: [столбец окна][строка] */
const WIN_SEAT = [[56, 56 + 22], [144, 56 + 22], [56, 142 + 20], [144, 142 + 20]];
const winSeat = (cc, row) => [cc ? 144 : 56, row ? 162 : 78];

/* Фонограф (220x252) */
function artPhono(inserted, spinning) {
  return '<rect class="o" x="6" y="190" width="208" height="12" rx="3" fill="' + PAL.woodL + '"/>' +
    '<rect class="o" x="22" y="202" width="12" height="46" fill="' + PAL.wood + '"/>' +
    '<rect class="o" x="186" y="202" width="12" height="46" fill="' + PAL.wood + '"/>' +
    '<rect class="o" x="26" y="128" width="130" height="62" rx="6" fill="' + PAL.plum + '"/>' +
    '<rect class="t" x="34" y="138" width="114" height="44" rx="3" fill="none"/>' +
    '<circle class="o" cx="60" cy="160" r="9" fill="#d7c08a"/><circle cx="60" cy="160" r="3" fill="' + INK + '"/>' +
    '<rect class="o" x="44" y="108" width="74" height="22" rx="4" fill="#3a2616"/>' +
    (inserted ? '<g class="' + (spinning ? "spin" : "") + '"><rect class="o" x="50" y="104" width="62" height="20" rx="8" fill="#d8b878"/>' +
      '<path class="t" d="M62 104 v20 M76 104 v20 M90 104 v20 M104 104 v20" fill="none"/></g>' : "") +
    '<path class="o" d="M120 118 L168 26 Q214 16 214 72 Q214 118 150 150 Z" fill="#d9b25a"/>' +
    '<ellipse class="o" cx="190" cy="62" rx="17" ry="44" transform="rotate(-14 190 62)" fill="#3a2616"/>' +
    '<path class="t" d="M134 112 L176 34" fill="none"/>' +
    '<path class="o" d="M156 160 h22 v-14" fill="none"/>';
}
const PHONO_BELL = [190, 62];

/* Мини-холодильник (150x200), снаружи */
function artFridge(open) {
  return '<rect class="o" x="12" y="14" width="126" height="170" rx="12" fill="#b9c6c2"/>' +
    (open ? '<rect class="o" x="24" y="26" width="102" height="146" rx="6" fill="#e6efed"/>' +
            '<path class="o" d="M12 14 L34 24 L34 174 L12 184 Z" fill="#a7b5b1"/>'
          : '<path class="t" d="M12 66 H138" fill="none"/>' +
            '<rect class="o" x="112" y="76" width="9" height="58" rx="4" fill="#8e9a98"/>') +
    '<rect class="o" x="24" y="184" width="16" height="10" fill="#4b4038"/><rect class="o" x="110" y="184" width="16" height="10" fill="#4b4038"/>';
}
/* Кодовый замок на дверце (в системе координат artFridge): панель с 4 окошками */
const FRIDGE_LOCK = { x: 30, y: 24, w: 90, h: 30 };
const artFridgeLock = () =>
  '<rect class="o" x="' + FRIDGE_LOCK.x + '" y="' + FRIDGE_LOCK.y + '" width="' + FRIDGE_LOCK.w + '" height="' + FRIDGE_LOCK.h + '" rx="4" fill="#3c4548"/>';

/* Внутренность холодильника (300x240) */
function artFridgeInside(st) {
  let s = '<rect class="o" x="8" y="8" width="284" height="224" rx="14" fill="#dfe9e7"/>' +
    '<rect class="o" x="8" y="108" width="284" height="8" fill="#b7c6c3"/>';
  if (!st.ice) {
    s += '<rect class="o" x="24" y="56" width="108" height="48" rx="6" fill="#bcd3da"/>';
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++)
      s += '<rect class="o" x="' + (30 + i * 25) + '" y="' + (62 + j * 20) + '" width="21" height="16" rx="4" fill="#eaf6fb"/>';
  }
  if (!st.glass) {
    s += '<path class="o" d="M196 40 l6 64 h36 l6 -64 z" fill="#d8eef2" opacity=".92"/>' +
         '<path class="t" d="M200 52 h44" fill="none"/>';
  }
  s += '<path class="o" d="M50 150 Q28 172 56 202 Q120 226 220 204 Q264 180 232 156 Q150 134 50 150 Z" fill="#a63a3a"/>' +
       '<path class="t" d="M80 160 Q130 150 190 164 M70 182 Q140 172 210 184" fill="none" stroke="#e8b4a8"/>';
  if (!st.aniline) {
    s += '<path d="M64 156 Q140 142 214 160 Q240 180 214 198 Q140 214 62 196 Q44 176 64 156 Z" fill="#9cc7a0" opacity=".8"/>' +
         [[90, 170], [120, 182], [150, 164], [180, 178], [200, 190], [110, 196], [160, 196]].map(p =>
           '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.4" fill="#4f7fb8" opacity=".8"/>').join("");
  }
  return s;
}
const FRIDGE_IN = { ice: [24, 52, 108, 54], glass: [194, 36, 52, 70], meat: [40, 136, 214, 90] };

/* Смеситель (100x150) */
function artMixer(st) {
  const any = MIX_ITEMS.some(k => S.f.mix[k]);
  const liquid = st.done ? "#cdb44a" : (any ? "#dfd49a" : "#d8eef2");
  return '<rect class="o" x="76" y="16" width="10" height="100" rx="3" fill="#5b4c42"/>' +
    '<path class="o" d="M12 112 h76 v28 q0 8 -8 8 h-60 q-8 0 -8 -8 z" fill="#4b4038"/>' +
    '<rect class="o" x="22" y="100" width="56" height="14" rx="4" fill="#6b5c50"/>' +
    '<rect class="o" x="24" y="10" width="62" height="16" rx="5" fill="#6b5c50"/><rect class="o" x="45" y="24" width="10" height="14" fill="#4b4038"/>' +
    (st.glass ? '<g class="' + (st.mixing ? "whirr" : "") + '"><path class="o" d="M28 34 L32 100 h36 L72 34 z" fill="' + liquid + '" opacity=".95"/>' +
      '<path class="t" d="M30 46 h40" fill="none"/>' + (st.done ? '<path d="M34 56 h32 L67 98 h-34 z" fill="#b89a2e" opacity=".5"/>' : "") + '</g>'
      : '<ellipse class="t" cx="50" cy="100" rx="18" ry="3" fill="none"/>') +
    [30, 50, 70].map((x, i) => '<circle class="o" cx="' + x + '" cy="132" r="5" fill="' +
      (MIX_ITEMS.every(k => S.f.mix[k]) || S.f.mix[MIX_ITEMS[i]] ? "#ffd86b" : "#2a211b") + '"/>').join("");
}

/* Выключатель (60x90). fixed — есть клавиша; on — свет горит */
function artSwitch(fixed, on) {
  return '<rect class="o" x="6" y="4" width="48" height="82" rx="6" fill="#e9dfc8"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="#8a7f68"/><circle cx="48" cy="78" r="2.4" fill="#8a7f68"/>' +
    '<rect class="o" x="16" y="22" width="28" height="46" rx="3" fill="#2a2018"/>' +
    (fixed
      ? '<rect class="o" x="19" y="' + (on ? 25 : 46) + '" width="22" height="19" rx="3" fill="#efe6d0"/>'
      : '<path d="M24 46 Q14 38 22 30 M36 46 Q48 40 40 30" stroke="#b83a2a" stroke-width="2.4" fill="none"/>' +
        '<path d="M30 68 Q30 76 22 80" stroke="#2f6fb0" stroke-width="2.4" fill="none"/>');
}

/* Прожектор (200x120). wired — провод подключён, open — люк открыт, key — клавиша внутри */
const PROJ_HATCH = [108, 38, 50, 42];
function artProjector(wired, open, hasKey) {
  const h = PROJ_HATCH;
  return '<path class="o" d="M190 60 H170" fill="none"/><rect class="o" x="176" y="30" width="16" height="64" rx="3" fill="#6d7a76"/>' +
    '<rect class="o" x="40" y="26" width="132" height="68" rx="10" fill="#7d8a86"/>' +
    '<rect class="o" x="12" y="44" width="34" height="34" rx="4" fill="#5d6a66"/>' +
    '<circle class="o" cx="30" cy="61" r="17" fill="' + (wired ? "#ffe9a0" : "#aab6b8") + '"/>' +
    '<circle cx="30" cy="61" r="9" fill="' + (wired ? "#fff7d0" : "#6d7a76") + '"/>' +
    '<path class="t" d="M58 36 h30 M58 44 h30 M58 52 h30" fill="none"/>' +
    '<rect class="o" x="' + h[0] + '" y="' + h[1] + '" width="' + h[2] + '" height="' + h[3] + '" rx="4" fill="' + (open ? "#1e1814" : "#6a7773") + '"/>' +
    (open ? (hasKey ? '<rect class="o" x="' + (h[0] + 8) + '" y="' + (h[1] + 10) + '" width="34" height="22" rx="5" fill="#efe6d0"/>' +
                      '<circle cx="' + (h[0] + 25) + '" cy="' + (h[1] + 21) + '" r="3" fill="#b5483a"/>' : "")
          : '<rect x="' + (h[0] + 20) + '" y="' + (h[1] + 17) + '" width="10" height="8" rx="2" fill="#4b4038"/>') +
    (wired
      ? '<path d="M120 94 Q124 108 150 108 L190 108" stroke="#b83a2a" stroke-width="4" fill="none"/>'
      : '<path d="M120 94 Q116 106 124 112" stroke="#b83a2a" stroke-width="4" fill="none"/>' +
        '<path d="M126 112 l6 -4 M126 112 l8 3 M126 112 l-2 8" stroke="#ffd86b" stroke-width="1.6" fill="none" class="spark"/>');
}

/* Стол (260x170), общий вид на стене */
const artTable = () =>
  '<rect class="o" x="22" y="92" width="16" height="74" fill="' + PAL.wood + '"/><rect class="o" x="222" y="92" width="16" height="74" fill="' + PAL.wood + '"/>' +
  '<rect class="o" x="12" y="72" width="236" height="22" fill="' + PAL.plum + '"/>' +
  '<path class="o" d="M10 72 L250 72 L238 54 L22 54 Z" fill="' + PAL.woodL + '"/>' +
  '<path class="o" d="M66 54 L170 54 L180 68 L58 68 Z" fill="#e8d8a8"/>' +
  '<path class="t" d="M80 54 L76 68 M104 54 L102 68 M128 54 L128 68 M152 54 L154 68 M60 61 H178" fill="none"/>' +
  '<path class="o" d="M186 58 L212 56 L218 66 L190 68 Z" fill="' + PAL.paper + '"/>';

/* Дверь (100x238), на месте зеркала. open — створка распахнута, за ней тень */
function artDoor(open) {
  if (!open) {
    return '<rect class="o" x="4" y="4" width="92" height="232" rx="4" fill="#7a4a3a"/>' +
      '<rect class="t" x="16" y="18" width="68" height="84" fill="none"/><rect class="t" x="16" y="116" width="68" height="104" fill="none"/>' +
      '<circle class="o" cx="78" cy="130" r="5" fill="' + PAL.gold + '"/>';
  }
  return '<rect class="o" x="4" y="4" width="92" height="232" fill="#0a0706"/>' +
    '<g class="shadow"><ellipse cx="56" cy="74" rx="15" ry="19" fill="#262031"/>' +
    '<path d="M32 236 Q34 108 56 98 Q80 108 82 236 Z" fill="#262031"/>' +
    '<circle cx="50" cy="72" r="2.2" fill="#e8e4f0"/><circle cx="62" cy="72" r="2.2" fill="#e8e4f0"/></g>' +
    '<path class="o" d="M4 4 L30 16 L30 224 L4 236 Z" fill="#7a4a3a"/>';
}

/* Варя в зеркале (100x150). o: flower, bruise, hole, cracks, niche, pieces, shardFall */
function artVarya(o) {
  o = o || {};
  const SHARD = "0,104 44,92 30,150 0,150";
  return '<defs><linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3edf1"/><stop offset="1" stop-color="#aebfca"/></linearGradient></defs>' +
    '<rect width="100" height="150" fill="url(#gm)"/>' +
    '<path class="o" d="M0 150 Q2 118 36 108 L64 108 Q98 118 100 150 Z" fill="#7f5f93"/>' +
    '<path class="o" d="M44 94 h12 v18 q-6 6 -12 0 z" fill="#e8c4a4"/>' +
    '<path class="o" d="M24 68 Q20 18 50 14 Q80 18 76 68 Q78 100 70 104 L30 104 Q22 100 24 68 Z" fill="' + PAL.hair + '"/>' +
    '<ellipse class="o" cx="29" cy="66" rx="4.5" ry="8" fill="' + PAL.skin + '"/><ellipse class="o" cx="71" cy="66" rx="4.5" ry="8" fill="' + PAL.skin + '"/>' +
    '<ellipse class="o" cx="50" cy="64" rx="21" ry="27" fill="' + PAL.skin + '"/>' +
    '<path class="o" d="M29 56 Q36 34 52 36 Q68 36 71 56 Q62 44 50 46 Q38 46 29 56 Z" fill="' + PAL.hair + '"/>' +
    '<ellipse cx="41" cy="64" rx="2.6" ry="3.4" fill="' + INK + '"/><ellipse cx="59" cy="64" rx="2.6" ry="3.4" fill="' + INK + '"/>' +
    '<path class="t" d="M36 58 q5 -3 10 0 M54 58 q5 -3 10 0 M50 66 q-3 8 1 9" fill="none"/>' +
    '<path class="o" d="M44 82 q6 4 12 0" fill="none"/>' +
    (o.flower ? artSmallFlower(72, 60) : "") +
    (o.bruise ? '<ellipse cx="38" cy="77" rx="11" ry="8.5" fill="#c9b04a" opacity=".35"/><ellipse cx="37" cy="76" rx="8" ry="6" fill="#6d4f9a" opacity=".8"/><ellipse cx="38" cy="77" rx="4" ry="3" fill="#3f2d66" opacity=".7"/>' : "") +
    (o.hole ? '<ellipse class="o" cx="37" cy="76" rx="8" ry="7" fill="#0a0706"/>' +
              (o.map ? '<rect class="o" x="29" y="73" width="17" height="6.5" rx="3" fill="#e9d9a8" transform="rotate(-22 37 76)"/>' : "") : "") +
    (o.niche ? '<polygon points="' + SHARD + '" fill="#0b0807" stroke="' + INK + '" stroke-width=".8"/>' +
               (o.pieces ? '<g transform="translate(3 121) scale(.31)">' + [0, 26, 52].map((x, i) =>
                  '<path class="o" transform="translate(' + x + ' ' + (i % 2 ? 10 : 0) + ')" d="M2 10 h10 q-2 -7 3 -7 t3 7 h9 v10 q7 -2 7 3 t-7 3 v10 h-22 z" fill="' + ["#d97aa8", "#c970b8", "#f0a8cc"][i] + '"/>').join("") + '</g>' : "") : "") +
    (o.shardFall ? '<g class="shardfall"><polygon points="' + SHARD + '" fill="#cfe1e8" opacity=".75" stroke="#fff" stroke-width="1.2"/></g>' : "") +
    (o.cracks ? '<g class="cracklines" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round">' +
      '<path pathLength="1" d="M60 0 L54 34 L66 62 L44 100 L52 150"/><path pathLength="1" d="M54 34 L14 26 M66 62 L100 78 M44 100 L0 96 M66 62 L34 56"/>' +
      '<path pathLength="1" d="M0 52 L54 34 M100 40 L66 62 M30 0 L54 34 M80 150 L66 62"/></g>' : "");
}
const VARYA_EAR_R = [71, 66], VARYA_EAR_L = [29, 66], VARYA_CHEEK = [37, 76];

/* Зеркало/портрет в арочной раме (120x160). glassInner — содержимое (SVG-строка вложенного рисунка) */
function artMirror(glassInner) {
  return '<defs><clipPath id="mclip"><path d="M18 142 V52 Q18 16 60 16 Q102 16 102 52 V142 Z"/></clipPath></defs>' +
    '<path class="o" d="M8 152 V50 Q8 6 60 6 Q112 6 112 50 V152 Z" fill="' + PAL.woodD + '"/>' +
    '<path class="o" d="M18 142 V52 Q18 16 60 16 Q102 16 102 52 V142 Z" fill="#cfdbe0"/>' +
    '<g clip-path="url(#mclip)"><svg x="18" y="16" width="84" height="126" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice">' + glassInner + '</svg></g>' +
    '<path class="t" d="M8 152 V50 Q8 6 60 6 Q112 6 112 50 V152 Z" fill="none"/>';
}
/* точка в системе artMirror по точке Вари */
const mirrorPt = p => [18 + .84 * p[0], 16 + .84 * p[1]];

/* Портрет-подсказка (100x130): Варя с цветком за правым ухом */
function artPortrait() {
  return '<rect class="o" x="3" y="3" width="94" height="124" rx="4" fill="' + PAL.gold + '"/>' +
    '<rect class="o" x="10" y="10" width="80" height="110" fill="#e9dcc0"/>' +
    '<svg x="10" y="10" width="80" height="110" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice">' +
    '<rect width="100" height="150" fill="#e9dcc0"/>' + artVarya({ flower: true }).replace(/<defs>[\s\S]*?<\/defs><rect width="100" height="150" fill="url\(#gm\)"\/>/, "") + '</svg>' +
    '<path class="t" d="M10 10 H90 V120 H10 Z" fill="none"/>';
}

/* Карта мира (300x200). pins — булавки-метки по неверным местам */
function mapIcon(id) {
  switch (id) {
    case "lighthouse": return '<path class="o" d="M-4 8 L4 8 L2.4 -6 L-2.4 -6 Z" fill="#fff"/><rect x="-3.2" y="-2" width="6.4" height="3" fill="#c33"/><path class="o" d="M-3 -6 L0 -11 L3 -6 Z" fill="#c33"/>';
    case "windmill":   return '<path class="o" d="M-4 8 L4 8 L2.5 -2 L-2.5 -2 Z" fill="#e8d9b0"/><path class="o" d="M0 -2 L-9 -9 M0 -2 L9 -9 M0 -2 L9 5 M0 -2 L-9 5" fill="none"/>';
    case "pyramid":    return '<path class="o" d="M-9 8 L0 -6 L9 8 Z" fill="#e0b25a"/>';
    case "palm":       return '<path class="o" d="M0 8 Q2 0 0 -4" fill="none"/><path d="M0 -4 Q-8 -6 -10 0 M0 -4 Q8 -6 10 0 M0 -4 Q-3 -11 -7 -9 M0 -4 Q3 -11 7 -9" stroke="#2f6a2f" stroke-width="2.2" fill="none"/>';
    case "tower":      return '<rect class="o" x="-3" y="-4" width="6" height="12" fill="#cdbdb0"/><path class="o" d="M-4 -4 L0 -10 L4 -4 Z" fill="#a44"/>';
    case "castle":     return '<rect class="o" x="-8" y="-2" width="16" height="10" fill="#cfc4b4"/><path class="o" d="M-8 -2 v-4 h3 v2 h2 v-2 h3 v2 h2 v-2 h3 v4" fill="#cfc4b4"/>';
  }
  return "";
}
function artMap(pins) {
  return '<rect width="300" height="200" fill="#c4dadd"/>' +
    '<path d="M0 50 H300 M0 100 H300 M0 150 H300 M60 0 V200 M120 0 V200 M180 0 V200 M240 0 V200" stroke="#9fb9bf" stroke-width=".6" fill="none"/>' +
    '<path class="o" d="M20 62 Q40 22 92 32 Q132 22 152 62 Q162 102 122 122 Q92 152 60 132 Q20 112 20 62 Z" fill="#dcc88f"/>' +
    '<path class="o" d="M172 42 Q222 12 272 42 Q292 82 262 112 Q252 152 212 152 Q182 122 172 82 Z" fill="#cdbc7c"/>' +
    '<path class="o" d="M64 152 Q104 142 134 167 Q112 192 72 187 Z" fill="#dcc88f"/>' +
    '<path d="M60 70 Q80 90 100 78 M200 70 Q220 100 240 90" stroke="#a3905a" stroke-width="1" fill="none" stroke-dasharray="3 3"/>' +
    '<g transform="translate(266 176)"><circle r="12" fill="none" class="t"/><path class="o" d="M0 -11 L3 0 L0 11 L-3 0 Z" fill="#b5483a"/></g>' +
    MAP_LANDMARKS.map(m => '<g transform="translate(' + (m.x * 300) + " " + (m.y * 200) + ')">' + mapIcon(m.id) + "</g>").join("") +
    (pins || []).map(p => '<g transform="translate(' + (p[0] * 300) + " " + (p[1] * 200) + ')"><circle r="3.2" fill="#d8d0c0" stroke="' + INK + '" stroke-width="1"/></g>').join("") +
    '<rect class="o" x="1" y="1" width="298" height="198" fill="none"/>';
}

/* Фотография: человек стоит между маяком (слева) и мельницей (справа) */
function photoSVG() {
  return '<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet" class="art">' +
    '<defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8cba6"/><stop offset="1" stop-color="#efe3bf"/></linearGradient></defs>' +
    '<rect width="200" height="150" fill="url(#gp)"/>' +
    '<path d="M0 112 Q50 98 100 110 T200 106 V150 H0 Z" fill="#b99f6a"/>' +
    '<g transform="translate(40 0)"><path class="o" d="M-9 112 L9 112 L5 52 L-5 52 Z" fill="#f3ead2"/><path d="M-7.4 92 L7.4 92 L6.4 80 L-6.4 80 Z" fill="#b5483a"/>' +
      '<path d="M-6 70 L6 70 L5.4 60 L-5.4 60 Z" fill="#b5483a"/><rect class="o" x="-6" y="44" width="12" height="8" fill="#fff6c8"/><path class="o" d="M-8 44 L0 36 L8 44 Z" fill="#b5483a"/></g>' +
    '<g transform="translate(160 0)"><path class="o" d="M-12 112 L12 112 L7 68 L-7 68 Z" fill="#e8d6aa"/><path class="o" d="M-9 68 L0 58 L9 68 Z" fill="#a85a3a"/>' +
      '<g class="o" fill="none"><path d="M0 64 L-26 38 M0 64 L26 38 M0 64 L26 90 M0 64 L-26 90"/></g></g>' +
    '<g transform="translate(100 0)"><circle class="o" cx="0" cy="84" r="7" fill="' + PAL.skin + '"/>' +
      '<path d="M-6 80 Q0 70 6 80 Q8 86 6 90 Q0 76 -6 90 Q-8 86 -6 80 Z" fill="' + PAL.hair + '"/>' +
      '<path class="o" d="M0 92 L-11 124 L11 124 Z" fill="#7f5f93"/><path class="o" d="M-4 124 V138 M4 124 V138 M-8 100 L-16 112 M8 100 L16 112" fill="none"/></g>' +
    '<rect class="o" x="2" y="2" width="196" height="146" fill="none"/></svg>';
}

/* Бусина-превью (HTML-строка для лотка и ячеек) */
const beadSVG = kind => svgWrap("0 0 100 100", artButton(kind, false));

/* Зайчик (100x128) */
const artBunny = (cutting) =>
  '<g class="' + (cutting ? "bunny-split" : "") + '">' +
  '<ellipse class="o" cx="34" cy="26" rx="9" ry="24" fill="#d8b8a0" transform="rotate(-8 34 26)"/><ellipse cx="34" cy="28" rx="4" ry="16" fill="#e8a8b0" transform="rotate(-8 34 28)"/>' +
  '<ellipse class="o" cx="66" cy="26" rx="9" ry="24" fill="#d8b8a0" transform="rotate(8 66 26)"/><ellipse cx="66" cy="28" rx="4" ry="16" fill="#e8a8b0" transform="rotate(8 66 28)"/>' +
  '<circle class="o" cx="50" cy="64" r="22" fill="#d8b8a0"/><path class="t" d="M28 56 l6 4 M72 70 l-6 -4" fill="none"/>' +
  '<path d="M40 62 l6 4 M46 62 l-6 4 M54 62 l6 4 M60 62 l-6 4" stroke="' + INK + '" stroke-width="2" fill="none"/>' +
  '<path class="o" d="M46 74 q4 3 8 0" fill="none"/>' +
  '<ellipse class="o" cx="50" cy="104" rx="26" ry="20" fill="#d8b8a0"/><path class="t" d="M30 100 l8 6 M64 112 l8 -6" fill="none"/></g>';

/* Рука из карты и Варя целиком — для финальной сцены */
const artHand = () =>
  '<path class="o" d="M8 220 L14 126 L46 126 L52 220 Z" fill="#6c5a7a"/>' +
  '<path class="o" d="M14 128 Q8 96 14 72 L14 40 q0 -7 6 -7 q6 0 6 7 V62 V28 q0 -7 6 -7 q6 0 6 7 V62 V32 q0 -7 6 -7 q6 0 6 7 V64 V44 q0 -6 5 -6 q5 0 5 6 V90 Q52 110 46 128 Z" fill="#e2c6ae"/>';
const artVaryaFull = () =>
  '<path class="o" d="M10 56 Q6 14 30 10 Q54 14 50 56 Q52 78 46 80 L14 80 Q8 78 10 56 Z" fill="' + PAL.hair + '"/>' +
  '<ellipse class="o" cx="30" cy="40" rx="14" ry="18" fill="' + PAL.skin + '"/>' +
  '<path d="M16 34 Q24 20 34 22 Q44 24 44 36 Q36 28 30 30 Q22 30 16 34 Z" fill="' + PAL.hair + '"/>' +
  '<circle cx="25" cy="42" r="1.8" fill="' + INK + '"/><circle cx="36" cy="42" r="1.8" fill="' + INK + '"/><path class="t" d="M26 50 q4 3 8 0" fill="none"/>' +
  '<path class="o" d="M30 58 L8 112 L52 112 Z" fill="#7f5f93"/>' +
  '<path class="o" d="M22 58 L4 40 M38 58 L56 40" fill="none"/>' +
  '<path class="o" d="M20 112 V128 M40 112 V128" fill="none"/>';

/* Разрез (слэш) поверх объекта — для анимации ножа */
const artSlash = () => '<path class="slash" pathLength="1" d="M4 4 L96 96" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>';

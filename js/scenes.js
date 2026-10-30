"use strict";
/* =============================================================================
   ВИДЫ — описание всех стен и крупных планов (зависит от models/functions/art)
   -----------------------------------------------------------------------------
   buildScene() по S.view возвращает { layers:[], nodes:[], hs:[], nav:bool }:
     layers — полнокадровые картинки,  nodes — декор/анимации (без кликов),
     hs     — зоны клика (hotspot).  refresh() кладёт их в сцену в этом порядке.

   Реальный арт: wall_bed, poster_zoom, boot_*, bed_zoom*, nightstand_zoom*,
   painting/bed/nightstand (спрайты), stain_*, handkerchief. Остальное — плейсхолдеры
   из js/art.js: чтобы заменить, подставьте layerImg("файл.png") и поправьте
   соответствующий case.

   Как добавить вид: новый `case` + go("id").
   ============================================================================= */

const MAP_FRAME = Frame(300, 200, 10, 8, 80);

/* Затемнение при выключенном свете. spot — [x%,y%] светлого пятна (угол картины). */
function darkNode(spot) {
  const bg = spot
    ? "radial-gradient(ellipse at " + spot[0] + "% " + spot[1] + "%, rgba(0,0,0,0) 0, rgba(0,0,0,0) 3.5%, rgba(4,2,6,.94) 17%)"
    : "rgba(4,2,6,.88)";
  return el("abs dark", "inset:0;background:" + bg);
}
function backdrop(B) {
  B.layers.push(layerImg("room_bg.png"));
  B.nodes.push(el("abs dimmer", "inset:0"));
}
function say(txt) { return () => toast(txt); }

function buildScene() {
  const B = { layers: [], nodes: [], hs: [], nav: false };
  const f = S.f;

  switch (S.view) {

    /* ============ WALL 0 : кровать, сапог, тумбочка, полка, плакат, картина ============ */
    case "wall0": {
      B.nav = true;
      B.layers.push(layerImg("wall_bed.png"));

      // полка (шаг 8, 11): валик + горшок
      if (!f.roller) {
        const RL = Frame(60, 40, 44.8, 40.9, 5.2);
        B.nodes.push(RL.svg(artRoller()));
        B.hs.push(hs(RL.r(0, 0, 60, 40), {
          title: "На полке лежит валик.",
          click: () => { give("roller"); f.roller = true; toast("Валик."); refresh(); }
        }));
      }
      const PL = Frame(100, 150, 51.6, 27.6, 9.5);
      B.nodes.push(PL.svg(artPlant({ planted: f.planted, grown: f.grown, cut: f.cut, broken: f.brokenOff })));
      B.hs.push(hs(PL.r(16, 18, 68, 128), {
        title: f.grown ? "Цветок в горшке на полке." : "Горшок с землёй на полке.", zoom: true, click: () => go("pot")
      }));

      // плакат с рамкой из точек и тире (шаг 2)
      B.hs.push(hs([76.5, 35.9, 15, 16.1], { title: "Плакат в тёмно-красной раме.", zoom: true, click: () => go("poster") }));

      // жёлтая картина (шаг 33)
      B.hs.push(hs([27.4, 14.1, 8.4, 14.4], {
        title: "Жёлтая картина с красными каракулями.",
        use: paintingUse
      }));
      if (f.pin) {
        const CU = Frame(100, 100, 30.6, 22.2, 5.4);
        B.nodes.push(CU.svg('<path class="o" d="M2 40 L98 62" fill="none"/><path class="o" d="M70 56 L98 30 L98 62 Z" fill="#f5e29a"/>'));
      }

      // кровать (шаги 13, 24) и салфетка на полу (шаг 22)
      B.hs.push(hs([11.4, 57.7, 35.7, 33.7], { title: "Кровать с лоскутным одеялом.", zoom: true, click: () => go("quilt") }));
      B.hs.push(hs([11.4, 57.7, 5.5, 33.7], { title: "Изголовье кровати.", zoom: true, click: () => go("headboard") }));
      if (!f.napkin) {
        B.nodes.push(box([19, 85.2, 9.5, 8], "napkin", '<img src="' + IMG + 'handkerchief.png" alt="">'));
        B.hs.push(hs([19.5, 86, 8.5, 7], {
          title: "На полу за ножкой кровати что-то белеет.",
          click: () => { give("handkerchief_dry"); f.napkin = true; toast("Сухая салфетка."); refresh(); }
        }));
      }

      // сапог (шаги 3-5)
      B.hs.push(hs([52.3, 73, 12.5, 19.3], {
        title: f.knife ? "Чугунный сапог. Теперь он пуст." : "Тяжёлый чугунный сапог. На боку — звезда и точки.",
        zoom: true, click: () => go("boot")
      }));

      // тумбочка (шаги 10, 25)
      B.hs.push(hs([71.2, 70.8, 14.3, 19], { title: "Тумбочка с двумя ящиками.", zoom: true, click: () => go("nightstand") }));
      B.hs.push(hs([71.5, 66.3, 13.7, 4.7], { title: "Крышка тумбочки.", zoom: true, click: () => go("stains") }));

      if (f.lightOff) {
        B.nodes.push(darkNode([34.5, 27]));
        B.nodes.push(el("abs glint", "left:33%;top:25.4%;width:3.2%;height:4.3%"));
      }
      break;
    }

    /* ============ WALL 1 : окна с птицами, фонограф, холодильник, смеситель ============ */
    case "wall1": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"));

      // окна (шаг 12): левое — столбцы 0-1, правое — столбцы 2-3
      const WIN = [Frame(200, 200, 19, 12, 26), Frame(200, 200, 55, 12, 26)];
      WIN.forEach(w => {
        B.nodes.push(w.svg(artWindow()));
        B.hs.push(hs(w.r(0, 0, 200, 200), {
          title: "Окно."
        }));
      });
      Object.keys(WINDOW_PATTERN).forEach(k => {
        const cell = +k, col = cell % 4, row = Math.floor(cell / 4);
        const w = WIN[col < 2 ? 0 : 1], seat = winSeat(col % 2, row);
        const kind = WINDOW_PATTERN[k], size = kind === "big" ? 5.8 : 3.6;
        B.nodes.push(centered(w.pt(seat[0], seat[1]), size).svg(artButton(kind, kind === "big"), "bird"));
      });

      // фонограф (шаги 8-9)
      const PH = Frame(220, 252, 5, 47, 28);
      B.nodes.push(PH.svg(artPhono(f.phono, S.__spinning)));
      B.hs.push(hs(PH.r(14, 16, 206, 236), {
        title: "Старый фонограф с большим раструбом.", zoom: true, click: () => go("phono")
      }));
      if (f.phono && !f.tea) {
        const bell = PH.pt(PHONO_BELL[0], PHONO_BELL[1]);
        const pk = Frame(60, 70, 31, 85.2, 3.4);
        const node = pk.svg(artTea(), f.teaFell ? "" : "dropz");
        if (!f.teaFell) { node.style.setProperty("--sx", (bell[0] - 1.7) + "%"); node.style.setProperty("--sy", (bell[1] - 2) + "%"); }
        B.nodes.push(node);
        if (f.teaFell) B.hs.push(hs(pk.r(0, 0, 60, 70), {
          title: "Пачка чая «Золотой лепесток».", click: () => { give("tea"); f.tea = true; toast("Чай «Золотой лепесток»."); refresh(); }
        }));
      }

      // холодильник + смеситель сверху (шаги 6-7, 17)
      const FR = Frame(150, 200, 76, 59.5, 16);
      B.nodes.push(FR.svg(artFridge(f.fridgeOpen)));
      B.hs.push(hs(FR.r(12, 14, 126, 170), {
        title: f.fridgeOpen ? "Мини-холодильник открыт." : "Мини-холодильник с кодовым замком.", zoom: true, click: () => go("fridge")
      }));
      const MX = Frame(100, 150, 79.5, 43.7, 9);
      B.nodes.push(MX.svg(artMixer({ glass: f.mixGlass, done: f.mixDone, mixing: S.__mixing })));
      B.hs.push(hs(MX.r(8, 6, 84, 142), { title: "Смеситель.", zoom: true, click: () => go("mixer") }));

      if (f.lightOff) B.nodes.push(darkNode());
      break;
    }

    /* ============ WALL 2 : зеркало/дверь, портрет-подсказка, пустая рама, выключатель ============ */
    case "wall2": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"));

      // портрет-подсказка (шаг 27)
      const PT = Frame(100, 130, 69, 17, 14);
      B.nodes.push(PT.svg(artPortrait()));
      B.hs.push(hs(PT.r(3, 3, 94, 124), { title: "Портрет Вари.", zoom: true, click: () => go("portrait") }));

      // пустая рама для карты (шаг 30)
      const EF = Frame(160, 130, 13, 18, 18);
      B.nodes.push(EF.svg('<rect class="o" x="3" y="3" width="154" height="124" fill="' + PAL.maroon + '"/>' +
        '<rect class="o" x="16" y="16" width="128" height="98" fill="' + (f.mapHung ? "#cfe0e0" : PAL.gold) + '"/>' +
        (f.mapHung ? '<svg x="16" y="16" width="128" height="98" viewBox="0 0 300 200" preserveAspectRatio="none">' + artMap([]) + "</svg>" : "")));
      B.hs.push(hs(EF.r(3, 3, 154, 124), {
        title: f.mapHung ? "Карта мира в раме." : "Пустая рама.", zoom: f.mapHung,
        click: () => { if (f.mapHung) go("map"); },
        use: it => {
          if (it === "map" && !f.mapHung) { hangMap(); return true; }
          if (f.mapHung) { go("map"); return "keep"; }
          return false;
        }
      }));

      // зеркало → дверь (шаги 27-30)
      if (!f.mirrorDoor) {
        const MR = Frame(120, 160, 33, 16, 34);
        B.nodes.push(MR.svg(artMirror(artVarya({ bruise: f.mirrorReset && !f.hole, hole: f.hole, map: f.hole && !f.map }))));
        B.hs.push(hs(MR.r(8, 6, 104, 146), {
          title: "Большое зеркало. В нём — Варя.", zoom: true, click: () => go("mirror")
        }));
      } else {
        const DR = Frame(100, 238, 37.5, 8, 25);
        B.nodes.push(DR.svg(artDoor(f.doorOpen), f.doorOpen ? "door-open" : ""));
        if (!f.doorOpen) B.hs.push(hs(DR.r(4, 4, 92, 232), {
          title: "На месте зеркала — дверь.", click: () => openDoor()
        }));
      }

      if (f.lightOff) B.nodes.push(darkNode());

      // выключатель (шаги 32-33) — остаётся видимым в темноте
      const SW = Frame(60, 90, 88, 46, 4.6);
      B.nodes.push(SW.svg(artSwitch(f.switchFixed, !f.lightOff)));
      B.hs.push(hs(SW.r(6, 4, 48, 82), {
        title: f.switchFixed ? "Выключатель." : "Сломанный выключатель — нет клавиши.",
        click: () => f.switchFixed ? toggleLight() : go("switch"), zoom: !f.switchFixed,
        use: switchUse
      }));
      break;
    }

    /* ============ WALL 3 : стол с таблицей, прожектор ============ */
    case "wall3": {
      B.nav = true;
      B.layers.push(layerImg("room_bg.png"));

      const TB = Frame(260, 170, 24, 52, 42);
      B.nodes.push(TB.svg(artTable()));
      B.hs.push(hs(TB.r(10, 50, 240, 120), { title: "Стол. На нём таблица с фишками и листок.", zoom: true, click: () => go("table") }));

      const PR = Frame(200, 120, 62, 8, 24);
      B.nodes.push(PR.svg(artProjector(f.projectorWired, f.projectorOpen, !f.key)));
      B.hs.push(hs(PR.r(10, 20, 186, 96), {
        title: f.projectorWired ? "Прожектор." : "Сломанный прожектор — оборван провод.", zoom: true, click: () => go("projector")
      }));

      if (f.lightOff) B.nodes.push(darkNode());
      break;
    }

    /* ============ ZOOM: плакат (Морзе) ============ */
    case "poster": {
      B.layers.push(layerImg("poster_zoom.png"));
      break;
    }

    /* ============ ZOOM: сапог (шаги 3-5) ============ */
    case "boot": {
      const fill = S.bootFill;
      B.layers.push(layerImg(fill === "yellow" ? "boot_yellow.png" : fill === "brown" ? "boot_brown.png" : "boot_empty.png"));

      // сапог: сбросить жижу
      B.hs.push(hs([28, 30, 34, 42], {
        title: "Сапог.",
        click: () => {
          if (S.morseInput.length && !f.morse && !S.lock) { S.morseInput = []; S.bootFill = null; toast("Вылили всё из сапога."); refresh(); }
        }
      }));

      // нож на дне
      if (f.morse && !f.knife) {
        const KN = Frame(172, 40, 38.5, 47, 22);
        B.nodes.push(KN.svg(artKnife(), "knife"));
        B.hs.push(hs(KN.r(0, 0, 172, 40), { title: "На дне сапога лежит нож.", click: () => { give("knife"); f.knife = true; toast("Нож."); refresh(); } }));
      }

      // банки
      B.hs.push(hs([71.5, 23.3, 20.3, 27.3], {
        title: "Банка с жёлтой жижей (точка).", circle: true,
        click: () => f.morse ? toast("Банка пуста.") : morseTap("dot")
      }));
      B.hs.push(hs([53.3, 2.7, 20.5, 27.7], {
        title: "Банка с коричневой жижей (тире).", circle: true,
        click: () => f.morse ? toast("Банка пуста.") : morseTap("dash")
      }));

      // что уже залито: точки и тире
      if (!f.morse && S.morseInput.length) {
        B.nodes.push(el("abs pips", "left:4%;top:88%", S.morseInput.map(s => '<i class="' + (s === "dot" ? "dot" : "dash") + '"></i>').join("")));
      }
      break;
    }

    /* ============ ZOOM: тумбочка и ящик (шаги 6, 10) ============ */
    case "nightstand": {
      B.layers.push(layerImg(f.drawerOpen ? "nightstand_zoom_open.png" : "nightstand_zoom.png"));
      B.hs.push(hs([15.8, 18.5, 68.4, 48.3], { title: "Крышка тумбочки.", zoom: true, click: () => go("stains") }));
      if (!f.drawerOpen) {
        B.hs.push(hs([17, 67.5, 66, 16.5], { title: "Верхний ящик.", click: say("Верхний ящик не поддаётся.") }));
        B.hs.push(hs([18.5, 85, 63, 15], {
          title: "Нижний ящик.", click: () => { f.drawerOpen = true; Audio2.thud(); toast("Ящик выдвинут."); refresh(); }
        }));
      } else if (!f.bulb) {
        const BL = Frame(60, 64, 41, 84, 11);
        B.nodes.push(BL.svg(artBulb()));
        B.hs.push(hs(BL.r(0, 0, 60, 64), {
          title: "В ящике лежит сморщенная луковица.",
          click: () => { give("bulb"); f.bulb = true; toast("Луковица мистического цветка — орхидеи."); refresh(); }
        }));
      }
      break;
    }

    /* ============ ZOOM: крышка тумбочки — пятна, механизм, фото (шаги 25-26) ============ */
    case "stains": {
      B.layers.push(layerImg(f.drawerOpen ? "nightstand_zoom_open.png" : "nightstand_zoom.png"));
      if (!f.stains) {
        STAIN_ORDER.forEach(c => {
          if (S.stainInput.includes(c)) return;                    // уже стёрто
          B.nodes.push(layerImg("stain_" + c + ".png"));
        });
        Object.keys(STAIN_POS).forEach(c => {
          if (S.stainInput.includes(c)) return;
          const p = STAIN_POS[c];
          B.hs.push(hs([p[0] * 100 - 6, p[1] * 100 - 7.5, 12, 15], {
            title: "Тёмное въевшееся пятно.", circle: true,
            use: it => {
              if (it === "handkerchief_wet") { stainTap(c); return "keep"; }
              if (it === "handkerchief_dry") { toast("Пятно не поддаётся."); return "keep"; }
              return false;
            }
          }));
        });
      } else {
        B.nodes.push(el("abs latch", "left:38%;top:27%;width:24%;height:27%",
          '<div class="latch-in"></div>'));
        if (!f.photo) {
          const PH = Frame(60, 50, 41.5, 31, 17);
          B.nodes.push(PH.svg(artPhoto()));
          B.hs.push(hs(PH.r(0, 0, 60, 50), {
            title: "В потайном механизме лежит фотография.",
            click: () => { give("photo"); f.photo = true; toast("Фотография."); refresh(); }
          }));
        }
      }
      break;
    }

    /* ============ ZOOM: изголовье — подсказка (шаг 24) ============ */
    case "headboard": {
      backdrop(B);
      const C = cropBox("bed_zoom.png", 0, 0.33, 0, 33.5, 100);
      B.nodes.push(C);
      break;
    }

    /* ============ ZOOM: кровать — одеяло с бусинами / матрас с зайчиком (шаги 13-16) ============ */
    case "quilt": {
      backdrop(B);
      if (!f.quilt) {
        const C = cropBox("bed_zoom.png", 0.557, 1, 0, 20, 100);
        B.nodes.push(C);
        const hfH = 3.01;                                   // отношение высоты полосы к ширине в пикселях
        const colEdge = [0, 21, 48, 74, 100], rowEdge = [0, 60.1, 100];
        const cx = [8.75, 33.75, 60.25, 87, 9.75, 32.75, 60.75, 88.25];
        const cy = [1075, 1075, 1112, 1068, 1405, 1400, 1425, 1372].map(y => (y / 1500 - 0.557) / 0.443 * 100);
        for (let i = 0; i < 8; i++) {
          const c = i % 4, r = Math.floor(i / 4);
          const cell = el("qcell", "left:" + colEdge[c] + "%;top:" + rowEdge[r] + "%;width:" + (colEdge[c + 1] - colEdge[c]) + "%;height:" + (rowEdge[r + 1] - rowEdge[r]) + "%");
          cell.dataset.drop = ""; cell.dataset.cell = i;
          cell.addEventListener("click", () => { if (!S.lock && S.quiltBeads[i]) { delete S.quiltBeads[i]; Audio2.click(); quiltChanged(); } });
          C.appendChild(cell);
        }
        Object.keys(S.quiltBeads).forEach(k => {
          const i = +k, kind = S.quiltBeads[k], bw = kind === "big" ? 9 : 5.6, bh = bw * hfH;
          const b = el("bead placed " + kind, "left:" + (cx[i] - bw / 2) + "%;top:" + (cy[i] - bh / 2) + "%;width:" + bw + "%;height:" + bh + "%", beadSVG(kind));
          makeDrag(b, {
            onTap: () => { delete S.quiltBeads[i]; Audio2.click(); quiltChanged(); },
            onDrop: t => {
              delete S.quiltBeads[i];
              if (t && t.dataset.cell !== undefined) S.quiltBeads[+t.dataset.cell] = kind;
              quiltChanged();
            }
          });
          C.appendChild(b);
        });
        // лоток с бусинами
        const tray = el("abs tray", "left:22%;top:72%;width:56%;height:20%");
        ["big", "small"].forEach(kind => {
          const b = el("bead tray-bead " + kind, "", beadSVG(kind));
          makeDrag(b, {
            onDrop: t => { if (t && t.dataset.cell !== undefined) { S.quiltBeads[+t.dataset.cell] = kind; quiltChanged(); } }
          });
          tray.appendChild(b);
        });
        B.nodes.push(tray);
      } else {
        const C = cropBox("bed_zoom_open.png", 0.34, 1, 0, 17, 100);
        B.nodes.push(C);
        if (S.__lift) { const L = cropBox("bed_zoom.png", 0.557, 1, 0, 20, 100); L.classList.add("liftoff"); B.nodes.push(L); }
        if (!f.heart) {
          const bunny = el("abs bunny", "left:38%;top:22%;width:24%;height:62%", svgWrap("0 0 100 128", artBunny(S.__cutting)));
          if (S.__cutting) bunny.insertAdjacentHTML("beforeend", '<svg class="slashfx" viewBox="0 0 100 100" preserveAspectRatio="none">' + artSlash() + "</svg>");
          C.appendChild(bunny);
          C.appendChild(hotspot({
            r: [38, 22, 24, 62], title: "Тряпичный зайчик.",
            use: it => { if (it === "knife") { cutBunny(); return true; } return false; }
          }));
        }
      }
      break;
    }

    /* ============ ZOOM: горшок и цветок (шаги 11, 18-21) ============ */
    case "pot": {
      backdrop(B);
      const PF = Frame(100, 150, 30, 6, 40);
      const plant = PF.svg(artPlant({ planted: f.planted, grown: f.grown, cut: f.cut, broken: f.brokenOff }), S.__justGrew ? "growing" : "");
      B.nodes.push(plant);
      if (!f.planted) {
        B.hs.push(hs(PF.r(20, 96, 60, 50), { title: "Горшок с рыхлой землёй.", use: potUse }));
      } else if (!f.grown) {
        B.hs.push(hs(PF.r(20, 70, 60, 76), { title: "Росток.", use: potUse }));
      } else if (!f.cut) {
        B.hs.push(hs(PF.r(8, 8, 84, 138), { title: "Цветок.", use: potUse }));
      } else if (!f.brokenOff) {
        B.hs.push(hs(PF.r(8, 8, 84, 138), { title: "Надрезанный цветок.", click: breakFlower, use: potUse }));
      } else {
        const p = PF.pt(50, 68);
        if (!f.sap) {
          B.nodes.push(el("abs sap", "left:" + (p[0] - 3) + "%;top:" + (p[1] - 1) + "%;width:6%;height:20%",
            '<svg viewBox="0 0 40 120" preserveAspectRatio="none"><path class="o" d="M20 2 Q30 30 28 60 Q34 100 20 116 Q6 100 12 60 Q10 30 20 2 Z" fill="#9ccf4a"/><ellipse cx="16" cy="40" rx="3" ry="10" fill="#d8f08a" opacity=".8"/></svg>'));
          B.hs.push(hs([p[0] - 6, p[1] - 2, 12, 24], { title: "Капающий сок.", use: potUse }));
        }
      }
      break;
    }

    /* ============ ZOOM: холодильник (шаги 6-7) ============ */
    case "fridge": {
      backdrop(B);
      if (!f.fridgeOpen) {
        const FZ = Frame(150, 200, 28, 6, 44);
        B.nodes.push(FZ.svg(artFridge(false) + artFridgeLock()));
        for (let i = 0; i < 4; i++) {
          const x = FRIDGE_LOCK.x + 3.5 + i * 21.5, y = FRIDGE_LOCK.y;
          B.nodes.push(box(FZ.r(x, y + 3, 19, 26), "letter", ALPHABET[S.fridgeCode[i]]));
          const up = hs(FZ.r(x, y - 12, 19, 12), { title: "Дальше по алфавиту", click: () => fridgeTurn(i, 1) });
          up.textContent = "▲"; up.classList.add("arrow");
          const dn = hs(FZ.r(x, y + FRIDGE_LOCK.h, 19, 12), { title: "Назад по алфавиту", click: () => fridgeTurn(i, -1) });
          dn.textContent = "▼"; dn.classList.add("arrow");
          B.hs.push(up, dn);
        }
        B.hs.push(hs(FZ.r(12, 70, 126, 114), { title: "Дверца мини-холодильника.", click: say("Дверца не открывается.") }));
      } else {
        const FI = Frame(300, 240, 14, 8, 72);
        B.nodes.push(FI.svg(artFridgeInside({ ice: f.ice, glass: f.glass, aniline: f.aniline })));
        if (!f.ice) B.hs.push(hs(FI.r.apply(null, FRIDGE_IN.ice), { title: "Кусочки льда.", click: () => { give("ice"); f.ice = true; toast("Кусочки льда."); refresh(); } }));
        if (!f.glass) B.hs.push(hs(FI.r.apply(null, FRIDGE_IN.glass), { title: "Пустой гранёный стакан.", click: () => { give("glass_empty"); f.glass = true; toast("Пустой стакан."); refresh(); } }));
        B.hs.push(hs(FI.r.apply(null, FRIDGE_IN.meat), {
          title: f.aniline ? "Кусок мяса. Налёт соскоблен." : "Кусок красного мяса, покрытый странным химическим налётом.",
          use: meatUse
        }));
      }
      break;
    }

    /* ============ ZOOM: фонограф (шаги 8-9) ============ */
    case "phono": {
      backdrop(B);
      const PZ = Frame(220, 252, 25, 8, 50);
      B.nodes.push(PZ.svg(artPhono(f.phono, S.lock && f.phono && !f.teaFell)));
      if (!f.phono) {
        B.hs.push(hs(PZ.r(40, 100, 82, 34), {
          title: "Люлька для валика.",
          use: it => { if (it === "roller") { rollerIn(); return true; } return false; }
        }));
      } else if (!f.tea) {
        const bell = PZ.pt(PHONO_BELL[0], PHONO_BELL[1]), rest = PZ.pt(176, 168);
        const pk = Frame(60, 70, rest[0] - 3, rest[1] - 4, 6);
        const node = pk.svg(artTea(), f.teaFell ? "" : "dropz");
        if (!f.teaFell) { node.style.setProperty("--sx", (bell[0] - 3) + "%"); node.style.setProperty("--sy", (bell[1] - 4) + "%"); }
        B.nodes.push(node);
        if (f.teaFell) B.hs.push(hs(pk.r(0, 0, 60, 70), {
          title: "Пачка чая «Золотой лепесток».", click: () => { give("tea"); f.tea = true; toast("Чай «Золотой лепесток»."); refresh(); }
        }));
      }
      break;
    }

    /* ============ ZOOM: смеситель (шаг 17) ============ */
    case "mixer": {
      backdrop(B);
      const MZ = Frame(100, 150, 34, 6, 32);
      B.nodes.push(MZ.svg(artMixer({ glass: f.mixGlass, done: f.mixDone, mixing: S.__mixing })));
      B.hs.push(hs(MZ.r(8, 6, 84, 142), {
        title: "Смеситель.", use: mixerUse
      }));
      if (f.mixGlass) B.hs.push(hs(MZ.r(26, 30, 48, 72), {
        title: f.mixDone ? "Стакан с питательной смесью." : "Стакан в смесителе.", use: mixerUse, click: mixerGlassClick
      }));
      break;
    }

    /* ============ ZOOM: зеркало (шаги 27-30) ============ */
    case "mirror": {
      backdrop(B);
      const st = f.mirrorStage, reset = f.mirrorReset;
      const o = {
        bruise: reset && !f.hole, hole: reset && f.hole, map: reset && f.hole && !f.map,
        cracks: st === 1 || st === 2,
        niche: !reset && st >= 2, pieces: !reset && st === 3 && !f.puzzle, shardFall: !reset && st === 2,
      };
      const MZ = Frame(120, 160, 28, 4, 44);
      B.nodes.push(MZ.svg(artMirror(artVarya(o)), "mirror-zoom"));
      const R = mirrorPt(VARYA_EAR_R), L = mirrorPt(VARYA_EAR_L), K = mirrorPt(VARYA_CHEEK);
      if (st === 0 || reset) {
        B.hs.push(hs(MZ.r(R[0] - 7, R[1] - 9, 13, 18), {
          title: "Правое ухо Вари.",
          use: it => { if (it === "broken_flower" && !reset) { flowerOnEar(); return true; } return false; }
        }));
        B.hs.push(hs(MZ.r(L[0] - 7, L[1] - 9, 13, 18), {
          title: "Левое ухо Вари.",
          use: it => { if (it === "broken_flower" && !reset) { toast("Цветок соскальзывает."); return "keep"; } return false; }
        }));
      }
      if (reset && !f.map) {
        B.hs.push(hs(MZ.r(K[0] - 8, K[1] - 7, 16, 14), {
          title: f.hole ? "Дыра в щеке. Оттуда торчит карта." : "Синяк на щеке Вари.", circle: true,
          click: () => { if (f.hole) { give("map"); f.map = true; toast("Географическая карта."); refresh(); } },
          use: bruiseUse
        }));
      }
      if (st === 3 && !f.puzzle) {
        const P = mirrorPt([14, 124]);
        B.hs.push(hs(MZ.r(P[0] - 11, P[1] - 7, 24, 18), {
          title: "В нише лежат кусочки цветка-пазла.",
          click: () => { give("puzzle"); f.puzzle = true; toast("Кусочки цветка-пазла."); refresh(); }
        }));
      }
      break;
    }

    /* ============ ZOOM: портрет-подсказка (шаг 27) ============ */
    case "portrait": {
      backdrop(B);
      const PV = Frame(100, 130, 30, 7, 40);
      B.nodes.push(PV.svg(artPortrait()));
      B.hs.push(hs(PV.r(10, 10, 80, 110), { title: "Портрет Вари." }));
      break;
    }

    /* ============ ZOOM: стол с фишками (шаг 31) ============ */
    case "table": {
      backdrop(B);
      B.nodes.push(el("abs tboard", "left:5%;top:9%;width:60%;height:72%"));
      const grid = el("abs tgrid", "left:7%;top:12%;width:56%;height:66%");
      grid.appendChild(el("", "", ""));
      [1, 2, 3, 4].forEach(n => grid.appendChild(el("thead", "", String(n))));
      TABLE_ROWS.forEach(row => {
        grid.appendChild(el("rlabel", "", "<b>" + row.glyph + "</b><span>" + row.label + "</span>"));
        for (let c = 1; c <= 4; c++) {
          const cell = el("tcell", "");
          cell.dataset.drop = ""; cell.dataset.row = row.id; cell.dataset.col = c;
          cell.addEventListener("click", () => tableMove(row.id, c));
          if (S.tablePos[row.id] === c) {
            const chip = el("chip", "background:" + row.color, row.glyph);
            makeDrag(chip, { onDrop: t => { if (t && t.dataset.row === row.id) tableMove(row.id, +t.dataset.col); } });
            cell.appendChild(chip);
          }
          grid.appendChild(cell);
        }
      });
      B.nodes.push(grid);
      const note = el("abs note" + (S.__crumple ? " crumple" : ""), "left:68%;top:14%;width:26%;height:46%", "<p>" + TABLE_NOTE + "</p>");
      if (f.noteDone && !f.wire) {
        const WR = Frame(60, 50, 74, 44, 14);
        B.nodes.push(note, WR.svg(artWire()));
        B.hs.push(hs(WR.r(0, 0, 60, 50), { title: "На листке лежит провод.", click: () => { give("wire"); f.wire = true; toast("Провод."); refresh(); } }));
      } else B.nodes.push(note);
      break;
    }

    /* ============ ZOOM: прожектор (шаг 32) ============ */
    case "projector": {
      backdrop(B);
      const PZ = Frame(200, 120, 20, 14, 60);
      B.nodes.push(PZ.svg(artProjector(f.projectorWired, f.projectorOpen, !f.key)));
      B.hs.push(hs(PZ.r(10, 20, 186, 96), {
        title: "Прожектор.", use: projectorUse
      }));
      if (f.projectorWired && !f.projectorOpen) {
        B.hs.push(hs(PZ.r.apply(null, PROJ_HATCH), { title: "Люк на корпусе.", click: () => { f.projectorOpen = true; Audio2.thud(); toast("Люк открылся."); refresh(); } }));
      } else if (f.projectorOpen && !f.key) {
        B.hs.push(hs(PZ.r(PROJ_HATCH[0] + 6, PROJ_HATCH[1] + 8, 38, 26), { title: "Клавиша.", click: () => { give("key"); f.key = true; toast("Клавиша."); refresh(); } }));
      }
      break;
    }

    /* ============ ZOOM: выключатель (шаг 33) ============ */
    case "switch": {
      backdrop(B);
      const SZ = Frame(60, 90, 38, 8, 24);
      B.nodes.push(SZ.svg(artSwitch(f.switchFixed, !f.lightOff)));
      B.hs.push(hs(SZ.r(6, 4, 48, 82), {
        title: "Сломанный выключатель.", use: switchUse,
        click: () => { if (f.switchFixed) toggleLight(); }
      }));
      break;
    }

    /* ============ ZOOM: карта мира (шаг 34) ============ */
    case "map": {
      backdrop(B);
      B.nodes.push(MAP_FRAME.svg(artMap(S.pinMarks), "map-art"));
      B.hs.push(hs(MAP_FRAME.r(0, 0, 300, 200), {
        title: "Карта мира.", use: mapUse
      }));
      break;
    }
  }
  return B;
}

/* =========================================================================
   ФИНАЛЬНАЯ СЦЕНА — рука из карты, полёт Вари вверх мимо предметов комнаты
   (всё — плейсхолдеры; спрайты заменяются в этих нескольких строках)
   ========================================================================= */
function cineHTML(px, py) {
  const p = MAP_FRAME.pt(px * 300, py * 200);
  const item = (sprite, left, dur, delay, rot) => {
    sprite.classList.add("fl-item");
    sprite.style.cssText += ";left:" + left + "%;--d:" + dur + "s;--dl:" + delay + "s;--r:" + rot + "deg";
    return sprite.outerHTML;
  };
  const flight =
    '<div class="c-flight"><div class="fl-bg" style="background-image:url(' + IMG + 'wall_bed.png)"></div>' +
    item(spriteDiv("bed.png", BBOX.bed, 28), 3, 5.5, 0.2, -6) +
    item(spriteDiv("nightstand.png", BBOX.nightstand, 15), 78, 5, 0.9, 5) +
    item(spriteDiv("painting.png", BBOX.painting, 10), 68, 6, 2.2, -4) +
    item(spriteDiv("handkerchief.png", BBOX.napkin, 11), 14, 5, 3.3, 8) +
    '<div class="c-beam"></div></div>';
  return '<div class="c-tear" style="left:' + p[0] + "%;top:" + p[1] + '%"></div>' +
    '<div class="c-hand" style="left:' + p[0] + "%;top:" + p[1] + '%"><svg viewBox="0 0 60 220">' + artHand() + "</svg></div>" +
    flight +
    '<div class="c-light"></div>' +
    '<div class="c-varya"><svg viewBox="0 0 60 130">' + artVaryaFull() + "</svg></div>" +
    '<div class="c-white"></div>';
}

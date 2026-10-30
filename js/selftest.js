"use strict";
/* =============================================================================
   АВТОТЕСТ — полное прохождение сценария (34 шага) через настоящие клики по зонам
   сцены и настоящее перетаскивание бусин. Запускается из main.js по ?selftest.
   Рисует отчёт поверх страницы и ставит document.title = SELFTEST PASS / FAIL.
   ============================================================================= */
async function selfTest() {
  window.__FAST = true;
  const log = []; let ok = true;
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const step = async (name, fn) => {
    try { await fn(); log.push("✓ " + name); }
    catch (e) { ok = false; log.push("✗ " + name + " — " + e.message); }
  };

  const nodes = () => [...document.querySelectorAll("#scene .hs")];
  const view = v => { S.view = v; if (WALLS.includes(v)) S.wallIndex = WALLS.indexOf(v); refresh(); };
  const find = t => { const n = nodes().find(d => d.dataset.name.toLowerCase().includes(t.toLowerCase())); if (!n) throw new Error("нет зоны «" + t + "» в виде " + S.view); return n; };
  const press = (n, fx, fy) => {
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + r.width * (fx === undefined ? .5 : fx), clientY: r.top + r.height * (fy === undefined ? .5 : fy) }));
  };
  const click = (v, t) => { view(v); press(find(t)); };
  const useOn = (v, t, item, fx, fy) => {
    assert(has(item), "в инвентаре нет «" + item + "»");
    view(v); S.selected = item;
    try { press(find(t), fx, fy); } finally { S.selected = null; }     // не оставлять предмет «в руке» при ошибке
  };
  const idle = async () => { for (let i = 0; i < 800 && S.lock; i++) await new Promise(r => setTimeout(r, 5)); assert(!S.lock, "анимация зависла"); };
  const tick = () => new Promise(r => setTimeout(r, 20));
  const drag = async (src, dst) => {
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    const ev = (type, x, y) => new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1 });
    src.dispatchEvent(ev("pointerdown", a.left + a.width / 2, a.top + a.height / 2));
    window.dispatchEvent(ev("pointermove", a.left + 40, a.top + 40));
    window.dispatchEvent(ev("pointermove", b.left + b.width / 2, b.top + b.height / 2));
    window.dispatchEvent(ev("pointerup", b.left + b.width / 2, b.top + b.height / 2));
    await tick();
  };

  $("#startScreen").classList.add("hidden");

  /* ---- 1-5. плакат, Морзе, нож ---- */
  await step("2. плакат с кодом открывается", () => { click("wall0", "Плакат"); });
  await step("3-4. Морзе: неверный ввод → жижа стекает", async () => {
    view("boot"); press(find("жёлтой")); press(find("жёлтой")); await idle();
    assert(S.morseInput.length === 0 && !S.bootFill && !S.f.morse, "после ошибки сапог не очистился");
  });
  await step("4. Морзе: верный ввод (— · · — · —)", async () => {
    for (const s of MORSE) { view("boot"); press(find(s === "dot" ? "жёлтой" : "коричневой")); await idle(); }
    assert(S.f.morse, "Морзе не принято");
  });
  await step("5. нож на дне сапога", () => { click("boot", "нож"); assert(has("knife"), "нет ножа"); });

  /* ---- 10, 6. ящик (код ДИТЯ) → холодильник ---- */
  await step("10. нижний ящик → луковица", () => {
    click("nightstand", "Нижний ящик"); assert(S.f.drawerOpen, "ящик не открылся");
    click("nightstand", "луковица"); assert(has("bulb"), "нет луковицы");
  });
  await step("6. холодильник: неверный код не открывает; ДИТЯ → лёд и стакан", () => {
    view("fridge");
    press(nodes().filter(n => n.dataset.name === "Дальше по алфавиту")[0]);
    assert(!S.f.fridgeOpen && fridgeWord() === "БААА", "неверный код не должен открывать, код: " + fridgeWord());
    for (let i = 0; i < 4; i++) {
      for (let guard = 0; guard < 40 && ALPHABET[S.fridgeCode[i]] !== FRIDGE_CODE[i]; guard++) {
        view("fridge"); press(nodes().filter(n => n.dataset.name === "Дальше по алфавиту")[i]);
      }
    }
    assert(S.f.fridgeOpen, "замок не открылся, код: " + fridgeWord());
    click("fridge", "Кусочки льда"); click("fridge", "стакан");
    assert(has("ice") && has("glass_empty"), "нет льда/стакана");
  });
  await step("7. нож → мясо → анилин", () => { useOn("fridge", "мяса", "knife"); assert(has("aniline"), "нет анилина"); });

  /* ---- 8-9. валик → фонограф → чай ---- */
  await step("8. валик с полки", () => { click("wall0", "валик"); assert(has("roller"), "нет валика"); });
  await step("8-9. валик → фонограф → чай выпадает из трубы", async () => {
    useOn("phono", "люлька", "roller"); await idle();
    assert(S.f.phono && S.f.teaFell, "чай не выпал");
    click("phono", "чая"); assert(has("tea"), "нет чая");
  });

  /* ---- 11. посадка ---- */
  await step("11. луковица → горшок на полке", () => { useOn("pot", "Горшок с рыхлой", "bulb"); assert(S.f.planted, "не посажена"); });

  /* ---- 12-15. птицы → бусины → одеяло → зайчик (остаётся на месте) ---- */
  await step("12. окна: птицы (большие) и яйца (маленькие) нарисованы", () => {
    view("wall1");
    assert(document.querySelectorAll("#scene .bird").length === Object.keys(WINDOW_PATTERN).length, "число птиц/яиц не совпало");
  });
  await step("14. бусины: неверная раскладка не засчитывается", async () => {
    view("quilt");
    await drag(document.querySelector(".tray-bead.big"), document.querySelector('.qcell[data-cell="0"]'));
    assert(S.quiltBeads[0] === "big" && !S.f.quilt, "перетаскивание не сработало");
    // вернуть бусину перетаскиванием за пределы
    await drag(document.querySelector(".bead.placed"), document.querySelector(".tray"));
    assert(!S.quiltBeads[0], "бусина не убралась");
  });
  await step("14. бусины: перетаскиваем по рисунку окон → одеяло поднимается", async () => {
    for (const k of Object.keys(WINDOW_PATTERN)) {
      view("quilt");
      await drag(document.querySelector(".tray-bead." + WINDOW_PATTERN[k]), document.querySelector('.qcell[data-cell="' + k + '"]'));
      await idle();
    }
    assert(S.f.quilt, "одеяло не поднялось");
  });
  await step("15. зайчик остаётся на месте (не в инвентаре)", () => {
    view("quilt"); assert(!has("toy") && document.querySelector("#scene .bunny"), "зайчика нет на матрасе");
    press(find("зайчик")); assert(!S.f.heart && !has("heart"), "зайчик не должен браться руками");
  });
  await step("16. нож → зайчик → сердце", async () => { useOn("quilt", "зайчик", "knife"); await idle(); assert(has("heart") && S.f.heart, "нет сердца"); });

  /* ---- 17. смеситель ---- */
  await step("17. смеситель: стакан → любые предметы (неверные возвращаются)", async () => {
    useOn("mixer", "Смеситель", "glass_empty"); assert(S.f.mixGlass && !has("glass_empty"), "стакан не встал");
    useOn("mixer", "Смеситель", "knife"); assert(has("knife") && !S.f.mix.heart, "нож должен вернуться");
    useOn("mixer", "Смеситель", "ice"); assert(has("ice"), "лёд должен вернуться");
    useOn("mixer", "Смеситель", "heart"); useOn("mixer", "Смеситель", "aniline");
    assert(!S.f.mixDone, "рано готово");
    useOn("mixer", "Смеситель", "tea"); await idle();
    assert(S.f.mixDone && !has("heart") && !has("aniline") && !has("tea"), "смесь не готова");
    click("mixer", "Стакан с питательной"); assert(has("glass_mix"), "нет стакана со смесью");
  });

  /* ---- 18-21. рост → надрез → сок ---- */
  await step("18. смесь → горшок: цветок вырос, стакан снова пуст", () => {
    useOn("pot", "росток", "glass_mix"); assert(S.f.grown && has("glass_empty") && !has("glass_mix"), "цветок не вырос");
  });
  await step("19. нож → надрез", () => { useOn("pot", "Цветок.", "knife"); assert(S.f.cut, "нет надреза"); });
  await step("20. рука: отломить верхушку → капает сок", () => { click("pot", "Надрезанный"); assert(has("broken_flower") && S.f.brokenOff, "не отломилось"); });
  await step("21. пустой стакан → сок", () => { useOn("pot", "сок", "glass_empty"); assert(has("glass_sap"), "нет сока"); });

  /* ---- 22-23. салфетка ---- */
  await step("22. сухая салфетка за ножками кровати", () => { click("wall0", "белеет"); assert(has("handkerchief_dry"), "нет салфетки"); });
  await step("23. салфетка + стакан с соком → мокрая", () => { tryCombine("glass_sap", "handkerchief_dry"); assert(has("handkerchief_wet") && !has("handkerchief_dry"), "не намокла"); });

  /* ---- 24-26. изголовье → пятна → фото ---- */
  await step("24. изголовье: подсказка (человечки в порядке красный → синий → зелёный → бирюзовый → жёлтый)", async () => {
    view("wall0"); press(find("Изголовье")); await new Promise(r => setTimeout(r, 40));
    assert(S.view === "headboard" && S.f.headboard, "изголовье не открылось");
  });
  await step("26. пятна: сухая салфетка не берёт, ошибка → все восстанавливаются", () => {
    view("stains"); S.stainInput = [];
    S.selected = "handkerchief_dry"; press(find("пятно")); S.selected = null;     // сухая (уже потрачена — проверяем только реакцию зоны)
    assert(S.stainInput.length === 0, "сухая салфетка не должна стирать");
    stainTap(STAIN_ORDER[0]); assert(S.stainInput.length === 1, "первое пятно не стёрлось");
    stainTap(STAIN_ORDER[2]);                       // пропуск → ошибка
    assert(S.stainInput.length === 0 && !S.f.stains, "после ошибки пятна не восстановились");
  });
  await step("26. пятна: верный порядок (по цветам человечков слева направо)", () => {
    view("stains"); S.stainInput = [];
    STAIN_ORDER.forEach(c => stainTap(c));
    assert(S.f.stains && !has("handkerchief_wet"), "пятна не отчищены / салфетка не исчезла");
    click("stains", "фотография"); assert(has("photo"), "нет фотографии");
  });
  await step("26. фото раскрывается в инвентаре", () => {
    const slot = [...document.querySelectorAll("#bar .slot")].find(s => s.title === ITEMS.photo.name);
    assert(slot, "фото нет в панели"); slot.click();
    assert(document.querySelector("#stage .viewer"), "фото не раскрылось");
    document.querySelector("#stage .viewer").click();
  });

  /* ---- 27-30. зеркало ---- */
  await step("27. левое ухо — не то", () => {
    view("mirror"); S.selected = "broken_flower"; press(find("Левое")); select(null);
    assert(S.f.mirrorStage === 0 && has("broken_flower"), "цветок должен остаться");
  });
  await step("28-29. цветок за правое ухо → трещины, осколок, ниша, пазл", async () => {
    useOn("mirror", "Правое", "broken_flower"); await idle();
    assert(S.f.mirrorStage === 3, "стадия зеркала " + S.f.mirrorStage);
    click("mirror", "кусочки"); assert(has("puzzle"), "нет пазла");
  });
  await step("29. выход из зума: зеркало → дверь; открыть → тень → затухание → норма", async () => {
    view("mirror"); go("wall2"); await new Promise(r => setTimeout(r, 40));
    assert(S.f.mirrorDoor, "зеркало не превратилось в дверь");
    click("wall2", "дверь"); await idle();
    assert(S.f.mirrorReset && !S.f.mirrorDoor, "мир не вернулся в норму");
    assert(!document.querySelector(".blackout"), "затемнение не снялось");
  });
  await step("30. лёд на синяк → дыра → карта", () => {
    useOn("mirror", "Синяк", "ice"); assert(S.f.hole && !has("ice"), "нет дыры");
    click("mirror", "Дыра"); assert(has("map"), "нет карты");
  });
  await step("30. карта → пустая рама", () => { useOn("wall2", "Пустая рама", "map"); assert(S.f.mapHung, "карта не повешена"); });

  /* ---- 31. стол ---- */
  await step("31. стол: расставить фишки (кот 2, олень 2, цветок 4, глаз 3)", async () => {
    view("table");
    const cell = (row, col) => document.querySelector('.tcell[data-row="' + row + '"][data-col="' + col + '"]');
    cell("cat", 2).click(); await idle();
    cell("deer", 2).click(); await idle();
    cell("eye", 3).click(); await idle();
    assert(!S.f.tableSolved, "рано решено");
    cell("flower", 4).click(); await idle();
    assert(S.f.tableSolved && S.f.noteDone, "листок не расправился");
    click("table", "провод"); assert(has("wire"), "нет провода");
  });

  /* ---- 33 (негатив). нож по картине без починенного выключателя запрещён ---- */
  await step("33. нож на картину при сломанном выключателе — запрещено", () => {
    useOn("wall0", "Жёлтая картина", "knife"); assert(!S.f.pin && !has("pin"), "нельзя резать до починки выключателя");
  });

  /* ---- 32-33. прожектор → клавиша → выключатель → картина → булавка ---- */
  await step("32. провод → прожектор → люк → клавиша", () => {
    useOn("projector", "Прожектор", "wire"); assert(S.f.projectorWired, "прожектор не починен");
    click("projector", "Люк"); assert(S.f.projectorOpen, "люк не открылся");
    click("projector", "Клавиша"); assert(has("key"), "нет клавиши");
  });
  await step("33. клавиша → выключатель", () => {
    useOn("wall2", "выключатель", "key"); assert(S.f.switchFixed, "выключатель не починен");
  });
  await step("33. при включённом свете нож по картине не работает", () => {
    useOn("wall0", "Жёлтая картина", "knife"); assert(!S.f.pin, "при свете резать нельзя");
  });
  await step("33. свет выключен → нож по картине → булавка", () => {
    click("wall2", "Выключатель"); assert(S.f.lightOff, "свет не выключился");
    assert(document.querySelector("#scene .dark"), "нет затемнения");
    useOn("wall0", "Жёлтая картина", "knife"); assert(S.f.pin && has("pin"), "нет булавки");
  });

  /* ---- 34. булавка в карту ---- */
  await step("34. булавка мимо — ничего не происходит", () => {
    view("map"); S.selected = "pin"; press(find("Карта мира"), .9, .9); select(null);
    assert(!S.f.done && has("pin") && S.pinMarks.length === 1, "неверное место должно быть безопасным");
  });
  await step("34. булавка в нужное место → рука, Варя летит, финал", async () => {
    view("map"); S.selected = "pin";
    press(find("Карта мира"), MAP_TARGET.x, MAP_TARGET.y);
    await idle();
    assert(S.f.done && !$("#endScreen").classList.contains("hidden"), "финал не показан");
  });

  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;inset:0;z-index:99;background:#000;color:" + (ok ? "#7f7" : "#f77") + ";font:13px/1.5 monospace;padding:20px;white-space:pre-wrap;overflow:auto";
  box.textContent = (ok ? "ALL PASS " : "FAIL ") + "\n\n" + log.join("\n");
  document.body.appendChild(box);
  document.title = ok ? "SELFTEST PASS" : "SELFTEST FAIL";
  window.__FAST = false;
}

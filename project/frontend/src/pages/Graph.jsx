import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getGraphData, getPerson, deletePerson } from "../api/api";
import Navbar from "../components/Navbar";
import PersonModal from "../components/PersonModal";
import "../style.css";

// Размеры узла и отступы (в пикселях)
const NODE_W = 150;
const NODE_H = 58;
const H_GAP = 28;
const V_GAP = 90;
const SLOT = NODE_W + H_GAP;

// ─── Построение раскладки дерева ──────────────────────────────────────────

function buildLayout(persons, relations) {
  if (!persons.length) return null;

  // Создаём карту узлов
  const nodes = {};
  persons.forEach((p) => {
    nodes[p.id] = { ...p, parents: [], children: [], spouses: [] };
  });

  const parentChildEdges = [];
  const spouseEdges      = [];
  const seenSpouses      = new Set();

  // Разбираем рёбра на родитель-ребёнок и супружеские
  relations.forEach(({ from_id, to_id, relation_type }) => {
    if (!nodes[from_id] || !nodes[to_id]) return;

    if (relation_type === "father" || relation_type === "mother") {
      // from_id = ребёнок, to_id = родитель
      if (!nodes[from_id].parents.includes(to_id)) nodes[from_id].parents.push(to_id);
      if (!nodes[to_id].children.includes(from_id)) {
        nodes[to_id].children.push(from_id);
        parentChildEdges.push({ parent: to_id, child: from_id });
      }
    } else if (relation_type === "spouse") {
      const key = [from_id, to_id].sort().join("|");
      if (!seenSpouses.has(key)) {
        seenSpouses.add(key);
        spouseEdges.push({ from: from_id, to: to_id });
        if (!nodes[from_id].spouses.includes(to_id)) nodes[from_id].spouses.push(to_id);
        if (!nodes[to_id].spouses.includes(from_id)) nodes[to_id].spouses.push(from_id);
      }
    }
  });

  // Шаг 1: все узлы без родителей начинают с поколения 0
  const genOf = {};
  Object.values(nodes).forEach((n) => {
    if (n.parents.length === 0) genOf[n.id] = 0;
  });

  // Шаг 2: алгоритм Беллмана-Форда (длиннейший путь родитель → ребёнок)
  // Ребёнок размещается НИЖЕ ВСЕХ своих родителей
  let changed = true;
  while (changed) {
    changed = false;
    parentChildEdges.forEach(({ parent, child }) => {
      if (genOf[parent] === undefined) return;
      const proposed = genOf[parent] + 1;
      if ((genOf[child] ?? -1) < proposed) {
        genOf[child] = proposed;
        changed = true;
      }
    });
  }

  // Шаг 3: «вошедшие в династию» супруги получают поколение своего партнёра
  changed = true;
  while (changed) {
    changed = false;
    Object.keys(nodes).forEach((id) => {
      if (nodes[id].parents.length > 0) return;
      const dynastyGens = nodes[id].spouses
        .filter((sid) => nodes[sid].parents.length > 0)
        .map((sid) => genOf[sid])
        .filter((g) => g !== undefined);
      if (!dynastyGens.length) return;
      const target = Math.min(...dynastyGens);
      if (genOf[id] !== target) { genOf[id] = target; changed = true; }
    });
  }

  // Запасной вариант для неприсвоенных
  Object.keys(nodes).forEach((id) => { if (genOf[id] === undefined) genOf[id] = 0; });

  // Шаг 4: группируем по поколениям
  const byGen = {};
  Object.entries(genOf).forEach(([id, g]) => { (byGen[g] = byGen[g] || []).push(id); });
  const maxGen = Math.max(...Object.values(genOf));

  // Вспомогательная функция: средний X-центр уже размещённых родителей
  const pos = {};
  function avgParentX(id) {
    const pp = nodes[id].parents.filter((pid) => pos[pid]);
    if (!pp.length) return null;
    return pp.reduce((s, pid) => s + pos[pid].x + NODE_W / 2, 0) / pp.length - NODE_W / 2;
  }

  // Шаг 5: размещение сверху вниз
  for (let g = 0; g <= maxGen; g++) {
    const ids = byGen[g] || [];

    // Сортируем по средней позиции родителей, иначе по году рождения
    ids.sort((a, b) => {
      const ax = avgParentX(a) ?? (nodes[a].birth_year || 9999);
      const bx = avgParentX(b) ?? (nodes[b].birth_year || 9999);
      return ax - bx;
    });

    // Группируем супругов рядом: сначала член династии, затем его супруг(а)
    const ordered = [];
    const placed  = new Set();
    ids.forEach((id) => {
      if (placed.has(id)) return;
      placed.add(id);
      ordered.push(id);
      nodes[id].spouses
        .filter((sid) => !placed.has(sid) && genOf[sid] === g)
        .sort((a, b) => (nodes[a].birth_year || 0) - (nodes[b].birth_year || 0))
        .forEach((sid) => { placed.add(sid); ordered.push(sid); });
    });

    const y = g * (NODE_H + V_GAP);
    let cursor = 0;
    ordered.forEach((id) => {
      const ideal = avgParentX(id);
      const x     = ideal !== null ? Math.max(cursor, ideal) : cursor;
      pos[id]     = { x, y };
      cursor      = x + SLOT;
    });
  }

  // Шаг 6: центрирование снизу вверх — сдвигаем узел над серединой его детей
  for (let g = maxGen - 1; g >= 0; g--) {
    const ids = byGen[g] || [];

    ids.forEach((id) => {
      const ch = nodes[id].children.filter((cid) => pos[cid]);
      if (!ch.length) return;
      const minCX  = Math.min(...ch.map((cid) => pos[cid].x));
      const maxCX  = Math.max(...ch.map((cid) => pos[cid].x));
      const target = (minCX + maxCX) / 2;
      const shift  = target - pos[id].x;
      if (Math.abs(shift) < 1) return;
      pos[id] = { ...pos[id], x: target };
      nodes[id].spouses
        .filter((sid) => genOf[sid] === g && pos[sid])
        .forEach((sid) => { pos[sid] = { ...pos[sid], x: pos[sid].x + shift }; });
    });

    // Проход слева направо для устранения перекрытий
    const row = [...ids].sort((a, b) => pos[a].x - pos[b].x);
    let cur = pos[row[0]]?.x ?? 0;
    row.forEach((id, i) => {
      if (i === 0) { cur = pos[id].x; return; }
      if (pos[id].x < cur + SLOT) pos[id] = { ...pos[id], x: cur + SLOT };
      cur = pos[id].x;
    });
  }

  // Шаг 7: нормализация — сдвигаем так, чтобы minX = 20, minY = 20
  const minX = Math.min(...Object.values(pos).map((p) => p.x));
  Object.keys(pos).forEach((id) => {
    pos[id] = { x: pos[id].x - minX + 20, y: pos[id].y + 20 };
  });

  const totalW = Math.max(...Object.values(pos).map((p) => p.x)) + NODE_W + 20;
  const totalH = maxGen * (NODE_H + V_GAP) + NODE_H + 40;

  // Центр X верхнего поколения (для начального смещения камеры)
  const topY = Math.min(...Object.values(pos).map((p) => p.y));
  const topNodes = Object.values(pos).filter((p) => p.y === topY);
  const rootCenterX = topNodes.reduce((s, p) => s + p.x + NODE_W / 2, 0) / topNodes.length;

  return { nodes, pos, parentChildEdges, spouseEdges, totalW, totalH, rootCenterX };
}

// ─── Отрисовка на Canvas ──────────────────────────────────────────────────

function drawAll(ctx, layout, scale, ox, oy, hoveredId, focusedId = null) {
  const { nodes, pos, parentChildEdges, spouseEdges } = layout;

  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const cx  = (id) => pos[id].x + NODE_W / 2;
  const top = (id) => pos[id].y;
  const bot = (id) => pos[id].y + NODE_H;

  // Рёбра супругов — красная горизонтальная линия
  spouseEdges.forEach(({ from, to }) => {
    if (!pos[from] || !pos[to]) return;
    const left  = pos[from].x <= pos[to].x ? from : to;
    const right = left === from ? to : from;
    const y = pos[left].y + NODE_H / 2;
    ctx.beginPath();
    ctx.strokeStyle = "#c00";
    ctx.lineWidth   = 1.5;
    ctx.moveTo(pos[left].x + NODE_W, y);
    ctx.lineTo(pos[right].x, y);
    ctx.stroke();
  });

  // Рёбра родитель-ребёнок — ортогональные линии
  parentChildEdges.forEach(({ parent, child }) => {
    if (!pos[parent] || !pos[child]) return;
    const px  = cx(parent),  py  = bot(parent);
    const chx = cx(child),   chy = top(child);
    const mid = py + (chy - py) / 2;
    ctx.beginPath();
    ctx.strokeStyle = "#555";
    ctx.lineWidth   = 1.5;
    ctx.moveTo(px,  py);
    ctx.lineTo(px,  mid);
    ctx.lineTo(chx, mid);
    ctx.lineTo(chx, chy);
    ctx.stroke();
  });

  // Отрисовка узлов
  Object.entries(pos).forEach(([id, { x, y }]) => {
    const p = nodes[id];
    if (!p) return;

    const hovered = id === hoveredId;
    const focused = id === focusedId;

    // Выделенный узел — жёлтый фон, обычные — по полу
    const bg = focused ? "#fff3b0"
             : p.gender === "M" ? "#d6c4f7"
             : p.gender === "F" ? "#f7d6f7"
             : "#e8e8e8";

    const r = 7;

    // Оранжевое свечение вокруг выделенного узла
    if (focused) {
      ctx.save();
      ctx.shadowColor = "#f5a623";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(x + r - 4, y - 4);
      ctx.lineTo(x + NODE_W - r + 4, y - 4);
      ctx.quadraticCurveTo(x + NODE_W + 4, y - 4, x + NODE_W + 4, y + r - 4);
      ctx.lineTo(x + NODE_W + 4, y + NODE_H - r + 4);
      ctx.quadraticCurveTo(x + NODE_W + 4, y + NODE_H + 4, x + NODE_W - r + 4, y + NODE_H + 4);
      ctx.lineTo(x + r - 4, y + NODE_H + 4);
      ctx.quadraticCurveTo(x - 4, y + NODE_H + 4, x - 4, y + NODE_H - r + 4);
      ctx.lineTo(x - 4, y + r - 4);
      ctx.quadraticCurveTo(x - 4, y - 4, x + r - 4, y - 4);
      ctx.closePath();
      ctx.strokeStyle = "#f5a623";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Прямоугольник узла со скруглёнными углами
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + NODE_W - r, y);
    ctx.quadraticCurveTo(x + NODE_W, y, x + NODE_W, y + r);
    ctx.lineTo(x + NODE_W, y + NODE_H - r);
    ctx.quadraticCurveTo(x + NODE_W, y + NODE_H, x + NODE_W - r, y + NODE_H);
    ctx.lineTo(x + r, y + NODE_H);
    ctx.quadraticCurveTo(x, y + NODE_H, x, y + NODE_H - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle   = bg;
    ctx.fill();
    ctx.strokeStyle = focused ? "#e8960c" : hovered ? "#333" : "#bbb";
    ctx.lineWidth   = focused ? 2.5 : hovered ? 2.5 : 1;
    ctx.stroke();

    // Имя персоны
    const name    = `${p.first_name} ${p.last_name}`;
    const display = name.length > 20 ? name.slice(0, 19) + "…" : name;
    ctx.fillStyle  = "#222";
    ctx.font       = "bold 13px Arial";
    ctx.textAlign  = "center";
    ctx.fillText(display, x + NODE_W / 2, y + 22);

    // Годы жизни
    ctx.fillStyle = "#555";
    ctx.font      = "11px Arial";
    ctx.fillText(
      `${p.birth_year ?? "?"} – ${p.death_year ?? "н.в."}`,
      x + NODE_W / 2, y + 40
    );
  });

  ctx.restore();
}

// Определяет, на какой узел попал клик мыши
function hitTest(mx, my, pos, scale, ox, oy) {
  const wx = (mx - ox) / scale;
  const wy = (my - oy) / scale;
  for (const [id, { x, y }] of Object.entries(pos)) {
    if (wx >= x && wx <= x + NODE_W && wy >= y && wy <= y + NODE_H) return id;
  }
  return null;
}

// ─── Компонент ────────────────────────────────────────────────────────────

export default function Graph() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef    = useRef(null);
  const layoutRef    = useRef(null);
  const dragging     = useRef(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const dragMoved    = useRef(false);
  const scaleRef     = useRef(1.0);
  const offsetRef    = useRef({ x: 20, y: 20 });
  const isFirstLoad  = useRef(true);

  const [layout, setLayout]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [scale, setScale]             = useState(1.0);
  const [offset, setOffset]           = useState({ x: 20, y: 20 });
  const [hoveredId, setHoveredId]     = useState(null);
  const [focusedId, setFocusedId]     = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [info, setInfo]               = useState({ total: 0, period: "" });

  // Синхронизируем ref-ы с state для доступа из обработчиков событий
  useEffect(() => { scaleRef.current  = scale;  }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Перерисовка Canvas
  const redraw = useCallback((lay, sc, off, hov, foc) => {
    const canvas = canvasRef.current;
    if (!canvas || !lay) return;
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    drawAll(ctx, lay, sc, off.x, off.y, hov, foc);
  }, []);

  // Перерисовываем при изменении любого параметра отображения
  useEffect(() => { redraw(layout, scale, offset, hoveredId, focusedId); },
    [layout, scale, offset, hoveredId, focusedId, redraw]);

  // Перерисовка при изменении размера окна
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() =>
      redraw(layoutRef.current, scaleRef.current, offsetRef.current, null)
    );
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  // Центрирование начального вида на верхнем поколении (если нет ?focus=)
  useEffect(() => {
    if (!layout || !isFirstLoad.current) return;
    isFirstLoad.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const focusParam = searchParams.get("focus");
    if (!focusParam) {
      const { width } = canvas.getBoundingClientRect();
      setOffset({ x: width / 2 - layout.rootCenterX, y: 20 });
    }
  }, [layout, searchParams]);

  // Фокусировка на конкретном узле при переходе с ?focus=id
  useEffect(() => {
    const focusParam = searchParams.get("focus");
    if (!focusParam || !layout || !layout.pos[focusParam]) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nodePos = layout.pos[focusParam];
    const focusScale = 1.4;
    setScale(focusScale);
    setOffset({
      x: rect.width / 2 - (nodePos.x + NODE_W / 2) * focusScale,
      y: rect.height / 2 - (nodePos.y + NODE_H / 2) * focusScale,
    });
    setFocusedId(focusParam);
    // Убираем ?focus= из URL, чтобы при обновлении страницы не зацикливалось
    setSearchParams({}, { replace: true });
    // Подсветка исчезает через 4 секунды
    setTimeout(() => setFocusedId(null), 4000);
  }, [layout, searchParams, setSearchParams]);

  // Загрузка данных графа с сервера
  const loadGraph = useCallback(async () => {
    setLoading(true);
    const data = await getGraphData();
    const lay  = buildLayout(data.persons, data.relations);
    layoutRef.current = lay;
    setLayout(lay);
    const by = data.persons.filter((p) => p.birth_year).map((p) => p.birth_year);
    const dy = data.persons.filter((p) => p.death_year).map((p) => p.death_year);
    setInfo({
      total:  data.persons.length,
      period: by.length ? `${Math.min(...by)} – ${Math.max(...dy)}` : "",
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Зум колесом мыши — к позиции курсора
  function handleWheel(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor   = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(3, Math.max(0.07, scaleRef.current * factor));
    const ratio    = newScale / scaleRef.current;
    setScale(newScale);
    setOffset({
      x: mx - (mx - offsetRef.current.x) * ratio,
      y: my - (my - offsetRef.current.y) * ratio,
    });
  }

  // Начало перетаскивания
  function handleMouseDown(e) {
    dragging.current  = true;
    dragMoved.current = false;
    dragStart.current = {
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
    };
  }

  // Перемещение мыши — перетаскивание или подсветка узла при наведении
  function handleMouseMove(e) {
    if (dragging.current) {
      dragMoved.current = true;
      setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      return;
    }
    const lay = layoutRef.current;
    if (!lay) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const id = hitTest(
      e.clientX - rect.left, e.clientY - rect.top,
      lay.pos, scaleRef.current, offsetRef.current.x, offsetRef.current.y
    );
    setHoveredId(id || null);
    canvas.style.cursor = id ? "pointer" : "grab";
  }

  // Конец перетаскивания
  function handleMouseUp() { dragging.current = false; }

  // Клик по узлу — открытие карточки персоны
  async function handleClick(e) {
    if (dragMoved.current) return;
    const lay = layoutRef.current;
    if (!lay) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const id = hitTest(
      e.clientX - rect.left, e.clientY - rect.top,
      lay.pos, scaleRef.current, offsetRef.current.x, offsetRef.current.y
    );
    if (id) {
      const full = await getPerson(id);
      setSelectedPerson(full);
      setIsModalOpen(true);
    }
  }

  // Удаление персоны с подтверждением
  async function handleDelete(id) {
    if (!window.confirm("Вы уверены, что хотите удалить эту персону? Все связи будут удалены.")) return;
    await deletePerson(id);
    setIsModalOpen(false);
    setSelectedPerson(null);
    await loadGraph();
  }

  // Кнопки управления масштабом
  function zoomIn()  { setScale((s) => Math.min(3, +(s * 1.2).toFixed(3))); }
  function zoomOut() { setScale((s) => Math.max(0.07, +(s / 1.2).toFixed(3))); }
  function resetView() {
    const canvas = canvasRef.current;
    const lay    = layoutRef.current;
    if (!canvas || !lay) return;
    const { width } = canvas.getBoundingClientRect();
    setScale(1.0);
    setOffset({ x: width / 2 - lay.rootCenterX, y: 20 });
  }

  if (loading) return <div className="page"><Navbar /><p>Загрузка графа…</p></div>;

  return (
    <div className="page">
      <Navbar />
      <div className="graph-header">
        <div>
          <h1>Дерево Романовых</h1>
          <p className="subtitle">{info.period}&nbsp;&nbsp;{info.total} персон</p>
        </div>
        <div className="graph-controls">
          <button onClick={zoomIn}    title="Увеличить">+</button>
          <button onClick={zoomOut}   title="Уменьшить">−</button>
          <button onClick={resetView} title="Сбросить вид">⟳</button>
        </div>
      </div>

      <div className="graph-legend">
        <span><span className="legend-line solid" /> родитель → ребёнок</span>
        <span><span className="legend-line" style={{ borderColor: "#c00" }} /> супруги</span>
      </div>

      <div className="graph-canvas-wrapper">
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        />
      </div>

      <PersonModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedPerson(null); }}
        person={selectedPerson}
        onSelectPerson={async (id) => { const full = await getPerson(id); setSelectedPerson(full); }}
        onDelete={handleDelete}
      />
    </div>
  );
}

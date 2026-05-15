import Navbar from "../components/Navbar";
import { getCustomStats } from "../api/api";
import "../style.css";
import { useState, useRef, useEffect } from "react";

const AXIS_X_OPTIONS = [
  { value: "birth_year", label: "Год рождения" },
  { value: "title",      label: "Титул" },
  { value: "country",    label: "Страна" },
];

const AXIS_Y_OPTIONS = [
  { value: "count",      label: "Количество персон" },
  { value: "avg_age",    label: "Средний возраст" },
  { value: "marriages",  label: "Количество браков" },
];

const BAR_COLOR = "#b0d0f7";
const BAR_HOVER = "#7aaee8";
const MAX_BAR_HEIGHT = 220;
const BAR_WIDTH = 36;
const BAR_GAP = 14;
const PADDING = { top: 20, right: 20, bottom: 60, left: 50 };

export default function Stats() {
  const [filters, setFilters] = useState({
    country: "", gender: "",
    birth_year_from: "", death_year_to: "",
  });
  const [axisX, setAxisX] = useState("birth_year");
  const [axisY, setAxisY] = useState("count");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const chartContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
        setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(chartContainerRef.current);
    return () => ro.disconnect();
    }, []);

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  async function handleBuild() {
    setError(null);
    setLoading(true);
    setTooltip(null);
    setHoveredIdx(null);
    try {
      const data = await getCustomStats({
        ...filters,
        axis_x: axisX,
        axis_y: axisY,
      });
      setResult(data);
    } catch (e) {
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFilters({ country: "", gender: "", birth_year_from: "", death_year_to: "" });
    setAxisX("birth_year");
    setAxisY("count");
    setResult(null);
    setError(null);
    setTooltip(null);
    setHoveredIdx(null);
  }

  const chart = result?.chart ?? [];
  const maxVal = chart.length ? Math.max(...chart.map(p => p.value), 1) : 1;

  const minSvgW = PADDING.left + chart.length * (BAR_WIDTH + BAR_GAP) + PADDING.right;
  const svgW = Math.max(minSvgW, containerWidth || minSvgW);      
  const svgH = MAX_BAR_HEIGHT + PADDING.top + PADDING.bottom;

  const xLabelOf = AXIS_X_OPTIONS.find(o => o.value === axisX)?.label ?? axisX;
  const yLabelOf = AXIS_Y_OPTIONS.find(o => o.value === axisY)?.label ?? axisY;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    ratio: t,
    val: +(maxVal * t).toFixed(1),
    y: PADDING.top + MAX_BAR_HEIGHT - t * MAX_BAR_HEIGHT,
  }));

  return (
    <div className="page">
      <Navbar />
      <h1>Статистика</h1>

      <div className="search-box" style={{ marginBottom: 20 }}>
        <div className="search-grid">
          <input
            placeholder="Страна"
            value={filters.country}
            onChange={e => setFilter("country", e.target.value)}
          />
          <select
            value={filters.gender}
            onChange={e => setFilter("gender", e.target.value)}
          >
            <option value="">Пол</option>
            <option value="M">М</option>
            <option value="F">Ж</option>
          </select>
          <input
            placeholder="Период жизни от"
            inputMode="numeric"
            value={filters.birth_year_from}
            onChange={e => setFilter("birth_year_from", e.target.value.replace(/\D/g, ""))}
            />
          <input
            placeholder="до"
            inputMode="numeric"
            value={filters.death_year_to}
            onChange={e => setFilter("death_year_to", e.target.value.replace(/\D/g, ""))}
            />
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontWeight: 500 }}>Ось X:</label>
            <select value={axisX} onChange={e => setAxisX(e.target.value)}>
              {AXIS_X_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontWeight: 500 }}>Ось Y:</label>
            <select value={axisY} onChange={e => setAxisY(e.target.value)}>
              {AXIS_Y_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            className="save-btn"
            style={{ marginTop: 0 }}
            onClick={handleBuild}
            disabled={loading}
          >
            {loading ? "Загрузка..." : "Построить"}
          </button>
          <button
            className="cancel-btn"
            style={{ marginTop: 0 }}
            onClick={handleReset}
          >
            Сбросить
          </button>
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>

          <div ref={chartContainerRef} style={{ flex: 1, overflowX: "auto" }}>
            {chart.length === 0 ? (
              <p style={{ color: "#888" }}>Нет данных для отображения</p>
            ) : (
              <div style={{ position: "relative", display: "inline-block" }}>
                <svg
                  width={svgW}
                  height={svgH}
                  style={{ display: "block", fontFamily: "Arial, sans-serif" }}
                >
                  {yTicks.map(t => (
                    <g key={t.ratio}>
                      <line
                        x1={PADDING.left} y1={t.y}
                        x2={svgW - PADDING.right} y2={t.y}
                        stroke="#e0e0e0" strokeWidth={1}
                      />
                      <text
                        x={PADDING.left - 6} y={t.y + 4}
                        textAnchor="end" fontSize={11} fill="#666"
                      >
                        {t.val}
                      </text>
                    </g>
                  ))}

                  <text
                    x={12} y={PADDING.top + MAX_BAR_HEIGHT / 2}
                    textAnchor="middle" fontSize={11} fill="#555"
                    transform={`rotate(-90, 12, ${PADDING.top + MAX_BAR_HEIGHT / 2})`}
                  >
                    {yLabelOf}
                  </text>

                  {chart.map((point, i) => {
                    const barH = Math.max(2, (point.value / maxVal) * MAX_BAR_HEIGHT);
                    const x = PADDING.left + i * (BAR_WIDTH + BAR_GAP);
                    const y = PADDING.top + MAX_BAR_HEIGHT - barH;
                    const hovered = hoveredIdx === i;

                    return (
                      <g key={i}
                        onMouseEnter={e => {
                            setHoveredIdx(i);
                            setTooltip({ clientX: e.clientX, clientY: e.clientY, point });
                        }}
                        onMouseMove={e => {
                            setTooltip(prev => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null);
                        }}
                        onMouseLeave={() => { setHoveredIdx(null); setTooltip(null); }}
                        style={{ cursor: "default" }}
                        >
                        <rect
                          x={x} y={y}
                          width={BAR_WIDTH} height={barH}
                          fill={hovered ? BAR_HOVER : BAR_COLOR}
                          rx={3}
                        />
                        <text
                          x={x + BAR_WIDTH / 2}
                          y={PADDING.top + MAX_BAR_HEIGHT + 16}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#555"
                          transform={`rotate(-35, ${x + BAR_WIDTH / 2}, ${PADDING.top + MAX_BAR_HEIGHT + 16})`}
                        >
                          {point.label.length > 12 ? point.label.slice(0, 11) + "…" : point.label}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={PADDING.left} y1={PADDING.top + MAX_BAR_HEIGHT}
                    x2={svgW - PADDING.right} y2={PADDING.top + MAX_BAR_HEIGHT}
                    stroke="#aaa" strokeWidth={1}
                  />

                </svg>
                {tooltip && (
                    <div style={{
                        position: "fixed",
                        left: tooltip.clientX + 14,
                        top: tooltip.clientY - 56,
                        background: "white",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        pointerEvents: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        zIndex: 100,
                        whiteSpace: "nowrap",
                    }}>
                        <div style={{ fontWeight: "bold", marginBottom: 2 }}>{tooltip.point.label}</div>
                        <div>{yLabelOf}: <b>{tooltip.point.value}</b></div>
                        <div>Персон: <b>{tooltip.point.count}</b></div>
                    </div>
                    )}

                <div style={{ textAlign: "center", fontSize: 12, color: "#555", marginTop: 2 }}>
                  {xLabelOf}
                </div>
              </div>
            )}
          </div>

          <div style={{ minWidth: 180, display: "flex", flexDirection: "column", gap: 16, paddingTop: 20 }}>
            <div className="card pink" style={{ minHeight: "unset", padding: "14px 18px" }}>
              <div className="value" style={{ fontSize: 24 }}>{result.total_persons}</div>
              <div>Всего персон</div>
            </div>
            <div className="card blue" style={{ minHeight: "unset", padding: "14px 18px" }}>
              <div className="value" style={{ fontSize: 24 }}>
                {result.avg_age ?? "—"}
              </div>
              <div>Средний возраст</div>
            </div>
            {result.peak_birth_year && (
              <div className="card yellow" style={{ minHeight: "unset", padding: "14px 18px" }}>
                <div className="value" style={{ fontSize: 24 }}>{result.peak_birth_year}</div>
                <div>Пик рождаемости</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MeteoTrend } from "./types";
import { formatTrendTooltip, smoothTrendPath, trendSegments, trendTimestamp, validTrendPoints, type PlotPoint } from "./trends";

export function MeteoTrendLine({ series, label, now, decimals = 2, unit }: { series?: MeteoTrend; label: string; now: Date; decimals?: number; unit?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const id = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const segments = useMemo(() => {
    const points = series ? validTrendPoints(series) : [];
    const valid = points.filter((point) => point.value != null);
    if (!valid.length) return [];
    const first = trendTimestamp(points[0].timestamp), last = trendTimestamp(points[points.length - 1].timestamp);
    const low = Math.min(...valid.map((point) => point.value!)), high = Math.max(...valid.map((point) => point.value!));
    return trendSegments(points).map((segment) => segment.map((point): PlotPoint => ({ ...point,
      x: first === last ? 150 : 5 + (trendTimestamp(point.timestamp) - first) / (last - first) * 290,
      y: low === high ? 32 : 58 - (point.value - low) / (high - low) * 52,
    })));
  }, [series]);
  const points = segments.flat();
  const active = activeIndex == null ? null : points[activeIndex];
  useEffect(() => { setActiveIndex(null); }, [series]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setActiveIndex(null); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useLayoutEffect(() => {
    if (!active || !root.current || !tooltip.current) return;
    const place = () => {
      const box = root.current!.getBoundingClientRect(), tip = tooltip.current!.getBoundingClientRect();
      const x = box.left + active.x / 300 * box.width, y = box.top + active.y / 64 * box.height;
      setPosition({ left: Math.max(8 + tip.width / 2, Math.min(window.innerWidth - 8 - tip.width / 2, x)),
        top: Math.max(8, Math.min(window.innerHeight - tip.height - 8, y - tip.height - 12)) });
    };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [active]);
  if (!series || !points.length) return null;
  const select = (clientX: number) => {
    if (!root.current) return;
    const rect = root.current.getBoundingClientRect(), x = (clientX - rect.left) / rect.width * 300;
    setActiveIndex(points.reduce((closest, point, index) => Math.abs(point.x - x) < Math.abs(points[closest].x - x) ? index : closest, 0));
  };
  return <div className="meteo-trend" ref={root} role="group" tabIndex={0} aria-label={`Tendencia de ${label}`} aria-describedby={active ? id : undefined}
    onPointerMove={(event) => select(event.clientX)} onPointerDown={(event) => select(event.clientX)}
    onPointerLeave={(event) => { if (event.pointerType !== "touch") setActiveIndex(null); }}
    onFocus={() => setActiveIndex((current) => current ?? points.length - 1)} onBlur={() => setActiveIndex(null)}
    onKeyDown={(event) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        setActiveIndex(event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 :
          Math.max(0, Math.min(points.length - 1, (activeIndex ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1))));
      }
    }}>
    <svg viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true">
      {segments.map((segment, index) => segment.length === 1
        ? <circle key={index} cx={segment[0].x} cy={segment[0].y} r="3" fill="currentColor" />
        : <path key={index} d={smoothTrendPath(segment)} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      {active && <circle className="meteo-trend-marker" cx={active.x} cy={active.y} r="4" fill="currentColor" stroke="white" strokeWidth="1.5" />}
    </svg>
    {active && createPortal(<div id={id} ref={tooltip} role="tooltip" className="meteo-trend-tooltip" style={position}>
      {formatTrendTooltip(active, series, now, decimals, unit ?? series.unit)}
    </div>, document.body)}
  </div>;
}

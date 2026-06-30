import {
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Panel } from "../../components/Panel";
import {
  getSnowBalanceDisplayRows,
  getSnowBalanceRecord,
  snowBalanceBasinLabels,
  type SnowBalanceBasinId,
} from "../../data/snowBalanceData";

const snowBalanceBasins: SnowBalanceBasinId[] = ["jorquera", "pulido", "manflas"];

export function SnowBalanceTab({
  availableBalanceYears,
  onSelectedBalanceYearChange,
  selectedBalanceYear,
}: {
  availableBalanceYears: number[];
  onSelectedBalanceYearChange: (year: number) => void;
  selectedBalanceYear: number;
}) {
  return (
        <div className="snow-balance-stack">
          <div className="snow-description">
            <h3>Balance de masa de nieve</h3>
            <p>
              Estimación del derretimiento, transporte y pérdidas durante la
              temporada húmeda. Cada cuenca permite seleccionar un año histórico
              y revisar intervalos de confianza (95%) en mm equivalentes de agua en nieve (SWE).
            </p>
          </div>

          <div className="snow-balance-global-controls">
            <label htmlFor="snow-balance-year-global">Año</label>
            <select
              id="snow-balance-year-global"
              value={selectedBalanceYear}
              onChange={(event) => onSelectedBalanceYearChange(Number(event.target.value))}
            >
              {availableBalanceYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="snow-balance-grid">
            {snowBalanceBasins.map((basin) => {
              const record = getSnowBalanceRecord(basin, selectedBalanceYear);
              const rows = getSnowBalanceDisplayRows(record);

              return (
                <Panel
                  key={basin}
                  title={`Balance de la cuenca del río ${snowBalanceBasinLabels[basin]}`}
                  subtitle={`Intervalos de confianza (95%) · Año ${selectedBalanceYear}`}
                >
                  <div className="snow-balance-chart-layout">
                    <div className="snow-balance-donut">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={rows}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={52}
                            outerRadius={84}
                            paddingAngle={2}
                            cx="50%"
                            cy="50%"
                          >
                            {rows.map((row) => (
                              <Cell key={`${basin}-${row.componentId}`} fill={row.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, label) => [
                              `${Number(value ?? 0).toFixed(2)} mm`,
                              String(label ?? ""),
                            ]}
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid hsl(210 18% 86%)",
                              borderRadius: "8px",
                              boxShadow: "0 8px 16px rgba(16, 44, 92, 0.12)",
                              fontSize: "11px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="snow-balance-legend">
                      {rows.map((row) => (
                        <div key={`${basin}-legend-${row.componentId}`} className="snow-balance-legend-row">
                          <span className="snow-balance-legend-main">
                            <i
                              className="snow-balance-dot"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.label}
                          </span>
                          <strong>{row.percent.toFixed(1)}%</strong>
                        </div>
                      ))}
                      <p className="snow-balance-total">
                        Total estimado: <strong>{record.total.toFixed(2)} mm SWE</strong>
                      </p>
                    </div>
                  </div>

                  <div className="snow-balance-table-wrap">
                    <table className="snow-balance-table">
                      <thead>
                        <tr>
                          <th>Componente</th>
                          <th>Máximo (mm)</th>
                          <th>Mínimo (mm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${basin}-row-${row.componentId}`}>
                            <td>{row.label}</td>
                            <td>{row.max.toFixed(2)}</td>
                            <td>{row.min.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
  );
}

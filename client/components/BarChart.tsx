interface Props {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
}

export default function BarChart({ data, format = (n) => String(n), color = "bg-indigo-500" }: Props) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-56 gap-2 pt-5" role="img" aria-label="Bar chart">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center">
            <div className="relative w-full flex-1">
              {d.value > 0 && (
                <span
                  className="absolute left-0 right-0 text-center text-[10px] text-slate-500"
                  style={{ bottom: `calc(${pct}% + 2px)` }}
                >
                  {format(d.value)}
                </span>
              )}
              <div
                className={`absolute bottom-0 left-1 right-1 rounded-t ${color}`}
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 3 : 0 }}
              />
            </div>
            <span className="mt-1 text-xs text-slate-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
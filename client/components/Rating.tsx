export default function Rating({ average, count }: { average: number; count: number }) {
  if (count === 0) {
    return <span className="text-sm text-slate-500">No reviews yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-500">★</span>
      <span className="font-semibold">{average.toFixed(1)}</span>
      <span className="text-slate-500">({count})</span>
    </span>
  );
}
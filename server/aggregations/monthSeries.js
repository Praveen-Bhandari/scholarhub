export function monthWindow(months) {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)
  );
  const labels = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    labels.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return { start, labels };
}

// pipeline me mahine ka label nikalne ke liye
export const monthKey = (field) => ({
  $dateToString: { format: "%Y-%m", date: field, timezone: "UTC" },
});
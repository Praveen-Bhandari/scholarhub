const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  rating: { averageRating: -1, reviewCount: -1, _id: -1 },
};

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const num = (v) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function buildCourseQuery(params = {}) {
  const q = str(params.q);
  const category = str(params.category);
  const level = str(params.level);
  const minPrice = num(params.minPrice);
  const maxPrice = num(params.maxPrice);
  const minRating = num(params.minRating);

  const filter = { status: "approved" };
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  if (minRating !== undefined) filter.averageRating = { $gte: minRating };

  const relevance = Boolean(q) && !SORTS[params.sort];
  const sort = relevance
    ? { score: { $meta: "textScore" }, _id: -1 }
    : SORTS[params.sort] || SORTS.newest;

  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(params.limit, 10) || 12));

  return { filter, sort, relevance, page, limit, skip: (page - 1) * limit };
}
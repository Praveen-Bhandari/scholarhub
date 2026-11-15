import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";

// search text ko shabd ki tarah lene ke liye regex ke special akshar escape
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shape = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isEmailVerified: u.isEmailVerified,
  isActive: u.isActive !== false, // purane users me field nahi, wo active
  createdAt: u.createdAt,
});

// ---------- List ----------
export async function listUsers(req, res) {
  const { q, role, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (role) filter.role = role;
  if (status === "active") filter.isActive = { $ne: false };
  if (status === "inactive") filter.isActive = false;
  if (typeof q === "string" && q.trim()) {
    const re = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ name: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      // password aur tokens kabhi nahi, sirf zaroori fields
      .select("name email role isEmailVerified isActive createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  res.json({
    users: users.map(shape),
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages },
  });
}

// ---------- Role ya status badlo ----------
export async function updateUser(req, res) {
  const { id } = req.params;
  const { role, isActive } = req.body;

  if (id === req.user.id) {
    return res
      .status(403)
      .json({ message: "You cannot change your own role or status" });
  }
  if (role === undefined && isActive === undefined) {
    return res.status(400).json({ message: "Send a role or isActive to update" });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let sessionsMustEnd = false;

  if (role !== undefined && role !== user.role) {
    user.role = role;
    sessionsMustEnd = true; // naya role login ke baad hi lagu
  }
  if (isActive !== undefined && isActive !== (user.isActive !== false)) {
    user.isActive = isActive;
    if (isActive === false) sessionsMustEnd = true;
  }

  await user.save();

  if (sessionsMustEnd) {
    await RefreshToken.updateMany({ user: user._id }, { revoked: true });
  }

  res.json({ user: shape(user) });
}
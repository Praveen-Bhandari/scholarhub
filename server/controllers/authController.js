import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import {
  generateRandomToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";
import { setAuthCookies, clearAuthCookies } from "../utils/cookies.js";
import { sendEmail } from "../services/email.js";

const VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 ghante
const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 ghanta

// ---------- Register ----------
export async function register(req, res) {
  const { name, email, password, role } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const token = generateRandomToken();

  const user = await User.create({
    name,
    email,
    password,
    // admin kabhi nahi, sirf student ya instructor
    role: role === "instructor" ? "instructor" : "student",
    emailVerifyTokenHash: hashToken(token),
    emailVerifyExpires: new Date(Date.now() + VERIFY_EXPIRY_MS),
  });

  const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  try {
    await sendEmail({
      to: user.email,
      subject: "Verify your ScholarHub email",
      html: `<p>Hi ${user.name},</p>
             <p>Click the link to verify your email (valid for 24 hours):</p>
             <p><a href="${link}">${link}</a></p>`,
    });
  } catch (err) {
    console.error("Verification email failed:", err.message);
  }

  res.status(201).json({
    message: "Registered. Check your email to verify your account.",
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

// ---------- Verify email ----------
export async function verifyEmail(req, res) {
  const { token } = req.body;

  const user = await User.findOne({
    emailVerifyTokenHash: hashToken(token),
    emailVerifyExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  user.isEmailVerified = true;
  user.emailVerifyTokenHash = undefined; // token ek hi baar chalega
  user.emailVerifyExpires = undefined;
  await user.save();

  res.json({ message: "Email verified. You can now log in." });
}

// ---------- Login ----------
export async function login(req, res) {
  const { email, password } = req.body;

  // password select:false hai, isliye yahan specially maangna padta hai
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

  const ok = user && (await user.comparePassword(password));
  if (!ok) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (!user.isEmailVerified) {
    return res.status(403).json({ message: "Please verify your email first" });
  }
    if (user.isActive === false) {
    return res.status(403).json({ message: "Your account has been deactivated" });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // DB me asli token nahi, sirf hash
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(verifyRefreshToken(refreshToken).exp * 1000),
  });

  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    message: "Logged in",
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

// ---------- Refresh (rotation + reuse detection) ----------
export async function refresh(req, res) {
  const oldToken = req.cookies.refreshToken;
  if (!oldToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  // 1. signature aur expiry check
  let payload;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "User not found" });
  }

  // band kiye gaye user ke saare tokens bhi band (user ke baad hi aana chahiye)
  if (user.isActive === false) {
    await RefreshToken.updateMany({ user: user._id }, { revoked: true });
    clearAuthCookies(res);
    return res.status(401).json({ message: "Account deactivated" });
  }

  // 2. naye tokens banao
  const newAccess = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  const newHash = hashToken(newRefresh);

  // 3. ATOMIC: purana token sirf tab revoke hoga jab abhi tak revoked nahi tha
  const oldHash = hashToken(oldToken);
  const used = await RefreshToken.findOneAndUpdate(
    { tokenHash: oldHash, revoked: false },
    { revoked: true, replacedByHash: newHash }
  );

  if (!used) {
    // ya to token DB me hai hi nahi, ya pehle hi use ho chuka (reuse)
    const existing = await RefreshToken.findOne({ tokenHash: oldHash });
    if (existing) {
      // reuse detected: is user ke saare tokens revoke
      await RefreshToken.updateMany({ user: existing.user }, { revoked: true });
    }
    clearAuthCookies(res);
    return res
      .status(401)
      .json({ message: "Refresh token reuse detected. Please log in again." });
  }

  // 4. naya token DB me save, cookies set
  await RefreshToken.create({
    user: user._id,
    tokenHash: newHash,
    expiresAt: new Date(verifyRefreshToken(newRefresh).exp * 1000),
  });

  setAuthCookies(res, newAccess, newRefresh);
  res.json({ message: "Token refreshed" });
}
// ---------- Logout ----------
export async function logout(req, res) {
  const token = req.cookies.refreshToken;
  if (token) {
    await RefreshToken.updateOne(
      { tokenHash: hashToken(token) },
      { revoked: true }
    );
  }
  clearAuthCookies(res);
  res.json({ message: "Logged out" });
}

// ---------- Forgot password ----------
export async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    const token = generateRandomToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_EXPIRY_MS);
    await user.save();

    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your ScholarHub password",
        html: `<p>Hi ${user.name},</p>
               <p>Click the link to reset your password (valid for 1 hour):</p>
               <p><a href="${link}">${link}</a></p>
               <p>If you did not ask for this, ignore this email.</p>`,
      });
    } catch (err) {
      console.error("Reset email failed:", err.message);
    }
  }

  // email ho ya na ho, jawab wahi
  res.json({ message: "If that email is registered, a reset link has been sent." });
}

// ---------- Reset password ----------
export async function resetPassword(req, res) {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  user.password = password; // save par apne aap hash ho jayega
  user.passwordResetTokenHash = undefined; // token ek hi baar chalega
  user.passwordResetExpires = undefined;
  await user.save();

  // saare purane sessions band
  await RefreshToken.updateMany({ user: user._id }, { revoked: true });

  res.json({ message: "Password reset. Please log in with your new password." });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user || user.isActive === false) {
    return res.status(401).json({ message: "User not found" });
  }
  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}
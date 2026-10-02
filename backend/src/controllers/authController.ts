import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database';
import { sendPasswordReset } from '../services/emailService';
import { EmailKey, EmailLang, normalizeLang, et } from '../services/emailI18n';

const SALT_ROUNDS = 10;

// Ties a reset token to the password it was issued for: an HMAC of the stored
// hash, so the token stops working the moment the password changes (single
// use) without storing anything, and without exposing any of the hash itself.
const passwordFingerprint = (passwordHash: string | null): string =>
  crypto.createHmac('sha256', process.env.JWT_SECRET!).update(passwordHash || '').digest('hex').slice(0, 32);

// userId -> last reset mail time, so one account can't be mail-bombed.
const resetMailCooldown = new Map<number, number>();
const RESET_MAIL_COOLDOWN_MS = 60 * 1000;

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      avatar_url: user.avatar_url,
      total_points: user.total_points,
      is_admin: user.is_admin,
      pitwall_access: user.pitwall_access ?? false,
      language: user.language ?? null,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Password-based registration
export const registerWithPassword = async (req: Request, res: Response) => {
  try {
    const { nickname, email, password } = req.body;
    // Whatever language the visitor was using when they signed up
    const language = req.body.language === 'en' || req.body.language === 'nl' ? req.body.language : null;

    if (!nickname || !email || !password) {
      return res.status(400).json({ error: 'Nickname, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1 OR nickname = $2',
      [email, nickname]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email or nickname already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new user with password
    const result = await query(
      'INSERT INTO users (nickname, email, password_hash, language) VALUES ($1, $2, $3, $4) RETURNING *',
      [nickname, email, passwordHash, language]
    );

    const user = result.rows[0];

    // Generate session token
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token: sessionToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        avatar_url: user.avatar_url,
        total_points: user.total_points,
        is_admin: user.is_admin,
        pitwall_access: user.pitwall_access ?? false,
        language: user.language ?? null
      }
    });
  } catch (error) {
    console.error('Password registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

// Self-service email change — requires the current password since email
// doubles as the login identifier.
export const changeEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ error: 'New email and current password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'No password set for this account. Please contact an admin.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail, userId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'That email is already in use' });
    }

    await query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, userId]);

    res.json({ message: 'Email updated successfully', email: newEmail });
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ error: 'Failed to change email' });
  }
};

// Self-service nickname change. Nickname is read live from users everywhere
// (leaderboard, predictions, emails), so there is nothing else to update.
export const changeNickname = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const newNickname = typeof req.body?.newNickname === 'string' ? req.body.newNickname.trim() : '';

    if (newNickname.length < 2 || newNickname.length > 30) {
      return res.status(400).json({ error: 'Username must be between 2 and 30 characters' });
    }
    if (!/^[\p{L}\p{N} ._'-]+$/u.test(newNickname)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, spaces and . _ ' -" });
    }

    const taken = await query(
      'SELECT id FROM users WHERE LOWER(nickname) = LOWER($1) AND id != $2',
      [newNickname, userId]
    );
    if (taken.rows.length > 0) {
      return res.status(400).json({ error: 'That username is already taken' });
    }

    const updated = await query('UPDATE users SET nickname = $1 WHERE id = $2', [newNickname, userId]);
    if (updated.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Username updated successfully', nickname: newNickname });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(400).json({ error: 'That username is already taken' });
    }
    console.error('Change nickname error:', error);
    res.status(500).json({ error: 'Failed to change username' });
  }
};

// Saves the player's preferred site language so it follows them to every device.
export const changeLanguage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const language = req.body?.language;

    if (language !== 'en' && language !== 'nl') {
      return res.status(400).json({ error: 'Language must be en or nl' });
    }

    const updated = await query('UPDATE users SET language = $1 WHERE id = $2', [language, userId]);
    if (updated.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ language });
  } catch (error) {
    console.error('Change language error:', error);
    res.status(500).json({ error: 'Failed to save language' });
  }
};

// Step 1 of a password reset. Always answers the same way, and answers before
// doing any lookup, so neither the response nor its timing reveals whether an
// email has an account.
export const forgotPassword = async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  res.json({ message: 'If that email belongs to an account, a reset link is on its way.' });

  try {
    const result = await query(
      'SELECT id, nickname, email, password_hash, language FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (result.rows.length === 0) return;
    const user = result.rows[0];

    const last = resetMailCooldown.get(user.id) || 0;
    if (Date.now() - last < RESET_MAIL_COOLDOWN_MS) return;
    resetMailCooldown.set(user.id, Date.now());

    const token = jwt.sign(
      { userId: user.id, purpose: 'reset', fp: passwordFingerprint(user.password_hash) },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendPasswordReset(user.email, user.nickname, resetUrl, user.language);
  } catch (error: any) {
    // Never log the token or the link.
    console.error('Forgot password error:', error?.message || error);
  }
};

// Step 2: the emailed link brings the player to /reset-password, which posts
// the token here with the new password.
export const resetPassword = async (req: Request, res: Response) => {
  const invalid = { error: 'This reset link is invalid or has expired. Please request a new one.' };

  try {
    const { token, newPassword } = req.body || {};
    if (typeof token !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return res.status(400).json(invalid);
    }
    if (payload?.purpose !== 'reset' || !payload.userId || typeof payload.fp !== 'string') {
      return res.status(400).json(invalid);
    }

    const result = await query('SELECT id, password_hash FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) return res.status(400).json(invalid);
    const user = result.rows[0];

    const expected = Buffer.from(passwordFingerprint(user.password_hash));
    const given = Buffer.from(payload.fp);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      return res.status(400).json(invalid);
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    // Compare-and-set on the old hash so two simultaneous uses of one link
    // can't both succeed.
    const updated = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash IS NOT DISTINCT FROM $3',
      [newHash, user.id, user.password_hash]
    );
    if (updated.rowCount === 0) return res.status(400).json(invalid);

    res.json({ message: 'Password updated. You can log in with it now.' });
  } catch (error: any) {
    console.error('Reset password error:', error?.message || error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

// Self-service account deletion — requires the current password, and
// mirrors the admin panel's rule that an admin account can't be deleted
// this way (an admin removes it from the Pitlane instead).
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete your account' });
    }

    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    if (user.is_admin) {
      return res.status(400).json({ error: "Admin accounts can't be self-deleted. Ask another admin to remove it." });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'No password set for this account. Please contact an admin.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Cascade deletes the user's predictions and sprint_predictions too.
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

// Password-based login
export const loginWithPassword = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user has a password set
    if (!user.password_hash) {
      return res.status(400).json({
        error: 'No password set for this account. Please contact an admin.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate session token
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token: sessionToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        avatar_url: user.avatar_url,
        total_points: user.total_points,
        is_admin: user.is_admin,
        pitwall_access: user.pitwall_access ?? false,
        language: user.language ?? null
      }
    });
  } catch (error) {
    console.error('Password login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// Simple standalone confirmation page — this is opened directly from an
// email link, not the app, so it can't rely on the React frontend.
const unsubscribePage = (lang: EmailLang, messageKey: EmailKey, ok: boolean) => `
  <!DOCTYPE html>
  <html lang="${lang}">
    <head><meta charset="utf-8" /><title>Poule Position</title></head>
    <body style="font-family: Arial, sans-serif; background: #121012; color: #fff; margin: 0; padding: 60px 20px; text-align: center;">
      <h1 style="color: #FFD81A; margin-bottom: 16px;">Poule Position</h1>
      <p style="font-size: 16px; max-width: 420px; margin: 0 auto;">${et(lang, messageKey)}</p>
      ${ok ? `<p style="margin-top: 24px;"><a href="${process.env.FRONTEND_URL}" style="color: #2596C7;">${et(lang, 'unsub.back')}</a></p>` : ''}
    </body>
  </html>
`;

// One-click unsubscribe from admin broadcast/announcement emails — reached
// directly from a mail client, so it's a public GET with no auth header,
// gated only by the signed token embedded in the link.
export const unsubscribe = async (req: Request, res: Response) => {
  // Until we know who this is, go by the browser's language.
  // (Express treats a missing header as "accepts anything", so check it exists.)
  const requestLang: EmailLang =
    req.headers['accept-language'] && req.acceptsLanguages('nl', 'en') === 'nl' ? 'nl' : 'en';
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).send(unsubscribePage(requestLang, 'unsub.invalid', false));
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return res.status(400).send(unsubscribePage(requestLang, 'unsub.expired', false));
    }

    if (payload.purpose !== 'unsubscribe' || !payload.userId) {
      return res.status(400).send(unsubscribePage(requestLang, 'unsub.invalid', false));
    }

    const updated = await query('UPDATE users SET email_opt_out = TRUE WHERE id = $1 RETURNING language', [payload.userId]);
    // The player's saved language wins once we know who they are.
    const lang = updated.rows[0]?.language ? normalizeLang(updated.rows[0].language) : requestLang;
    res.send(unsubscribePage(lang, 'unsub.done', true));
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).send(unsubscribePage(requestLang, 'unsub.error', false));
  }
};

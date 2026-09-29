import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../config/database';

const SALT_ROUNDS = 10;

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
      'INSERT INTO users (nickname, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [nickname, email, passwordHash]
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
        is_admin: user.is_admin
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
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Password login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

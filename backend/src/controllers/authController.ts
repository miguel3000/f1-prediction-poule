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

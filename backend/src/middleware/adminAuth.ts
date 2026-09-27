import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

// Admin access is now tied to a real user account's is_admin flag, checked
// against the same session JWT used for the regular site login — no more
// separate admin username/password prompt on top of an existing login.
export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; email: string };

    const result = await query('SELECT is_admin FROM users WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    (req as any).userId = decoded.userId;
    (req as any).userEmail = decoded.email;

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

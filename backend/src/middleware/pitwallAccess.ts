import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

// Pit Wall access is a per-player flag the admin grants (admins always have it).
// The flag is checked against the database on every request, never taken from
// the token, so revoking access or deleting an account takes effect immediately.
export const authenticatePitwall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET!) as {
      userId: number;
      email: string;
      purpose?: string;
    };
    if (decoded.purpose) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const result = await query('SELECT pitwall_access, is_admin FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0 || !(result.rows[0].pitwall_access || result.rows[0].is_admin)) {
      return res.status(403).json({ error: 'You do not have Pit Wall access' });
    }

    (req as any).userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

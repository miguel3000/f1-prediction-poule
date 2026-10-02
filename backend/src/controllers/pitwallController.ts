import { Request, Response } from 'express';
import { query } from '../config/database';

const KINDS = ['idea', 'implementation'];
const MAX_PENDING_PER_USER = 10;
const MAX_PER_DAY_PER_USER = 20;

// Every query here is scoped by the caller's own user id taken from the
// verified token — a player never sees anyone else's ideas, nor the admin's.
const IDEA_COLUMNS = 'id, kind, title, description, status, admin_note, created_at, decided_at';

export const listMyIdeas = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const result = await query(
      `SELECT ${IDEA_COLUMNS} FROM pitwall_ideas WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List pit wall ideas error:', error);
    res.status(500).json({ error: 'Failed to load your ideas' });
  }
};

export const createIdea = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: 'Choose whether this is an idea or an implementation' });
    }
    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({ error: 'Title must be between 3 and 200 characters' });
    }
    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description can be at most 2000 characters' });
    }

    const counts = await query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS today
       FROM pitwall_ideas WHERE user_id = $1`,
      [userId]
    );
    if (Number(counts.rows[0].pending) >= MAX_PENDING_PER_USER) {
      return res.status(429).json({ error: `You already have ${MAX_PENDING_PER_USER} ideas waiting for review` });
    }
    if (Number(counts.rows[0].today) >= MAX_PER_DAY_PER_USER) {
      return res.status(429).json({ error: 'Daily limit reached, please try again tomorrow' });
    }

    const result = await query(
      `INSERT INTO pitwall_ideas (user_id, kind, title, description)
       VALUES ($1, $2, $3, $4)
       RETURNING ${IDEA_COLUMNS}`,
      [userId, kind, title, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create pit wall idea error:', error);
    res.status(500).json({ error: 'Failed to save your idea' });
  }
};

// Players can take back an idea only while it is still waiting for review.
export const deleteMyPendingIdea = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid idea id' });

    const result = await query(
      `DELETE FROM pitwall_ideas WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Idea not found or already reviewed' });
    }
    res.json({ message: 'Idea removed' });
  } catch (error) {
    console.error('Delete pit wall idea error:', error);
    res.status(500).json({ error: 'Failed to remove the idea' });
  }
};

import { Request, Response } from 'express';
import { query } from '../config/database';
import { sendPitwallSubmitted } from '../services/emailService';

const KINDS = ['idea', 'implementation', 'message'];
const MAX_PENDING_PER_USER = 10;
const MAX_PER_DAY_PER_USER = 20;
const MAX_TEXT_LENGTH = 2000;
const MAX_MESSAGE_TITLE_LENGTH = 80;

// Every query here is scoped by the caller's own user id taken from the
// verified token — a player never sees anyone else's ideas, nor the admin's.
const IDEA_COLUMNS = 'id, kind, title, description, status, admin_note, created_at, decided_at';

// A message is one free text. Lists and the mail subject need a title, so it is the first line cut
// short; the full text is kept in the description unless the title already is the whole message.
// Cut by characters, not UTF-16 units, so an emoji is never split in half.
const messageParts = (text: string): { title: string; description: string } => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines[0].replace(/\s+/g, ' ').trim();
  const chars = Array.from(firstLine);
  const cut = chars.length > MAX_MESSAGE_TITLE_LENGTH;
  const title = cut ? chars.slice(0, MAX_MESSAGE_TITLE_LENGTH - 1).join('').trimEnd() + '…' : firstLine;
  return { title, description: lines.length === 1 && !cut ? '' : text };
};

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
    const rawDescription = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const isMessage = kind === 'message';

    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: 'Choose whether this is an idea, an implementation or a message' });
    }

    let title: string;
    let description: string;
    if (isMessage) {
      if (rawDescription.length < 3 || rawDescription.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ error: `Message must be between 3 and ${MAX_TEXT_LENGTH} characters` });
      }
      ({ title, description } = messageParts(rawDescription));
    } else {
      title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      description = rawDescription;
      if (title.length < 3 || title.length > 200) {
        return res.status(400).json({ error: 'Title must be between 3 and 200 characters' });
      }
      if (description.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ error: `Description can be at most ${MAX_TEXT_LENGTH} characters` });
      }
    }

    // Ideas and messages wait in separate lists, so ten ideas never block a report, or the other way round.
    const counts = await query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending' AND (kind = 'message') = $2) AS pending,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS today
       FROM pitwall_ideas WHERE user_id = $1`,
      [userId, isMessage]
    );
    if (Number(counts.rows[0].pending) >= MAX_PENDING_PER_USER) {
      return res.status(429).json({
        error: isMessage
          ? `You already have ${MAX_PENDING_PER_USER} messages waiting to be read`
          : `You already have ${MAX_PENDING_PER_USER} ideas waiting for review`,
      });
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

    // Tell the admin right away. The idea is already saved and the player has
    // their answer, so a mail problem is only logged.
    query('SELECT nickname FROM users WHERE id = $1', [userId])
      .then((owner) =>
        sendPitwallSubmitted({
          nickname: owner.rows[0]?.nickname || 'A player',
          kind,
          title,
          description,
        })
      )
      .catch((mailError) => console.error('Pit Wall submission notice failed:', mailError));
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

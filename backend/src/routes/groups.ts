import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createGroupHandler,
  myGroups,
  previewInvite,
  joinWithCode,
  renameGroupHandler,
  newLink,
  deleteGroupHandler,
  members,
  removeMemberHandler,
  leave,
} from '../controllers/groupController';
import { authenticate } from '../middleware/auth';

// A function so tests can build a router with fresh rate-limit counters.
export const createGroupRoutes = () => {
  const router = express.Router();

  // Invite codes cannot be guessed (192 bits); the limits just keep abuse cheap to stop.
  const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests. Please try again in a minute.' },
  });
  const joinLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests. Please try again in a minute.' },
  });

  // Fixed paths before the /:id ones
  router.get('/join/:code', previewLimiter, previewInvite); // no login: a friend sees the name first
  router.post('/join', authenticate, joinLimiter, joinWithCode);
  router.get('/mine', authenticate, myGroups);
  router.post('/', authenticate, createGroupHandler);

  router.patch('/:id', authenticate, renameGroupHandler);
  router.post('/:id/new-link', authenticate, newLink);
  router.delete('/:id', authenticate, deleteGroupHandler);
  router.get('/:id/members', authenticate, members);
  router.delete('/:id/members/:userId', authenticate, removeMemberHandler);
  router.post('/:id/leave', authenticate, leave);

  return router;
};

export default createGroupRoutes();

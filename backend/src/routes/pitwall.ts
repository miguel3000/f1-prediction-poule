import express from 'express';
import { listMyIdeas, createIdea, deleteMyPendingIdea } from '../controllers/pitwallController';
import { authenticatePitwall } from '../middleware/pitwallAccess';

const router = express.Router();

// Players with Pit Wall access: their own ideas only
router.get('/ideas', authenticatePitwall, listMyIdeas);
router.post('/ideas', authenticatePitwall, createIdea);
router.delete('/ideas/:id', authenticatePitwall, deleteMyPendingIdea);

export default router;

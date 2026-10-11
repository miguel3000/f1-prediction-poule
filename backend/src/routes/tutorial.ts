import express from 'express';
import { getTutorialExample } from '../controllers/tutorialController';

const router = express.Router();

// Public: the Tutorial page is readable without an account
router.get('/example', getTutorialExample);

export default router;

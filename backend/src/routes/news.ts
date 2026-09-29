import express from 'express';
import { getNews } from '../controllers/newsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, getNews);

export default router;

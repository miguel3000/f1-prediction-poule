import { Request, Response } from 'express';
import { getLatestNews } from '../services/newsService';

export const getNews = async (req: Request, res: Response) => {
  try {
    const items = await getLatestNews();
    res.json(items);
  } catch (error) {
    console.error('Get news error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
};

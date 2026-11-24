import { Router, Request, Response } from 'express';
import { loadSeoContent, renderLlmsFullTxt, renderLlmsTxt, SeoContent } from '../utils/seoContent';

// /llms.txt (a short index of the public pages) and /llms-full.txt (their text in one file) for language
// models; see utils/seoContent.ts. Both come from the same seo-content.json as the page text, so they
// cannot drift from the site. Without that file (an old build) they are a plain 404.
export const llmsRouter = (frontendDir: string): Router => {
  const router = Router();
  const serve = (render: (content: SeoContent) => string) => (_req: Request, res: Response) => {
    const content = loadSeoContent(frontendDir);
    if (!content) return res.status(404).type('text/plain').send('Not found');
    res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(render(content));
  };
  router.get('/llms.txt', serve(renderLlmsTxt));
  router.get('/llms-full.txt', serve(renderLlmsFullTxt));
  return router;
};

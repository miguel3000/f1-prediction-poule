import { Request, Response } from 'express';
import { PreviewDeps, previewStatus, sendRacePreviewTest, setAuto } from '../services/racePreviewService';

// Pitlane side of the Thursday race weekend preview: whether it sends by itself, what is due, and a
// test mail to the owner's own account. There is deliberately no "send to everyone" button: that is
// the hourly job, or the script run by hand.
export const createRacePreviewHandlers = (deps: PreviewDeps = {}) => {
  const getRacePreview = async (_req: Request, res: Response) => {
    try {
      res.json(await previewStatus(deps));
    } catch (error) {
      console.error('Get race preview error:', error);
      res.status(500).json({ error: 'Failed to load the race weekend preview' });
    }
  };

  const setRacePreviewSwitch = async (req: Request, res: Response) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be true or false' });
    try {
      await setAuto(enabled);
      res.json(await previewStatus(deps));
    } catch (error) {
      console.error('Set race preview switch error:', error);
      res.status(500).json({ error: 'Failed to change the race weekend preview switch' });
    }
  };

  // The preview as the owner would get it, to the owner's own account address, recorded nowhere
  const testRacePreview = async (req: Request, res: Response) => {
    try {
      const result = await sendRacePreviewTest({ userId: (req as any).userId }, deps);
      if (!result) return res.status(404).json({ error: 'No race starts within the next days, so there is nothing to preview' });
      res.json(result);
    } catch (error) {
      console.error('Test race preview error:', error);
      res.status(500).json({ error: 'The test mail could not be sent' });
    }
  };

  return { getRacePreview, setRacePreviewSwitch, testRacePreview };
};

export const { getRacePreview, setRacePreviewSwitch, testRacePreview } = createRacePreviewHandlers();

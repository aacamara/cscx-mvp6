import { Router, Request, Response } from 'express';

const router = Router();

// Agent bypass login — development only
router.post('/agent-login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { token } = req.body;
  if (token !== process.env.AGENT_BYPASS_TOKEN) {
    return res.status(401).json({ error: 'Invalid agent token' });
  }

  res.json({
    success: true,
    workspace: {
      id: 'demo-workspace',
      name: 'CSCX Demo',
      role: 'csm'
    },
    user: {
      id: 'agent-scout-csm',
      email: 'scout@cscx.ai',
      role: 'csm'
    }
  });
});

export default router;

import { getStatus } from '../../lib/geminiHandlers';
import type { VercelReq, VercelRes } from '../../lib/vercelWrap';

export default function handler(_req: VercelReq, res: VercelRes) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(getStatus());
}

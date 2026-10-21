import { getStatus } from '../../lib/geminiHandlers.js';
import { replyJson, type VercelReq, type VercelRes } from '../../lib/vercelWrap.js';

export default function handler(_req: VercelReq, res: VercelRes) {
  try {
    return replyJson(res, 200, getStatus());
  } catch (err: any) {
    console.error(err);
    return replyJson(res, 500, { error: err?.message || 'Internal Server Error' });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { records } from './data';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).end('Method Not Allowed');
  }
  const missionId = String(req.query.missionId);
  const idx = records.findIndex(r => r.submission_id === missionId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Not found' });
  }
  records[idx] = { ...records[idx], ...req.body };
  return res.status(200).json(records[idx]);
}

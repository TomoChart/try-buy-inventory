import type { NextApiRequest, NextApiResponse } from 'next';
import { records, TryBuyRecord, upsertRecords } from './data';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(records);
  }
  if (req.method === 'POST') {
    const items = req.body?.items as TryBuyRecord[] | undefined;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array required' });
    }
    upsertRecords(items);
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const ids = req.body?.missionIds as string[] | undefined;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'missionIds array required' });
    }
    let deleted = 0;
    ids.forEach(id => {
      const idx = records.findIndex(r => r.submission_id === id);
      if (idx !== -1) { records.splice(idx, 1); deleted++; }
    });
    return res.status(200).json({ deleted });
  }
  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end('Method Not Allowed');
}

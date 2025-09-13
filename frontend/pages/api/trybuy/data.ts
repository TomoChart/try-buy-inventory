export interface TryBuyRecord {
  submission_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  pickup_city: string;
  created_at: string | null;
  contacted: 'Yes' | 'No' | '';
  handover_at: string | null;
  days_left: string;
  model: 'Fold7' | 'Watch8' | '';
  serial: string;
  note: string;
}

export let records: TryBuyRecord[] = [];

export function upsertRecords(list: TryBuyRecord[]) {
  list.forEach(r => {
    const idx = records.findIndex(x => x.submission_id === r.submission_id);
    if (idx === -1) records.push(r);
    else records[idx] = { ...records[idx], ...r };
  });
}

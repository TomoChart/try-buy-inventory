import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '../../components/AppLayout';
import type { TryBuyRecord } from '../api/trybuy/data';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return formatDate(v);
  if (typeof v === 'string') {
    if (v.includes('-')) {
      const parts = v.split('-');
      if (parts[0].length === 2) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      if (parts[0].length === 4) return v;
    }
    const d = new Date(v);
    if (!isNaN(d.getTime())) return formatDate(d);
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return formatDate(new Date(d.y, d.m - 1, d.d));
  }
  return null;
}

export default function TryAndBuyPage() {
  const [data, setData] = useState<TryBuyRecord[]>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);

  const fetchData = () => {
    fetch('/api/trybuy')
      .then(r => r.json())
      .then((d: TryBuyRecord[]) => setData(d));
  };

  useEffect(fetchData, []);

  const save = useCallback(async (id: string, field: keyof TryBuyRecord, value: any) => {
    const prev = [...data];
    setData(d => d.map(r => r.submission_id === id ? { ...r, [field]: value } : r));
    try {
      const res = await fetch(`/api/trybuy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error();
      toast.success('Saved');
    } catch {
      toast.error('Error saving');
      setData(prev);
    }
  }, [data]);

  const validate = useCallback((field: keyof TryBuyRecord, value: any) => {
    if (field === 'created_at' || field === 'handover_at') {
      if (!value) return true;
      return !isNaN(new Date(value as string).getTime());
    }
    if (field === 'contacted') return ['Yes', 'No', ''].includes(value);
    if (field === 'model') return ['Fold7', 'Watch8', ''].includes(value);
    return true;
  }, []);

  const EditableText: React.FC<{ initial: string; onSave: (v: string) => void }> = ({ initial, onSave }) => {
    const [val, setVal] = useState(initial);
    useEffect(() => setVal(initial), [initial]);
    return (
      <input
        className="p-1 border w-full"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave(val);
          if (e.key === 'Escape') setVal(initial);
        }}
      />
    );
  };

  const fields: { key: keyof TryBuyRecord; header: string; type?: string; options?: string[] }[] = useMemo(() => [
    { key: 'first_name', header: 'first_name' },
    { key: 'last_name', header: 'last_name' },
    { key: 'email', header: 'email' },
    { key: 'phone', header: 'phone' },
    { key: 'address', header: 'address' },
    { key: 'city', header: 'city' },
    { key: 'postal_code', header: 'postal_code' },
    { key: 'pickup_city', header: 'pickup_city' },
    { key: 'created_at', header: 'created_at', type: 'date' },
    { key: 'contacted', header: 'contacted', type: 'select', options: ['Yes', 'No'] },
    { key: 'handover_at', header: 'handover_at', type: 'date' },
    { key: 'days_left', header: 'days_left' },
    { key: 'model', header: 'model', type: 'select', options: ['Fold7', 'Watch8'] },
    { key: 'serial', header: 'serial' },
    { key: 'note', header: 'note' }
  ], []);

  const fieldMap: Record<string, typeof fields[number]> = {};
  fields.forEach(f => { fieldMap[f.key] = f; });

  const columns = useMemo<ColumnDef<TryBuyRecord>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input type="checkbox" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />
      ),
      cell: ({ row }) => (
        <input type="checkbox" checked={row.getIsSelected()} disabled={!row.getCanSelect()} onChange={row.getToggleSelectedHandler()} />
      )
    },
    ...fields.map(f => ({
      accessorKey: f.key,
      header: f.header,
      cell: info => {
        const field = f.key;
        const v = info.getValue() as any;
        if (f.type === 'date') {
          const dateValue = v ? new Date(v) : null;
          return (
            <DatePicker
              selected={dateValue}
              onChange={d => {
                const val = d ? formatDate(d) : null;
                if (!validate(field, val)) { toast.error('Invalid date'); return; }
                save(info.row.original.submission_id, field, val);
              }}
              dateFormat="yyyy-MM-dd"
              className="p-1 border w-40"
            />
          );
        }
        if (f.type === 'select' && f.options) {
          return (
            <select
              className="p-1 border"
              value={v || ''}
              onChange={e => {
                const val = e.target.value;
                if (!validate(field, val)) { toast.error('Invalid'); return; }
                save(info.row.original.submission_id, field, val);
              }}
            >
              <option value=""></option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          );
        }
        return (
          <EditableText
            initial={v || ''}
            onSave={val => {
              if (!validate(field, val)) { toast.error('Invalid'); return; }
              if (val !== (v || '')) {
                save(info.row.original.submission_id, field, val);
              }
            }}
          />
        );
      }
    }))
  ], [fields, save, validate]);

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection, columnFilters, sorting },
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  const deleteSelected = async () => {
    const ids = table.getSelectedRowModel().rows.map(r => r.original.submission_id);
    if (!ids.length) return;
    if (!confirm('Delete selected?')) return;
    const prev = [...data];
    setData(d => d.filter(r => !ids.includes(r.submission_id)));
    try {
      const res = await fetch('/api/trybuy', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionIds: ids })
      });
      if (!res.ok) throw new Error();
      toast.success('Deleted');
      setRowSelection({});
    } catch {
      toast.error('Error deleting');
      setData(prev);
    }
  };

  const mergeById = (existing: TryBuyRecord[], incoming: TryBuyRecord[]) => {
    const map = new Map(existing.map(r => [r.submission_id, r]));
    incoming.forEach(r => {
      const norm = { ...r, created_at: normalizeDate(r.created_at), handover_at: normalizeDate(r.handover_at) };
      if (map.has(r.submission_id)) Object.assign(map.get(r.submission_id)!, norm);
      else map.set(r.submission_id, norm);
    });
    return Array.from(map.values());
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet);
    const parsed: TryBuyRecord[] = json.map(r => ({
      submission_id: String(r['submission_id']),
      first_name: r['first_name'] || '',
      last_name: r['last_name'] || '',
      email: r['email'] || '',
      phone: r['phone'] || '',
      address: r['address'] || '',
      city: r['city'] || '',
      postal_code: r['postal_code'] || '',
      pickup_city: r['pickup_city'] || '',
      created_at: normalizeDate(r['created_at']),
      contacted: r['contacted'] === 'Yes' ? 'Yes' : r['contacted'] === 'No' ? 'No' : '',
      handover_at: normalizeDate(r['handover_at']),
      days_left: String(r['days_left'] || ''),
      model: r['model'] === 'Fold7' ? 'Fold7' : r['model'] === 'Watch8' ? 'Watch8' : '',
      serial: r['serial'] || '',
      note: r['note'] || ''
    }));
    const merged = mergeById(data, parsed);
    setData(merged);
    await fetch('/api/trybuy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: parsed })
    });
    toast.success('Imported');
    e.target.value = '';
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-semibold mb-3">Try &amp; Buy</h1>
      <div className="mb-2 flex gap-2 items-center">
        <input type="file" accept=".xlsx" onChange={handleImport} />
        {table.getSelectedRowModel().rows.length > 0 && (
          <button onClick={deleteSelected} className="bg-red-500 text-white px-2 py-1">Delete selected</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="border px-2 py-1">
                    {header.isPlaceholder ? null : (
                      <div onClick={header.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? ' \u2191' : header.column.getIsSorted() === 'desc' ? ' \u2193' : ''}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
            <tr>
              {table.getHeaderGroups()[0].headers.map(header => {
                if (header.id === 'select') return <th key={header.id} />;
                const f = fieldMap[header.id];
                if (f?.type === 'select' && f.options) {
                  return (
                    <th key={header.id} className="border px-2 py-1">
                      <select
                        className="p-1 border"
                        value={(header.column.getFilterValue() as string) ?? ''}
                        onChange={e => header.column.setFilterValue(e.target.value)}
                      >
                        <option value=""></option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </th>
                  );
                }
                return (
                  <th key={header.id} className="border px-2 py-1">
                    <input
                      className="p-1 border"
                      value={(header.column.getFilterValue() as string) ?? ''}
                      onChange={e => header.column.setFilterValue(e.target.value)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-slate-100">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="border px-2 py-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center mt-2">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="border px-2 py-1">Prev</button>
        <span>{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border px-2 py-1">Next</button>
        <select
          className="border p-1"
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
        >
          {[50, 100].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
    </AppLayout>
  );
}

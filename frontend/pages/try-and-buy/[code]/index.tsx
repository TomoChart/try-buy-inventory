import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import withAuth from "../../../components/withAuth";
import HomeButton from "../../../components/HomeButton";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnDef,
  RowData,
  Column,
} from "@tanstack/react-table";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { API, getToken } from "../../../lib/auth";
import { z } from "zod";
import toast, { Toaster } from "react-hot-toast";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}


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
  contacted: "Yes" | "No" | "";
  handover_at: string | null;
  model: "Fold7" | "Watch8" | "";
  serial: string;
  note: string;
  returned?: boolean;
  feedback?: string;
}

const recordSchema = z.object({
  submission_id: z.string(),
  first_name: z.string().optional().or(z.literal("")),
  last_name: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  postal_code: z.string().optional().or(z.literal("")),
  pickup_city: z.string().optional().or(z.literal("")),
  created_at: z.string().nullable().refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  }),
  contacted: z.enum(["Yes", "No", ""]).default(""),
  handover_at: z.string().nullable().refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  }),
  model: z.enum(["Fold7", "Watch8", ""]).default(""),
  serial: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
  returned: z.boolean().optional(),
  feedback: z.string().optional().or(z.literal("")),
});

const toDateString = (d: Date | null) => {
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateString = (s: string | null) => {
  if (!s) return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`);
  return null;
};

const calcDaysLeft = (handover: string | null, returned?: boolean) => {
  if (!handover || returned) return "";
  const d = parseDateString(handover);
  if (!d) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  const left = 14 - diff;
  return String(left);
};

// === NOVI HELPER: normalizeBackendRow ===
const normalizeBackendRow = (r: any): TryBuyRecord => {
  const toYmd = (v: any): string | null => {
    if (!v) return null;
    const d = typeof v === "string" ? parseDateString(v) : new Date(v);
    return d && !isNaN(d.getTime()) ? toDateString(d) : null;
  };

  return {
    submission_id: r["Submission ID"] ?? r.submission_id ?? "",
    first_name:    r["First Name"]    ?? r.first_name    ?? "",
    last_name:     r["Last Name"]     ?? r.last_name     ?? "",
    email:         r["Email"]         ?? r.email         ?? "",
    phone:         r["Phone"]         ?? r.phone         ?? "",
    address:       r["Address"]       ?? r.address       ?? "",
    city:          r["City"]          ?? r.city          ?? "",
    postal_code:   r["Postal Code"]   ?? r.postal_code   ?? "",
    pickup_city:   r["Pickup City"]   ?? r.pickup_city   ?? "",
    created_at:    toYmd(r["Created At"] ?? r.created_at ?? null),
    contacted:     (r["Contacted At"] ?? r.contacted) ? "Yes" : "",
    handover_at:   toYmd(r["Handover At"] ?? r.handover_at ?? null),
    model:         r["Model"]         ?? r.model         ?? "",
    serial:        r["Serial"]        ?? r.serial        ?? "",
    note:          r["Note"]          ?? r.note          ?? "",
    returned:      Boolean(r.returned),
    feedback:      r.feedback ?? ""
  };
};

// === NOVO: helper za mapiranje UI reda u import payload ===
type ImportRow = {
  submission_id?: string | null;
  email?: string | null;
  phone?: string | null;
  pickup_city?: string | null;
  contacted?: string | null; // ISO ili null
  handover_at?: string | null;  // ISO ili null
  model?: string | null;
  serial?: string | null;
  note?: string | null;
};

const mapUiToImportRow = (r: TryBuyRecord): ImportRow => {
  const d = (s: string | null) => {
    if (!s) return null;
    // UI koristi "YYYY-MM-DD"; backend smije primiti ISO @ 00:00:00Z
    return `${s}T00:00:00.000Z`;
  };
  return {
    submission_id: r.submission_id || null,
    email: r.email || null,
    phone: r.phone || null,
    pickup_city: r.pickup_city || null,
    contacted: r.contacted || null,
    handover_at: d(r.handover_at ?? null),
    model: r.model || null,
    serial: r.serial || null,
    note: r.note || null,
  };
};

// === NOVO: funkcija za import u backend ===
async function importToBackend(country: string, rows: TryBuyRecord[]) {
  const token = getToken();
  if (!token) throw new Error("No token");

 const payload = {
  mode: "upsert",
  rows: rows.map(mapUiToImportRow).filter(r => r.email || r.phone || r.serial),
};

  const res = await fetch(`${API}/admin/galaxy-try/${String(country).toUpperCase()}/import?mode=upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `Import failed (${res.status})`);
  }
  return data; // očekujemo { inserted, updated, skipped } ili slično
}

function TryAndBuyPage() {
  const router = useRouter();
  const { code } = router.query as { code?: string };
  const country = String(code || "hr").toLowerCase();
  const [data, setData] = useState<TryBuyRecord[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!country) return;
    const load = async () => {
      try {
        const token = getToken();
        if (!token) { toast.error("Session expired. Login again."); return; }
        const code = String(country).toUpperCase(); // HR / SI / RS
        const res = await fetch(`${API}/admin/galaxy-try/${code}/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        const raw = await res.json();
        const mapped: TryBuyRecord[] = Array.isArray(raw) ? raw.map(normalizeBackendRow) : [];
        setData(mapped);
      } catch (e) {
        toast.error("Failed to load data");
      }
    };
    load();
  }, [country]);

  const w30 = "w-[30ch]";
  const w25 = "w-[25ch]";
  const w22 = "w-[22ch]";
  const w20 = "w-[20ch]";
  const w12 = "w-[12ch]";
  const w10 = "w-[10ch]";
  const w6 = "w-[6ch]";

  const col = (
    key: keyof TryBuyRecord,
    width: string,
    cell?: any,
    title?: string,
    noWrap?: boolean
  ): ColumnDef<TryBuyRecord> => ({
    accessorKey: key,
    header: ({ column }) => (
      <ColumnHeader column={column} title={title || key} />
    ),
    cell: cell ?? EditableCell,
    meta: {
      className: `${width} ${
        noWrap ? "whitespace-nowrap" : "whitespace-pre-wrap break-words"
      }`,
    },
  });

  const columns = useMemo<ColumnDef<TryBuyRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        meta: { className: "w-[2ch]" },
      },
      col("first_name", w12),
      col("last_name", w12),
      col("email", w30, undefined, undefined, true),
      col("phone", w20),
      col("address", w25),
      col("city", w10),
      col("postal_code", w6),
      col("pickup_city", w10),
      col("created_at", w12, DateCell),
      col("contacted", w12, SelectCell(["", "Yes", "No"])),
      col("handover_at", w12, DateCell),
      {
        id: "days_left",
        header: ({ column }) => <ColumnHeader column={column} title="days_left" />,
        cell: ({ row }) =>
          calcDaysLeft(row.original.handover_at, row.original.returned),
        meta: { className: "w-[6ch]" },
      },
      col("model", w12, SelectCell(["", "Fold7", "Watch8"])),
      col("serial", w12),
      col("note", w22),
      {
        accessorKey: "returned",
        header: ({ column }) => (
          <ColumnHeader column={column} title="returned" />
        ),
        cell: ({ getValue, row, column, table }) => {
          const v = getValue() as boolean | undefined;
          return (
            <input
              type="checkbox"
              checked={!!v}
              onChange={(e) =>
                table.options.meta?.updateData(
                  row.index,
                  column.id,
                  e.target.checked
                )
              }
            />
          );
        },
        meta: { className: "w-[6ch]" },
      },
      col("feedback", w30, EditableCell, "user_feedback"),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    meta: {
      async updateData(rowIndex, columnId, value) {
        // Optimistic update u UI
        setData((old) => {
          const next = [...old];
          next[rowIndex] = { ...next[rowIndex], [columnId]: value } as TryBuyRecord;
          return next;
        });

        try {
          const rec = data[rowIndex];
          const submissionId = rec?.submission_id || "";
          if (!submissionId) throw new Error("Missing submission_id");

          await patchTryBuyField(country, submissionId, columnId, value);
          toast.success("Saved");
        } catch (e: any) {
          toast.error(e?.message || "Save failed");
          // rollback nije nužan; po potrebi možemo refetchati cijeli popis
        }
      },
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const imported: TryBuyRecord[] = rows.map((r) => ({
        submission_id: String(r.submission_id ?? r.Submission_ID ?? ""),
        first_name: String(r.first_name ?? ""),
        last_name: String(r.last_name ?? ""),
        email: String(r.email ?? ""),
        phone: String(r.phone ?? ""),
        address: String(r.address ?? ""),
        city: String(r.city ?? ""),
        postal_code: String(r.postal_code ?? ""),
        pickup_city: String(r.pickup_city ?? ""),
        created_at: toDateString(parseDateString(String(r.created_at ?? ""))),
        contacted: r.contacted === "Yes" || r.contacted === "No" ? r.contacted : "",
        handover_at: toDateString(parseDateString(String(r.handover_at ?? ""))),
        model: r.model === "Fold7" || r.model === "Watch8" ? r.model : "",
        serial: String(r.serial ?? ""),
        note: String(r.note ?? ""),
        returned: false,
        feedback: "",
      }));

      setData((prev) => {
        const map = new Map<string, TryBuyRecord>();
        prev.forEach((p) => map.set(p.submission_id, p));
        imported.forEach((imp) => {
          if (map.has(imp.submission_id)) {
            if (!skipDuplicates) {
              map.set(imp.submission_id, { ...map.get(imp.submission_id)!, ...imp });
            }
          } else {
            map.set(imp.submission_id, imp);
          }
        });
        return Array.from(map.values());
      });
      fetch(`/api/trybuy/${country}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imported),
      }).catch(() => toast.error("Save failed"));
      toast.success("Import complete");
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  // Define load function to refetch data
  const load = async () => {
    try {
      const token = getToken();
      if (!token) { toast.error("Session expired. Login again."); return; }
      const codeUpper = String(country).toUpperCase(); // HR / SI / RS
      const res = await fetch(`${API}/admin/galaxy-try/${codeUpper}/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const raw = await res.json();
      const mapped: TryBuyRecord[] = Array.isArray(raw) ? raw.map(normalizeBackendRow) : [];
      setData(mapped);
    } catch (e) {
      toast.error("Failed to load data");
    }
  };

  const deleteSelected = async () => {
    const ids = table.getSelectedRowModel().rows.map(r => r.original.submission_id);
    if (!ids.length) return;

    // Optimistic UI: makni redove odmah
    setData(prev => prev.filter(r => !ids.includes(r.submission_id)));

    const token = getToken();
    const codeUpper = country.toUpperCase();

    try {
      // Backend očekuje pojedinačni DELETE: /admin/galaxy-try/:code/:submission_id
      await Promise.all(
        ids.map(id =>
          fetch(`${API}/admin/galaxy-try/${codeUpper}/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).then(res => {
            if (!res.ok && res.status !== 204) {
              return res.text().then(t => { throw new Error(t || `Delete failed (${res.status})`); });
            }
          })
        )
      );
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setRowSelection({});
      await load(); // refetch liste
    }
  };

  return (
    <div
      className="p-6 min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/Background galaxytry.jpg')" }}
    >
      <Toaster />
      <HomeButton />
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={deleteSelected}
          disabled={!table.getSelectedRowModel().rows.length}
          className="px-2 py-1 border rounded"
        >
          Delete Selected
        </button>
        <label className="flex items-center gap-2">
          <input type="file" accept=".xlsx" onChange={handleFile} />
          <span className="px-2 py-1 border rounded cursor-pointer bg-white text-black">Import</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
          />
          skip duplicates
        </label>
      </div>
      <div className="overflow-x-auto bg-gray-200/50 text-black">
        <table className="text-sm w-max">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`p-2 border-b text-left ${
                      header.column.columnDef.meta?.className || ""
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const left = Number(
                calcDaysLeft(row.original.handover_at, row.original.returned)
              );
              let rowClass = "";
              if (row.original.returned) rowClass = "bg-blue-200";
              else if (left === 1) rowClass = "bg-yellow-200";
              else if (left <= 0 && row.original.handover_at)
                rowClass = "bg-red-200";
              return (
                <tr key={row.id} className={`border-b ${rowClass}`}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`p-2 align-top ${
                        cell.column.columnDef.meta?.className || ""
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-2 py-1 border rounded"
        >
          Prev
        </button>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-2 py-1 border rounded"
        >
          Next
        </button>
        <span className="ml-4">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="ml-4 border p-1"
        >
          {[50, 100].map((size) => (
            <option key={size} value={size}>
              Show {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function EditableCell({ getValue, row, column, table }: any) {
  const initialValue = getValue() as string;
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  const onBlur = () =>
    table.options.meta?.updateData(row.index, column.id, value);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="p-1 w-full bg-transparent outline-none border-0"
      style={{ whiteSpace: "inherit" }}
      onInput={(e) => setValue((e.target as HTMLDivElement).innerText)}
      onBlur={onBlur}
    >
      {value}
    </div>
  );
}

function DateCell({ getValue, row, column, table }: any) {
  const initial = parseDateString(getValue());
  const [value, setValue] = useState<Date | null>(initial);
  useEffect(() => {
    setValue(initial);
  }, [initial]);
  const onChange = (d: Date | null) => {
    setValue(d);
  };
  const onBlur = () => table.options.meta?.updateData(row.index, column.id, toDateString(value));
  return (
    <DatePicker
      selected={value}
      onChange={onChange}
      onCalendarClose={onBlur}
      dateFormat="yyyy-MM-dd"
      className="p-1 bg-transparent border-0 outline-none w-full"
      placeholderText="YYYY-MM-DD"
    />
  );
}

function SelectCell(options: string[]) {
  return function SelectCellComponent({ getValue, row, column, table }: any) {
    const initialValue = getValue() as string;
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);
    const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setValue(e.target.value);
      table.options.meta?.updateData(row.index, column.id, e.target.value);
    };
    return (
      <select
        className="p-1 bg-transparent border-0 outline-none w-full"
        value={value}
        onChange={onChange}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  };
}

function ColumnHeader({
  column,
  title,
}: {
  column: Column<TryBuyRecord, unknown>;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1"
      >
        {title}
        <span className="text-xs">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-32 bg-white border rounded shadow z-10">
          <button
            className="block w-full px-2 py-1 text-left hover:bg-gray-100"
            onClick={() => {
              column.toggleSorting(false);
              setOpen(false);
            }}
          >
            Sort A–Z
          </button>
          <button
            className="block w-full px-2 py-1 text-left hover:bg-gray-100"
            onClick={() => {
              column.toggleSorting(true);
              setOpen(false);
            }}
          >
            Sort Z–A
          </button>
          <div className="px-2 py-1">
            <input
              type="text"
              value={(column.getFilterValue() ?? "") as string}
              onChange={(e) => column.setFilterValue(e.target.value)}
              className="w-full border p-1"
              placeholder="Filter"
            />
          </div>
        </div>
      )}
    </div>
  );
}

const toIsoDateOnlyOrNull = (s: string | null) => {
  if (!s) return null;
  // očekujemo "YYYY-MM-DD"; pretvaramo u ISO na 00:00:00Z
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return `${s}T00:00:00.000Z`;
};

const toIsoOrNull = (s: string | null) => {
  // koristi se za handover_at; ako dobije "YYYY-MM-DD" -> ISO @ 00:00:00Z
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

/** PATCH jedne izmjene na backend (partial payload) */
async function patchTryBuyField(countryCode: string, submissionId: string, field: string, value: unknown) {
  const token = getToken();
  if (!token) throw new Error("No token");

  // mapiranje polja iz tablice -> backend očekivanja
  let payload: any = {};
  if (field === "created_at") {
    payload.created_at = toIsoDateOnlyOrNull((value as string) || null);
  } else if (field === "handover_at") {
    payload.handover_at = value || null; // value treba biti "YYYY-MM-DD" ili null
  } else if (field === "contacted") {
    payload.contacted = value === "Yes" ? "Yes" : "";
  } else {
    // ostala polja šaljemo kako jesu (prazno -> null)
    payload[field] = (value === "" ? null : value);
  }

  const res = await fetch(`${API}/admin/galaxy-try/${countryCode.toUpperCase()}/${encodeURIComponent(submissionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  // backend vraća JSON ili error; 4xx/5xx bacamo s porukom
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && (data.error || data.message)) || "Save failed");
  return data;
}

export default withAuth(TryAndBuyPage, { roles: ["country_admin", "superadmin"] });

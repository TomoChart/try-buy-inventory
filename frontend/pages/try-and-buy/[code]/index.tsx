import React, { useEffect, useMemo, useState } from "react";
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
} from "@tanstack/react-table";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { z } from "zod";
import toast, { Toaster } from "react-hot-toast";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
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

function TryAndBuyPage() {
  const router = useRouter();
  const { code } = router.query as { code?: string };
  const country = String(code || "hr").toLowerCase();
  const [data, setData] = useState<TryBuyRecord[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(false);

  useEffect(() => {
    if (!country) return;
    fetch(`/api/trybuy/${country}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load data"));
  }, [country]);

  const columns = useMemo<ColumnDef<TryBuyRecord>[]>(
    () => [
      { accessorKey: "first_name", header: "first_name", cell: EditableCell },
      { accessorKey: "last_name", header: "last_name", cell: EditableCell },
      { accessorKey: "email", header: "email", cell: EditableCell },
      { accessorKey: "phone", header: "phone", cell: EditableCell },
      { accessorKey: "address", header: "address", cell: EditableCell },
      { accessorKey: "city", header: "city", cell: EditableCell },
      { accessorKey: "postal_code", header: "postal_code", cell: EditableCell },
      { accessorKey: "pickup_city", header: "pickup_city", cell: EditableCell },
      { accessorKey: "created_at", header: "created_at", cell: DateCell },
      { accessorKey: "contacted", header: "contacted", cell: SelectCell(["", "Yes", "No"]) },
      { accessorKey: "handover_at", header: "handover_at", cell: DateCell },
      {
        id: "days_left",
        header: "days_left",
        cell: ({ row }) => calcDaysLeft(row.original.handover_at, row.original.returned),
      },
      { accessorKey: "model", header: "model", cell: SelectCell(["", "Fold7", "Watch8"]) },
      { accessorKey: "serial", header: "serial", cell: EditableCell },
      { accessorKey: "note", header: "note", cell: EditableCell },
      {
        accessorKey: "returned",
        header: "returned",
        cell: ({ getValue, row, column, table }) => {
          const v = getValue() as boolean | undefined;
          return (
            <input
              type="checkbox"
              checked={!!v}
              onChange={(e) => table.options.meta?.updateData(row.index, column.id, e.target.checked)}
            />
          );
        },
      },
      { accessorKey: "feedback", header: "user_feedback", cell: EditableCell },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    meta: {
      updateData: (rowIndex: number, columnId: string, value: any) => {
        setData((old) => {
          const newData = [...old];
          const row = { ...newData[rowIndex], [columnId]: value } as TryBuyRecord;
          const validation = recordSchema.safeParse(row);
          if (!validation.success) {
            toast.error(validation.error.issues[0]?.message || "Validation error");
            return old;
          }
          newData[rowIndex] = row;
          const id = row.submission_id;
          fetch(`/api/trybuy/${country}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [columnId]: value }),
          }).catch(() => toast.error("Save failed"));
          return newData;
        });
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
      toast.success("Import complete");
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div
      className="p-6 min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/Background galaxytry.jpg')" }}
    >
      <Toaster />
      <HomeButton />
      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2">
          <input type="file" accept=".xlsx" onChange={handleFile} />
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
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm whitespace-nowrap">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="p-2 border-b text-left">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const left = Number(calcDaysLeft(row.original.handover_at, row.original.returned));
              let rowClass = "";
              if (row.original.returned) rowClass = "bg-blue-200";
              else if (left === 1) rowClass = "bg-yellow-200";
              else if (left <= 0 && row.original.handover_at) rowClass = "bg-red-200";
              return (
                <tr key={row.id} className={`border-b ${rowClass}`}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  const onBlur = () => table.options.meta?.updateData(row.index, column.id, value);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setValue(initialValue);
    }
  };
  return (
    <input
      className="p-1 w-full bg-transparent outline-none"
      value={value ?? ""}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
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
      className="p-1 bg-white border-0 outline-none"
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
      <select className="p-1 bg-white border-0 outline-none" value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  };
}

export default withAuth(TryAndBuyPage, { roles: ["country_admin", "superadmin"] });

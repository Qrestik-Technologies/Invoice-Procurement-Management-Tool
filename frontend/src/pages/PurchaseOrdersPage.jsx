import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, FileText, Loader2, X, Upload } from "lucide-react";
import toast from "react-hot-toast";

import {
  listPOs,
  parsePO,
  createPO,
  confirmPO,
  closePO,
  raiseInvoice,
  getPO,
  getInvoicesForPO,
} from "../api/purchaseOrders";

import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";

const STATUS_TABS = ["all", "draft", "active", "partially_invoiced", "fully_invoiced", "closed", "expired"];

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-blue-100 text-blue-700",
  partially_invoiced: "bg-amber-100 text-amber-700",
  fully_invoiced: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-700",
  expired: "bg-red-100 text-red-700",
};

const EMPTY_FORM = {
  po_number: "",
  customer_name: "",
  total_po_value: "",
  currency: "USD",
  po_date: "",
  expiry_date: "",
  notes: "",
};

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [parsing, setParsing] = useState(false);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", tab],
    queryFn: () => listPOs(tab === "all" ? undefined : { status: tab }),
  });

  const createMut = useMutation({
    mutationFn: createPO,
    onSuccess: () => {
      toast.success("Purchase order created");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      setForm(EMPTY_FORM);
      setShowNew(false);
    },
    onError: (e) => toast.error(e?.message || "Failed to create PO"),
  });

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const parsed = await parsePO(file);
      setForm((f) => ({ ...f, ...parsed }));
      toast.success("Fields auto-filled from document");
    } catch (e) {
      toast.error(e?.message || "Failed to parse document");
    } finally {
      setParsing(false);
    }
  };

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.po_number || !form.customer_name) {
      toast.error("PO Number and Customer are required");
      return;
    }
    createMut.mutate({
      ...form,
      total_po_value: Number(form.total_po_value || 0),
    });
  };

  const headers = ["PO #", "Customer", "Value", "Expiry", "Status", ""];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          eyebrow="QRESTIK TECHNOLOGIES"
          title="Purchase Orders"
          subtitle="Qrestik Technologies — Manage purchase orders & milestones"
        />
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setShowNew((s) => !s)}>
            <Plus className="w-4 h-4 mr-2" /> New Purchase Order
          </Button>
        </div>
      </div>

      {/* Inline create panel — appears at the top */}
      {showNew && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">New Purchase Order</h3>
            <button
              onClick={() => setShowNew(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Upload zone */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition">
            {parsing ? (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            ) : (
              <FileText className="w-6 h-6 text-gray-400" />
            )}
            <span className="mt-2 text-sm text-gray-500">
              Drop a PDF/DOCX to auto-fill fields below
            </span>
            <span className="mt-3 inline-flex items-center px-4 py-2 bg-blue-700 text-white text-sm rounded-lg">
              <Upload className="w-4 h-4 mr-2" /> Browse file
            </span>
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>

          {/* Form */}
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="PO #">
              <input className={inputCls} placeholder="PO-001" value={form.po_number} onChange={onChange("po_number")} />
            </Field>
            <Field label="Customer">
              <input className={inputCls} placeholder="Customer name" value={form.customer_name} onChange={onChange("customer_name")} />
            </Field>
            <Field label="Total Value">
              <input type="number" step="0.01" className={inputCls} placeholder="0.00" value={form.total_po_value} onChange={onChange("total_po_value")} />
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={form.currency} onChange={onChange("currency")}>
                <option>USD</option>
                <option>INR</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </Field>
            <Field label="PO Date">
              <input type="date" className={inputCls} value={form.po_date} onChange={onChange("po_date")} />
            </Field>
            <Field label="Expiry Date">
              <input type="date" className={inputCls} value={form.expiry_date} onChange={onChange("expiry_date")} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <input className={inputCls} placeholder="Optional" value={form.notes} onChange={onChange("notes")} />
              </Field>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                ) : (
                  "Create PO"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-full transition ${
              tab === t
                ? "bg-blue-700 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : pos.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No purchase orders yet. Click <span className="font-medium">New Purchase Order</span> to add one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="text-left font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{po.po_number}</td>
                  <td className="px-4 py-3 text-gray-700">{po.customer_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {po.currency || "USD"} {Number(po.total_po_value || po.total_value || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{po.expiry_date || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}`}>
                      {po.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-700 hover:underline">View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

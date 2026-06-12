import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, FileText, Loader2, X, Upload, CheckCircle2, Trash2, ArrowRight, Eye, Receipt } from "lucide-react";
import toast from "react-hot-toast";

import {
  listPOs,
  parsePO,
  createPO,
  getPO,
  raiseInvoice,
  updatePO,
} from "../api/purchaseOrders";

import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";

/* ─── Status config ────────────────────────────────────────────────────────── */
const STATUS_TABS = ["all", "draft", "active", "partially_invoiced", "fully_invoiced", "closed", "expired"];

const STATUS_COLORS = {
  draft:              "bg-gray-100 text-gray-700",
  active:             "bg-blue-100 text-blue-700",
  partially_invoiced: "bg-amber-100 text-amber-700",
  fully_invoiced:     "bg-emerald-100 text-emerald-700",
  closed:             "bg-slate-200 text-slate-700",
  expired:            "bg-red-100 text-red-700",
};

/* ─── Empty form ────────────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  po_number:            "",
  po_date:              "",
  payment_terms:        "",
  currency:             "USD",
  vendor_name:          "QRESTIK TECHNOLOGIES LLC",
  vendor_address:       "UMM HURRAIR",
  vendor_bank:          "RAKBANK",
  vendor_city:          "Dubai",
  customer_name:        "",
  customer_organization:"",
  customer_address:     "",
  customer_trn:         "",
  customer_phone:       "",
  customer_fax:         "",
  expiry_date:          "",
  delivery_date:        "",
  subtotal:             "",
  header_discount:      "0.00",
  vat_amount:           "0.00",
  vat_reversal:         "0.00",
  net_amount:           "",
  amount_in_words:      "",
  notes:                "",
  line_items: [],
};

const EMPTY_LINE = {
  description: "",
  qty:         "1",
  rate:        "",
  amount:      "",
  discount:    "0.00",
  taxable_amt: "",
  vat_pct:     "0",
  vat_amt:     "0.00",
  total_amt:   "",
};

const ic = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600";

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* ─── Line items table ──────────────────────────────────────────────────────── */
function LineItemsTable({ items, onChange, readOnly = false }) {
  const add = () => onChange([...items, { ...EMPTY_LINE }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  const update = (i, field, val) => {
    const next = items.map((row, idx) => {
      if (idx !== i) return row;
      const updated = { ...row, [field]: val };
      if (["qty", "rate", "discount", "vat_pct"].includes(field)) {
        const qty  = parseFloat(field === "qty"  ? val : updated.qty)  || 0;
        const rate = parseFloat(field === "rate" ? val : updated.rate) || 0;
        const disc = parseFloat(field === "discount" ? val : updated.discount) || 0;
        const vat  = parseFloat(field === "vat_pct"  ? val : updated.vat_pct)  || 0;
        const amt  = qty * rate;
        const taxable = amt - disc;
        const vat_amt = taxable * (vat / 100);
        updated.amount      = amt.toFixed(2);
        updated.taxable_amt = taxable.toFixed(2);
        updated.vat_amt     = vat_amt.toFixed(2);
        updated.total_amt   = (taxable + vat_amt).toFixed(2);
      }
      return updated;
    });
    onChange(next);
  };

  const subtotal = items.reduce((s, r) => s + (parseFloat(r.total_amt) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Line Items</p>
        {!readOnly && (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            <Plus className="h-3 w-3" /> Add Row
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {["Sr.", "Item / Description", "Qty", "Rate", "Amount", "Discount", "Taxable Amt", "VAT %", "VAT Amt", "Total Amt", ""].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-5 text-center text-sm text-gray-400">No line items yet.</td>
              </tr>
            )}
            {items.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="px-2 py-1.5 text-gray-500 w-8">{i + 1}</td>
                <td className="px-2 py-1.5 min-w-[180px]">
                  <input className={ic} value={row.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="Description" readOnly={readOnly} />
                </td>
                <td className="px-2 py-1.5 w-16">
                  <input type="number" className={ic} value={row.qty} onChange={(e) => update(i, "qty", e.target.value)} readOnly={readOnly} />
                </td>
                <td className="px-2 py-1.5 w-24">
                  <input type="number" step="0.01" className={ic} value={row.rate} onChange={(e) => update(i, "rate", e.target.value)} readOnly={readOnly} />
                </td>
                <td className="px-2 py-1.5 w-24">
                  <input type="number" step="0.01" className={ic} value={row.amount} readOnly />
                </td>
                <td className="px-2 py-1.5 w-20">
                  <input type="number" step="0.01" className={ic} value={row.discount} onChange={(e) => update(i, "discount", e.target.value)} readOnly={readOnly} />
                </td>
                <td className="px-2 py-1.5 w-24">
                  <input type="number" step="0.01" className={ic} value={row.taxable_amt} readOnly />
                </td>
                <td className="px-2 py-1.5 w-16">
                  <input type="number" step="0.01" className={ic} value={row.vat_pct} onChange={(e) => update(i, "vat_pct", e.target.value)} readOnly={readOnly} />
                </td>
                <td className="px-2 py-1.5 w-20">
                  <input type="number" step="0.01" className={ic} value={row.vat_amt} readOnly />
                </td>
                <td className="px-2 py-1.5 w-24 font-semibold text-gray-900">
                  <input type="number" step="0.01" className={ic} value={row.total_amt} readOnly />
                </td>
                <td className="px-2 py-1.5 w-8">
                  {!readOnly && (
                    <button type="button" onClick={() => remove(i)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-gray-50 text-xs font-semibold text-gray-700">
              <tr>
                <td colSpan={9} className="px-3 py-2 text-right">Total</td>
                <td className="px-2 py-2 text-gray-900">{subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ─── PO Detail Modal ───────────────────────────────────────────────────────── */
function PODetailModal({ po, open, onClose, onCreateInvoice }) {
  const qc = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: ["purchase-order", po?.id],
    queryFn: () => getPO(po.id),
    enabled: open && !!po?.id,
  });

  const confirmMut = useMutation({
    mutationFn: () => updatePO(po.id, { status: "active" }),
    onSuccess: () => {
      toast.success("PO confirmed — milestone and reminder created");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order", po?.id] });
      qc.invalidateQueries({ queryKey: ["milestones"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to confirm PO"),
  });

  const invoiceMut = useMutation({
    mutationFn: () => raiseInvoice(po.id),
    onSuccess: (data) => {
      toast.success("Invoice created from PO — review and dispatch");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      if (onCreateInvoice) onCreateInvoice(data);
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to create invoice"),
  });

  if (!open || !po) return null;

  const d = detail || po;
  const lineItems = d.line_items || [];
  const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.total_amt) || 0), 0);
  const vatTotal = lineItems.reduce((s, r) => s + (parseFloat(r.vat_amt) || 0), 0);

  const canInvoice = ["active", "partially_invoiced"].includes(d.status);
  const alreadyInvoiced = d.invoices?.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">PO #{d.po_number}</h2>
            <p className="text-sm text-gray-500">{d.customer_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {d.status === "draft" && (
              <button
                onClick={() => confirmMut.mutate()}
                disabled={confirmMut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {confirmMut.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
                  : "✓ Confirm PO"
                }
              </button>
            )}
            {canInvoice && (
              <button
                onClick={() => !alreadyInvoiced && invoiceMut.mutate()}
                disabled={invoiceMut.isPending || alreadyInvoiced}
                title={alreadyInvoiced ? "An invoice has already been generated from this PO" : ""}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {invoiceMut.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  : alreadyInvoiced
                    ? <><Receipt className="h-4 w-4" /> Invoice Already Generated</>
                    : <><Receipt className="h-4 w-4" /> Raise Invoice from PO</>
                }
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
        ) : (
          <div className="p-6 space-y-6">

            {/* Status badge */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[d.status] || "bg-gray-100 text-gray-700"}`}>
                {d.status?.replace(/_/g, " ")}
              </span>
              {d.expiry_date && (
                <span className="text-xs text-gray-500">Expires: {d.expiry_date}</span>
              )}
            </div>

            {/* Header fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["PO Number",      d.po_number],
                ["PO Date",        d.po_date || "—"],
                ["Payment Terms",  d.payment_terms || "—"],
                ["Currency",       d.currency || "USD"],
                ["Delivery Date",  d.delivery_date || "—"],
                ["Expiry Date",    d.expiry_date || "—"],
                ["Total Value",    `$${Number(d.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Customer / Vendor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bill To (Customer)</p>
                <p className="text-sm font-semibold text-gray-900">{d.customer_name}</p>
                {d.bill_to_address && <p className="text-xs text-gray-500 mt-1">{d.bill_to_address}</p>}
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vendor (Us)</p>
                <p className="text-sm font-semibold text-gray-900">QRESTIK TECHNOLOGIES LLC</p>
                <p className="text-xs text-gray-500 mt-1">Dubai, UAE</p>
              </div>
            </div>

            {/* Line items (read-only) */}
            {lineItems.length > 0 && (
              <LineItemsTable items={lineItems} onChange={() => {}} readOnly />
            )}

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-80 rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-200 text-sm">
                {[
                  ["Subtotal",            subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })],
                  ["VAT Amount",          vatTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between px-4 py-2 text-gray-600">
                    <span>{label}</span>
                    <span className="font-medium text-gray-900">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 font-semibold text-gray-900 bg-white rounded-b-xl">
                  <span>Net Amount</span>
                  <span>{Number(d.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Linked invoices */}
            {d.invoices?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Linked Invoices</p>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        {["Invoice #", "Date", "Amount", "Status"].map((h) => (
                          <th key={h} className="text-left font-medium px-4 py-2 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{inv.invoice_number}</td>
                          <td className="px-4 py-2 text-gray-500">{inv.invoice_date || "—"}</td>
                          <td className="px-4 py-2 text-gray-700">{inv.currency} {Number(inv.total_amount || 0).toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Linked milestones */}
            {d.milestones?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Linked Milestones</p>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        {["Milestone", "Due Date", "Status"].map((h) => (
                          <th key={h} className="text-left font-medium px-4 py-2 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {d.milestones.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{m.title}</td>
                          <td className="px-4 py-2 text-gray-500">{m.due_date || "—"}</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {d.notes && (
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700">{d.notes}</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

/* ─── New PO Modal ──────────────────────────────────────────────────────────── */
function NewPOModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm]     = useState(EMPTY_FORM);
  const [filePath, setFilePath] = useState("");
  const [parsing, setParsing]   = useState(false);
  const [parsed, setParsed]     = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true); setParsed(false);
    try {
      const res = await parsePO(file);
      const p   = res.parsed || res;
      setFilePath(res.file_path || "");

      setForm((f) => ({
        ...f,
        // ── Required extracted fields only ──
        po_number:        p.po_number                         || f.po_number,
        po_date:          p.po_date                           || f.po_date,
        expiry_date:      p.expiry_date                       || f.expiry_date,
        payment_terms:    p.payment_terms || p.billing_terms  || f.payment_terms,
        customer_name:         p.customer_name         || f.customer_name,
        customer_organization: p.customer_organization || f.customer_organization,
        customer_phone:        p.customer_phone        || f.customer_phone,
        customer_trn:          p.customer_trn          || f.customer_trn,
        customer_address: p.bill_to_address || p.ship_to_address || f.customer_address,
        net_amount:       p.total_value != null ? String(p.total_value) : f.net_amount,
        subtotal:         p.total_value != null ? String(p.total_value) : f.subtotal,
        // authorised signatory stored in notes until a dedicated field is added
        notes: p.authorised_signatory
          ? `Authorised Signatory: ${p.authorised_signatory}`
          : (p.notes || f.notes),
        line_items: p.line_items?.length
          ? p.line_items.map((li) => {
              const qty  = parseFloat(li.qty  || 1);
              const rate = parseFloat(li.rate || li.unit_price || 0);
              const disc = parseFloat(li.discount || 0);
              const vat  = parseFloat(li.tax || 0);
              const amt  = qty * rate;
              const taxable = amt - disc;
              const vat_amt = taxable * (vat / 100);
              return {
                description: li.description || li.service || "",
                qty:         String(qty),
                rate:        rate.toFixed(2),
                amount:      amt.toFixed(2),
                discount:    disc.toFixed(2),
                taxable_amt: taxable.toFixed(2),
                vat_pct:     String(vat),
                vat_amt:     vat_amt.toFixed(2),
                total_amt:   (taxable + vat_amt).toFixed(2),
              };
            })
          : f.line_items,
      }));
      toast.success("Fields auto-filled from document");
      setParsed(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Failed to parse document");
    } finally {
      setParsing(false);
    }
  };

  const mut = useMutation({
    mutationFn: ({ data, fp }) => createPO({ data, filePath: fp }),
    onSuccess: () => {
      toast.success("Purchase order created");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      handleClose();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to create PO"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.po_number) { toast.error("PO Number is required"); return; }
    if (!form.customer_name) { toast.error("Customer name is required"); return; }
    if (!filePath) { toast.error("Please upload a PO document first"); return; }
    mut.mutate({
      data: {
        po_number:            form.po_number,
        customer_name:        form.customer_name,
        po_date:              form.po_date     || null,
        expiry_date:          form.expiry_date || null,
        delivery_date:        form.delivery_date || null,
        total_value:          parseFloat(form.net_amount || form.subtotal || 0),
        payment_terms:        form.payment_terms || null,
        currency:             "USD",
        bill_to_address:      form.customer_address || null,
        authorised_signatory: null,
        notes:                form.notes || null,
        line_items:           form.line_items,
      },
      fp: filePath,
    });
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setFilePath("");
    setParsed(false);
    onClose();
  };

  if (!open) return null;

  const subtotal  = form.line_items.reduce((s, r) => s + (parseFloat(r.total_amt) || 0), 0);
  const vatTotal  = form.line_items.reduce((s, r) => s + (parseFloat(r.vat_amt)   || 0), 0);
  const netAmount = subtotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">New Purchase Order</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Upload zone */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-7 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition">
            {parsing ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-2 text-sm font-medium text-blue-600">Parsing Purchase Order…</p>
              </>
            ) : parsed ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-sm font-medium text-emerald-600">Document parsed — fields auto-filled</p>
                <p className="mt-0.5 text-xs text-gray-400">Upload a different file to re-parse</p>
              </>
            ) : (
              <>
                <FileText className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Drop a PDF/DOCX to auto-fill fields below</p>
                <span className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800">
                  <Upload className="h-4 w-4" /> Browse file
                </span>
              </>
            )}
            <input type="file" accept=".pdf,.docx" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])} disabled={parsing} />
          </label>

          {/* PO Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="PO Number" className="md:col-span-1">
              <input className={ic} placeholder="PO-2026-1007" value={form.po_number} onChange={set("po_number")} />
            </Field>
            <Field label="PO Date">
              <input type="date" className={ic} value={form.po_date} onChange={set("po_date")} />
            </Field>
            <Field label="Payment Terms">
              <input className={ic} placeholder="30 DAYS" value={form.payment_terms} onChange={set("payment_terms")} />
            </Field>
            <Field label="Currency">
              <input className={`${ic} bg-gray-50`} value="USD" readOnly disabled />
            </Field>
          </div>

          {/* Customer / Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bill To (Customer)</p>
              <Field label="Customer Name">
                <input className={ic} placeholder="Raqmiyat Information Technology" value={form.customer_name} onChange={set("customer_name")} />
              </Field>
              <Field label="Organization">
                <input className={ic} value={form.customer_organization} onChange={set("customer_organization")} />
              </Field>
              <Field label="Address">
                <input className={ic} placeholder="P.O. Box, City, Country" value={form.customer_address} onChange={set("customer_address")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <input className={ic} value={form.customer_phone} onChange={set("customer_phone")} />
                </Field>
                <Field label="TRN No.">
                  <input className={ic} placeholder="300270962800003" value={form.customer_trn} onChange={set("customer_trn")} />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To (Vendor / Us)</p>
              <Field label="Vendor Name">
                <input className={ic} value={form.vendor_name} onChange={set("vendor_name")} />
              </Field>
              <Field label="Address">
                <input className={ic} value={form.vendor_address} onChange={set("vendor_address")} />
              </Field>
              <Field label="Bank">
                <input className={ic} value={form.vendor_bank} onChange={set("vendor_bank")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={ic} value={form.vendor_city} onChange={set("vendor_city")} />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" className={ic} value={form.expiry_date} onChange={set("expiry_date")} />
                </Field>
              </div>
            </div>
          </div>

          {/* Line items */}
          <LineItemsTable
            items={form.line_items}
            onChange={(items) => setForm((f) => ({ ...f, line_items: items }))}
          />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-80 rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-200 text-sm">
              {[
                ["Total",                    subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })],
                ["Total Amount Before VAT",  subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })],
                ["Header Discount",          "0.00"],
                ["VAT Amount",               vatTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })],
                ["VAT Reversal",             "0.00"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-2 text-gray-600">
                  <span>{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 font-semibold text-gray-900 bg-white rounded-b-xl">
                <span>Net Amount After VAT</span>
                <span>{netAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <Field label="Amount in Words">
            <input className={ic} placeholder="USD Sixty Four Thousand Five Hundred Only"
              value={form.amount_in_words} onChange={set("amount_in_words")} />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Delivery Instructions">
              <input className={ic} placeholder="Please advice us when the shipment is ready for collection"
                value={form.notes} onChange={set("notes")} />
            </Field>
            <Field label="Delivery Date">
              <input type="date" className={ic} value={form.delivery_date} onChange={set("delivery_date")} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending || !filePath}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {mut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Purchase Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function PurchaseOrdersPage() {
  const [tab, setTab]         = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", tab],
    queryFn: () => listPOs(tab === "all" ? undefined : { status: tab }),
  });

  const totalValue   = pos.reduce((s, p) => s + Number(p.total_value || 0), 0);
  const activeCount  = pos.filter((p) => p.status === "active").length;
  const expiringSoon = pos.filter((p) => {
    if (!p.expiry_date) return false;
    const daysLeft = (new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;
  const notInvoiced  = pos.filter((p) => ["active"].includes(p.status)).length;

  return (
    <div className="p-6 space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <PageHeader
          eyebrow="QRESTIK TECHNOLOGIES"
          title="Purchase Orders"
          subtitle="Qrestik Technologies — Manage purchase orders & milestones"
        />
        <div className="flex gap-2">
<Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Purchase Order
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total POs",          value: pos.length },
          { label: "Active",             value: activeCount },
          { label: "Total PO Value",     value: pos.length ? `$${totalValue.toLocaleString()}` : "—" },
          { label: "Expiring This Month",value: expiringSoon },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-0.5 text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Not-invoiced alert banner */}
      {notInvoiced > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{notInvoiced} active PO{notInvoiced > 1 ? "s" : ""} not yet invoiced.</span>
          <span className="text-amber-600">Open a PO and click "Raise Invoice from PO" to proceed.</span>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-full font-medium transition ${
              tab === t ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          <div className="p-10 text-center text-gray-500 text-sm">
            No purchase orders yet.{" "}
            <button className="font-medium text-blue-700 hover:underline" onClick={() => setShowNew(true)}>
              Create one →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                {["PO #", "Customer", "Value", "PO Date", "Expiry", "Payment", "Status", ""].map((h) => (
                  <th key={h} className="text-left font-medium px-4 py-3 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pos.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedPO(po)}
                >
                  <td className="px-4 py-3 font-semibold text-gray-900">{po.po_number}</td>
                  <td className="px-4 py-3 text-gray-700">{po.customer_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    ${" "}
                    {Number(po.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{po.po_date || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{po.expiry_date || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{po.payment_terms || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}`}>
                      {po.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {["active", "partially_invoiced"].includes(po.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPO(po); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        >
                          <Receipt className="h-3 w-3" /> Invoice
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPO(po); }}
                        className="text-gray-400 hover:text-blue-700 text-xs"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <NewPOModal open={showNew} onClose={() => setShowNew(false)} />
      <PODetailModal
        po={selectedPO}
        open={!!selectedPO}
        onClose={() => setSelectedPO(null)}
      />
    </div>
  );
}
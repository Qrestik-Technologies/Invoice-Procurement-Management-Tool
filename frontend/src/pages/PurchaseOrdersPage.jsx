import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { 
  listPOs, 
  parsePO, 
  createPO, 
  confirmPO, 
  closePO, 
  raiseInvoice, 
  getPO, 
  getInvoicesForPO 
} from "../api/purchaseOrders";

import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { usePageMeta } from "../hooks/usePageMeta";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  invoiced: "bg-blue-100 text-blue-700",
  partially_invoiced: "bg-yellow-100 text-yellow-700",
  closed: "bg-red-100 text-red-700",
};

function LinkedInvoices({ poId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["po-invoices", poId],
    queryFn: () => getInvoicesForPO(poId).then(r => r.data.data),
  });

  if (isLoading) return <p className="text-xs text-gray-400">Loading linked invoices...</p>;
  if (!data?.length) return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Linked Invoices</h3>
      <p className="text-sm text-gray-400">No invoices raised yet.</p>
    </div>
  );

  return (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Linked Invoices</h3>
      <div className="space-y-2">
        {data.map(inv => (
          <div key={inv.id} className="border rounded-lg p-3 text-sm flex justify-between items-center bg-gray-50">
            <div>
              <p className="font-medium">{inv.invoice_number}</p>
              <p className="text-xs text-gray-500">{inv.issue_date} • Due {inv.due_date}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">USD {Number(inv.amount).toLocaleString()}</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">{inv.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PODetailPanel({ po, onClose, qc }) {
  const confirmMutation = useMutation({
    mutationFn: confirmPO,
    onSuccess: () => {
      qc.invalidateQueries(["purchase-orders"]);
      qc.invalidateQueries(["po-detail", po.id]);
      toast.success("PO confirmed");
    },
  });

  const closeMutation = useMutation({
    mutationFn: closePO,
    onSuccess: () => {
      qc.invalidateQueries(["purchase-orders"]);
      qc.invalidateQueries(["po-detail", po.id]);
      toast.success("PO closed");
    },
  });

  const raiseMutation = useMutation({
    mutationFn: raiseInvoice,
    onSuccess: () => {
      qc.invalidateQueries(["purchase-orders"]);
      qc.invalidateQueries(["po-detail", po.id]);
      toast.success("Invoice raised successfully!");
    },
    onError: (e) => toast.error("Failed to raise invoice: " + (e.response?.data?.detail || e.message)),
  });

  const { data: detail } = useQuery({
    queryKey: ["po-detail", po.id],
    queryFn: () => getPO(po.id).then(r => r.data.data),
  });

  const d = detail || po;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-[560px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-[#111827]">{d.po_number}</h2>
            <p className="text-sm text-[#6B7280]">{d.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {/* Status & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[d.status] || "bg-gray-100 text-gray-600"}`}>
              {d.status.replace(/_/g, " ")}
            </span>

            {d.status === "draft" && (
              <Button onClick={() => confirmMutation.mutate(d.id)} size="sm">
                Confirm PO
              </Button>
            )}

            {(d.status === "active" || d.status === "partially_invoiced") && (
              <Button 
                onClick={() => raiseMutation.mutate(d.id)} 
                disabled={raiseMutation.isPending}
                size="sm"
              >
                {raiseMutation.isPending ? "Creating Invoice..." : "Raise Invoice"}
              </Button>
            )}

            {d.status === "invoiced" && (
              <Button variant="secondary" onClick={() => closeMutation.mutate(d.id)} size="sm">
                Close PO
              </Button>
            )}
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
            {[
              ["PO Date", d.po_date],
              ["Expiry Date", d.expiry_date],
              ["Total Value", `USD ${Number(d.total_value || 0).toLocaleString()}`],
              ["Payment Terms", d.payment_terms],
              ["Billing Terms", d.billing_terms],
              ["Authorised By", d.authorised_signatory],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500 uppercase tracking-widest">{label}</p>
                <p className="font-medium mt-1">{value || "—"}</p>
              </div>
            ))}
          </div>

          {/* Line Items */}
          {d.line_items?.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">Line Items</h3>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3">Description</th>
                      <th className="text-right px-5 py-3">Qty</th>
                      <th className="text-right px-5 py-3">Rate</th>
                      <th className="text-right px-5 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.line_items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3">{item.description || item.item}</td>
                        <td className="px-5 py-3 text-right">{item.qty ?? item.quantity}</td>
                        <td className="px-5 py-3 text-right">{item.rate ?? item.unit_price}</td>
                        <td className="px-5 py-3 text-right font-medium">
                          USD {Number(item.amount ?? item.total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            {d.bill_to_address && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Bill To</p>
                <p className="whitespace-pre-line">{d.bill_to_address}</p>
              </div>
            )}
            {d.ship_to_address && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Ship To</p>
                <p className="whitespace-pre-line">{d.ship_to_address}</p>
              </div>
            )}
          </div>

          {/* Timeline + Linked Invoices */}
          <LinkedInvoices poId={d.id} />
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const meta = usePageMeta("Purchase Orders", "Manage vendor orders and procurement records");

  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => listPOs().then(r => r.data.data || []),
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await parsePO(fd);
      const p = res.data.data.parsed || res.data.data;
      setParsed(p);
      setForm(p);
      toast.success("PO parsed successfully");
    } catch (e) {
      toast.error("Parse failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createPO(form);
      setParsed(null);
      setFile(null);
      setForm({});
      qc.invalidateQueries(["purchase-orders"]);
      toast.success("Purchase Order created successfully");
    } catch (e) {
      toast.error("Failed to create PO");
    }
  };

  const handleExport = () => toast.info("Export coming soon");

  return (
    <div className="p-8">
      {selectedPO && <PODetailPanel po={selectedPO} onClose={() => setSelectedPO(null)} qc={qc} />}

      <PageHeader
        title={meta.title}
        description={meta.description}
        action={
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" /> New Purchase Order
            </Button>
          </div>
        }
      />

      {/* Upload Section */}
      <div className="bg-white border border-border rounded-xl p-6 mb-8 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-4">Upload PO</h3>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
          />
          <Button onClick={handleUpload} disabled={!file || uploading} size="sm">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Parse PO"}
          </Button>
        </div>

        {parsed && (
          <div className="mt-6 p-5 border border-border rounded-xl bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              {["po_number", "customer_name", "total_value", "expiry_date", "payment_terms", "billing_terms", "authorised_signatory"].map(k => (
                <div key={k}>
                  <label className="block text-xs text-gray-500 mb-1 uppercase tracking-widest">
                    {k.replace(/_/g, " ")}
                  </label>
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                    value={form[k] || ""}
                    onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreate}>Save Purchase Order</Button>
              <Button variant="secondary" onClick={() => { setParsed(null); setFile(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">Loading purchase orders...</div>
        ) : pos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="rounded-full bg-gray-100 p-5">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">No purchase orders yet</p>
              <p className="text-sm text-gray-500 mt-1">Upload a PO or create a new one to get started</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50 text-left text-xs font-medium text-gray-500">
                {["PO Number", "Customer", "Value", "Expiry", "Status"].map(h => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr
                  key={po.id}
                  className="border-b border-border hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPO(po)}
                >
                  <td className="px-6 py-4 font-medium text-[#0C447C]">{po.po_number}</td>
                  <td className="px-6 py-4 text-gray-700">{po.customer_name}</td>
                  <td className="px-6 py-4">USD {Number(po.total_value || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-600">{po.expiry_date || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[po.status]}`}>
                      {po.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400 text-xs">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

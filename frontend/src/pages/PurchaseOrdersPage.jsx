import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPOs, parsePO, createPO, confirmPO, closePO, raiseInvoice, getPO } from "../api/purchaseOrders";

const STATUS_COLORS = {
  draft:              "bg-gray-100 text-gray-700",
  active:             "bg-green-100 text-green-700",
  invoiced:           "bg-blue-100 text-blue-700",
  partially_invoiced: "bg-yellow-100 text-yellow-700",
  closed:             "bg-red-100 text-red-700",
};

function PODetailPanel({ po, onClose, qc }) {
  const confirmMutation = useMutation({
    mutationFn: (id) => confirmPO(id),
    onSuccess: () => { qc.invalidateQueries(["purchase-orders"]); qc.invalidateQueries(["po-detail", po.id]); },
  });
  const closeMutation = useMutation({
    mutationFn: (id) => closePO(id),
    onSuccess: () => { qc.invalidateQueries(["purchase-orders"]); qc.invalidateQueries(["po-detail", po.id]); },
  });
  const raiseMutation = useMutation({
    mutationFn: (id) => raiseInvoice(id),
    onSuccess: () => { qc.invalidateQueries(["purchase-orders"]); qc.invalidateQueries(["po-detail", po.id]); alert("Invoice created successfully!"); },
    onError: (e) => alert("Failed: " + (e.response?.data?.detail || e.message)),
  });

  const { data: detail } = useQuery({
    queryKey: ["po-detail", po.id],
    queryFn: () => getPO(po.id).then(r => r.data.data),
  });

  const d = detail || po;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[520px] bg-white h-full overflow-y-auto shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{d.po_number}</h2>
            <p className="text-sm text-gray-500">{d.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-4 space-y-5 flex-1">
          {/* Status + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status]}`}>
              {d.status.replace(/_/g, " ")}
            </span>
            {d.status === "draft" && (
              <button onClick={() => confirmMutation.mutate(d.id)}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                Confirm PO
              </button>
            )}
            {(d.status === "active" || d.status === "partially_invoiced") && (
              <button onClick={() => raiseMutation.mutate(d.id)}
                disabled={raiseMutation.isPending}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">
                {raiseMutation.isPending ? "Creating..." : "Raise Invoice"}
              </button>
            )}
            {d.status === "invoiced" && (
              <button onClick={() => closeMutation.mutate(d.id)}
                className="text-xs border px-3 py-1.5 rounded hover:bg-gray-50">
                Close PO
              </button>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["PO Date", d.po_date || "—"],
              ["Expiry Date", d.expiry_date || "—"],
              ["Total Value", `USD ${Number(d.total_value).toLocaleString()}`],
              ["Payment Terms", d.payment_terms || "—"],
              ["Billing Terms", d.billing_terms || "—"],
              ["Authorised By", d.authorised_signatory || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Line Items */}
          {d.line_items?.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Line Items</h3>
              <div className="border rounded overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Rate</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.line_items.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{item.description || item.item || "—"}</td>
                        <td className="px-3 py-2 text-right">{item.qty ?? item.quantity ?? 1}</td>
                        <td className="px-3 py-2 text-right">{item.rate ?? item.unit_price ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{item.amount ?? item.total ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Addresses */}
          {(d.ship_to_address || d.bill_to_address) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {d.bill_to_address && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
                  <p className="text-sm whitespace-pre-line">{d.bill_to_address}</p>
                </div>
              )}
              {d.ship_to_address && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ship To</p>
                  <p className="text-sm whitespace-pre-line">{d.ship_to_address}</p>
                </div>
              )}
            </div>
          )}

          {/* Status Timeline */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2 items-start">
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                <div><p className="font-medium">Created</p><p className="text-gray-400 text-xs">{new Date(d.created_at).toLocaleString()}</p></div>
              </div>
              {d.status !== "draft" && (
                <div className="flex gap-2 items-start">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div><p className="font-medium">Confirmed → Active</p><p className="text-gray-400 text-xs">{new Date(d.updated_at).toLocaleString()}</p></div>
                </div>
              )}
              {(d.status === "invoiced" || d.status === "closed") && (
                <div className="flex gap-2 items-start">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div><p className="font-medium">Invoice Raised</p></div>
                </div>
              )}
              {d.status === "closed" && (
                <div className="flex gap-2 items-start">
                  <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div><p className="font-medium">Closed</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [filePath, setFilePath] = useState("");
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => listPOs().then((r) => r.data.data),
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await parsePO(fd);
      const { parsed: p, file_path } = res.data.data;
      setParsed(p);
      setFilePath(file_path);
      setForm(p);
    } catch (e) {
      alert("Parse failed: " + (e.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createPO(form, filePath);
      setParsed(null);
      setFile(null);
      setForm({});
      qc.invalidateQueries(["purchase-orders"]);
    } catch (e) {
      alert("Create failed: " + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {selectedPO && <PODetailPanel po={selectedPO} onClose={() => setSelectedPO(null)} qc={qc} />}

      <h1 className="text-2xl font-semibold mb-6">Purchase Orders</h1>

      {/* Upload Section */}
      <div className="bg-white border rounded-lg p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Upload PO</h2>
        <div className="flex gap-3 items-center">
          <input type="file" accept=".pdf,.docx,.doc"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-sm text-gray-600" />
          <button onClick={handleUpload} disabled={!file || uploading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
            {uploading ? "Parsing..." : "Parse PO"}
          </button>
        </div>

        {parsed && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {["po_number","customer_name","total_value","expiry_date","billing_terms","payment_terms","authorised_signatory"].map((k) => (
              <div key={k}>
                <label className="text-xs text-gray-500 uppercase">{k.replace(/_/g," ")}</label>
                <input className="block w-full border rounded px-3 py-1.5 text-sm mt-0.5"
                  value={form[k] || ""}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2 flex gap-3 mt-2">
              <button onClick={handleCreate}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                Save PO
              </button>
              <button onClick={() => { setParsed(null); setFile(null); }}
                className="px-4 py-2 border text-sm rounded hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {["PO Number","Customer","Value","Expiry","Status",""].map((h, i) => (
                <th key={i} className="text-left py-3 pr-4 pl-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            )}
            {(data || []).map((po) => (
              <tr key={po.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPO(po)}>
                <td className="py-3 pl-4 pr-4 font-medium text-indigo-600">{po.po_number}</td>
                <td className="py-3 pr-4">{po.customer_name}</td>
                <td className="py-3 pr-4">USD {Number(po.total_value).toLocaleString()}</td>
                <td className="py-3 pr-4">{po.expiry_date || "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                    {po.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400 text-xs">View →</td>
              </tr>
            ))}
            {!isLoading && (data || []).length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">No purchase orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

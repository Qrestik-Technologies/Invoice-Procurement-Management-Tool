import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPOs, parsePO, createPO, confirmPO, closePO } from "../api/purchaseOrders";

const STATUS_COLORS = {
  draft:              "bg-gray-100 text-gray-700",
  active:             "bg-green-100 text-green-700",
  invoiced:           "bg-blue-100 text-blue-700",
  partially_invoiced: "bg-yellow-100 text-yellow-700",
  closed:             "bg-red-100 text-red-700",
};

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [filePath, setFilePath] = useState("");
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => listPOs().then((r) => r.data.data),
  });

  const confirmMutation = useMutation({
    mutationFn: (id) => confirmPO(id),
    onSuccess: () => qc.invalidateQueries(["purchase-orders"]),
  });

  const closeMutation = useMutation({
    mutationFn: (id) => closePO(id),
    onSuccess: () => qc.invalidateQueries(["purchase-orders"]),
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
              {["PO Number","Customer","Value","Expiry","Status","Actions"].map((h) => (
                <th key={h} className="text-left py-3 pr-4 pl-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading...</td></tr>
            )}
            {(data || []).map((po) => (
              <tr key={po.id} className="border-t hover:bg-gray-50">
                <td className="py-3 pl-4 pr-4 font-medium">{po.po_number}</td>
                <td className="py-3 pr-4">{po.customer_name}</td>
                <td className="py-3 pr-4">AED {Number(po.total_value).toLocaleString()}</td>
                <td className="py-3 pr-4">{po.expiry_date || "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                    {po.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-3 pr-4 flex gap-2">
                  {po.status === "draft" && (
                    <button onClick={() => confirmMutation.mutate(po.id)}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                      Confirm
                    </button>
                  )}
                  {po.status === "invoiced" && (
                    <button onClick={() => closeMutation.mutate(po.id)}
                      className="text-xs border px-2 py-1 rounded hover:bg-gray-100">
                      Close PO
                    </button>
                  )}
                </td>
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

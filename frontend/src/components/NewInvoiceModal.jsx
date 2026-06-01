/**
 * NewInvoiceModal.jsx
 * Drop-in replacement / enhancement for the New Invoice modal.
 *
 * Changes vs original:
 *  - Adds an "Attachments" section with drag-and-drop + click-to-browse file upload
 *  - Displays selected file chips with remove button
 *  - Passes `attachments` (File[]) back via onSubmit alongside the rest of the form data
 *
 * Usage:
 *   <NewInvoiceModal
 *     isOpen={showModal}
 *     onClose={() => setShowModal(false)}
 *     onSubmit={handleCreateInvoice}   // receives { invoiceNumber, customer, amount, currency, issueDate, dueDate, description, attachments }
 *     customers={customers}            // [{ id, name }]
 *     nextInvoiceNumber="INV-001"      // optional default
 *   />
 *
 * Dependencies (already in your package.json): React, Tailwind CSS, lucide-react
 */

import { useState, useRef, useCallback } from "react";
import { X, Upload, FileText, Paperclip, AlertCircle } from "lucide-react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 5;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileChip({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700 max-w-full">
      <FileText size={14} className="text-slate-500 shrink-0" />
      <span className="truncate max-w-[160px]" title={file.name}>
        {file.name}
      </span>
      <span className="text-slate-400 text-xs shrink-0">
        ({formatBytes(file.size)})
      </span>
      <button
        type="button"
        onClick={() => onRemove(file)}
        className="ml-auto text-slate-400 hover:text-red-500 transition-colors shrink-0"
        aria-label={`Remove ${file.name}`}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function NewInvoiceModal({
  isOpen,
  onClose,
  onSubmit,
  customers = [],
  nextInvoiceNumber = "INV-001",
}) {
  const [form, setForm] = useState({
    invoiceNumber: nextInvoiceNumber,
    customer: "",
    amount: "",
    currency: "USD",
    issueDate: "",
    dueDate: "",
    description: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateAndAddFiles = useCallback(
    (newFiles) => {
      setFileError("");
      const validFiles = [];
      for (const file of newFiles) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setFileError(`"${file.name}" is not a supported file type.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          setFileError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
          continue;
        }
        if (attachments.find((f) => f.name === file.name && f.size === file.size)) {
          continue; // duplicate
        }
        validFiles.push(file);
      }
      const combined = [...attachments, ...validFiles];
      if (combined.length > MAX_FILES) {
        setFileError(`You can attach up to ${MAX_FILES} files.`);
        setAttachments(combined.slice(0, MAX_FILES));
      } else {
        setAttachments(combined);
      }
    },
    [attachments]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    validateAndAddFiles(dropped);
  };

  const handleFileInputChange = (e) => {
    validateAndAddFiles(Array.from(e.target.files));
    e.target.value = ""; // reset so same file can be re-selected if removed
  };

  const removeFile = (fileToRemove) => {
    setAttachments((prev) =>
      prev.filter((f) => !(f.name === fileToRemove.name && f.size === fileToRemove.size))
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, attachments });
    // Reset
    setForm({
      invoiceNumber: nextInvoiceNumber,
      customer: "",
      amount: "",
      currency: "USD",
      issueDate: "",
      dueDate: "",
      description: "",
    });
    setAttachments([]);
    setFileError("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">New Invoice</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Row: Invoice # + Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Invoice #
              </label>
              <input
                name="invoiceNumber"
                value={form.invoiceNumber}
                onChange={handleChange}
                placeholder="INV-001"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Customer
              </label>
              {customers.length > 0 ? (
                <select
                  name="customer"
                  value={form.customer}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  name="customer"
                  value={form.customer}
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                >
                  <option value="">Select customer</option>
                </select>
              )}
            </div>
          </div>

          {/* Row: Amount + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Amount
              </label>
              <input
                name="amount"
                type="number"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Currency
              </label>
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>AED</option>
                <option>SAR</option>
                <option>INR</option>
              </select>
            </div>
          </div>

          {/* Row: Issue Date + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Issue Date
              </label>
              <input
                name="issueDate"
                type="date"
                value={form.issueDate}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Due Date
              </label>
              <input
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Optional"
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>

          {/* ── Attachments ── */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
              <Paperclip size={13} />
              Attachments{" "}
              <span className="text-slate-400 font-normal">
                (up to {MAX_FILES} files, {MAX_FILE_SIZE_MB} MB each)
              </span>
            </label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-2 
                border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer 
                transition-all duration-200 select-none
                ${
                  dragOver
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
                }
              `}
            >
              <Upload
                size={22}
                className={dragOver ? "text-blue-500" : "text-slate-400"}
              />
              <p className="text-sm text-slate-500 text-center">
                <span className="font-medium text-blue-600">Click to browse</span>{" "}
                or drag &amp; drop files here
              </p>
              <p className="text-xs text-slate-400">
                PDF, Word, Excel, PNG, JPG, WEBP
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Error */}
            {fileError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                <AlertCircle size={13} />
                {fileError}
              </div>
            )}

            {/* File list */}
            {attachments.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                {attachments.map((file) => (
                  <FileChip
                    key={`${file.name}-${file.size}`}
                    file={file}
                    onRemove={removeFile}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-[#1e3a5f] rounded-lg hover:bg-[#162d4a] transition-colors"
            >
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

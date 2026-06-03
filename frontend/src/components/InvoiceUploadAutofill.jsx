import { useState, useRef, useCallback } from 'react';
import { parseInvoiceFile, uploadInvoicePdf } from '../api/invoices';

const VENDOR_LABELS = {
  qrestik:  { label: 'Qrestik Technologies', color: '#0ea5e9', bg: '#f0f9ff' },
  infinitum: { label: 'Infinitum Global LLC', color: '#8b5cf6', bg: '#f5f3ff' },
  generic:  { label: 'Unknown Vendor',        color: '#64748b', bg: '#f8fafc' },
};

export default function InvoiceUploadAutofill({
  onAutofill,
  onFileAttached,
  invoiceId,
  className = '',
}) {
  const [state, setState] = useState('idle'); // idle | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;

      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'docx', 'doc'].includes(ext)) {
        setError('Please upload a PDF or Word document (.pdf, .docx, .doc)');
        setState('error');
        return;
      }

      setState('uploading');
      setProgress(0);
      setError('');
      setResult(null);

      try {
        // Step 1: Parse the document
        const parsed = await parseInvoiceFile(file, setProgress);

        // Step 2: If invoiceId provided, also attach the PDF
        if (invoiceId && ext === 'pdf') {
          await uploadInvoicePdf(invoiceId, file);
          onFileAttached?.(invoiceId, file);
        }

        setResult(parsed.parse_result);
        setState('success');

        // Fire the autofill callback
        onAutofill?.(parsed.parse_result);
      } catch (err) {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to process document. Please try again.';
        setError(msg);
        setState('error');
      }
    },
    [invoiceId, onAutofill, onFileAttached]
  );

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const reset = () => {
    setState('idle');
    setProgress(0);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Vendor badge ─────────────────────────────────────────────────────────
  const vendorInfo = result?.vendor ? VENDOR_LABELS[result.vendor] ?? VENDOR_LABELS.generic : null;

  return (
    <div className={`iau-wrapper ${className}`} style={styles.wrapper}>
      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      {state === 'idle' && (
        <div
          style={{
            ...styles.dropzone,
            ...(dragging ? styles.dropzoneDragging : {}),
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div style={styles.dropzoneIcon}>
            <UploadIcon />
          </div>
          <p style={styles.dropzoneTitle}>
            Upload invoice to auto-fill form
          </p>
          <p style={styles.dropzoneSubtitle}>
            Drag & drop or click — PDF, DOCX supported
          </p>
          <p style={styles.dropzoneHint}>
            Supports Qrestik Technologies &amp; Infinitum Global invoices
          </p>
        </div>
      )}

      {/* ── Progress ──────────────────────────────────────────────────── */}
      {state === 'uploading' && (
        <div style={styles.statusBox}>
          <div style={styles.statusIcon}><SpinnerIcon /></div>
          <p style={styles.statusTitle}>Analysing document…</p>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <p style={styles.progressLabel}>{progress}%</p>
        </div>
      )}

      {/* ── Success ───────────────────────────────────────────────────── */}
      {state === 'success' && result && (
        <div style={styles.successBox}>
          <div style={styles.successHeader}>
            <div style={styles.successIcon}><CheckIcon /></div>
            <div>
              <p style={styles.successTitle}>Form auto-filled</p>
              {vendorInfo && (
                <span style={{ ...styles.vendorBadge, color: vendorInfo.color, background: vendorInfo.bg }}>
                  {vendorInfo.label}
                </span>
              )}
            </div>
            <button style={styles.resetBtn} onClick={reset} title="Upload another">
              ✕
            </button>
          </div>

          {/* Extracted fields preview */}
          <div style={styles.fieldGrid}>
            <Field label="Invoice #"   value={result.invoice_number} />
            <Field label="Date"        value={result.invoice_date} />
            <Field label="Total"       value={result.total ? `${result.currency ?? ''} ${result.total}` : null} />
            <Field label="Customer"    value={result.customer_name} />
            <Field label="PO Number"   value={result.po_number} />
            <Field label="Currency"    value={result.currency} />
          </div>

          {result.missing_fields?.length > 0 && (
            <div style={styles.missingBox}>
              <span style={styles.missingLabel}>⚠ Missing fields — please fill manually:</span>
              <span style={styles.missingFields}>{result.missing_fields.join(', ')}</span>
            </div>
          )}

          {result.line_items?.length > 0 && (
            <details style={styles.details}>
              <summary style={styles.detailsSummary}>
                {result.line_items.length} line item{result.line_items.length > 1 ? 's' : ''} extracted
              </summary>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Qty</th>
                    <th style={styles.th}>Rate</th>
                    <th style={styles.th}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.line_items.map((item, i) => (
                    <tr key={i}>
                      <td style={styles.td}>{item.description}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{item.qty}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{item.rate}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {state === 'error' && (
        <div style={styles.errorBox}>
          <div style={styles.errorHeader}>
            <span style={styles.errorIcon}>✕</span>
            <p style={styles.errorTitle}>Processing failed</p>
            <button style={styles.resetBtn} onClick={reset}>Try again</button>
          </div>
          <p style={styles.errorMessage}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.fieldValue}>{String(value)}</span>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: 'iau-spin 0.8s linear infinite' }}>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
      <style>{`@keyframes iau-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  wrapper: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '13px',
  },
  dropzone: {
    border: '2px dashed #cbd5e1',
    borderRadius: '10px',
    padding: '28px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    background: '#f8fafc',
    color: '#64748b',
  },
  dropzoneDragging: {
    borderColor: '#3b82f6',
    background: '#eff6ff',
  },
  dropzoneIcon: { marginBottom: '10px', color: '#94a3b8' },
  dropzoneTitle: { margin: '0 0 4px', fontWeight: 600, color: '#334155', fontSize: '14px' },
  dropzoneSubtitle: { margin: '0 0 6px', color: '#64748b' },
  dropzoneHint: { margin: 0, fontSize: '11px', color: '#94a3b8' },

  statusBox: {
    padding: '24px',
    background: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  statusIcon: { marginBottom: '10px', color: '#3b82f6' },
  statusTitle: { margin: '0 0 12px', fontWeight: 600, color: '#334155' },
  progressTrack: {
    height: '6px', background: '#e2e8f0', borderRadius: '3px',
    overflow: 'hidden', margin: '0 auto', maxWidth: '240px',
  },
  progressFill: {
    height: '100%', background: '#3b82f6', borderRadius: '3px',
    transition: 'width 0.2s',
  },
  progressLabel: { margin: '8px 0 0', fontSize: '11px', color: '#94a3b8' },

  successBox: {
    padding: '16px',
    background: '#f0fdf4',
    borderRadius: '10px',
    border: '1px solid #bbf7d0',
  },
  successHeader: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px',
  },
  successIcon: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: '#22c55e', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  successTitle: { margin: 0, fontWeight: 600, color: '#15803d' },
  vendorBadge: {
    display: 'inline-block', padding: '1px 8px', borderRadius: '9999px',
    fontSize: '11px', fontWeight: 500, marginTop: '3px',
  },
  resetBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    cursor: 'pointer', color: '#94a3b8', fontSize: '14px', padding: '2px 6px',
  },
  fieldGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: '10px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '1px' },
  fieldLabel: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fieldValue: { color: '#1e293b', fontWeight: 500 },

  missingBox: {
    marginTop: '8px', padding: '8px 10px',
    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px',
  },
  missingLabel: { color: '#92400e', fontWeight: 600, marginRight: '6px' },
  missingFields: { color: '#b45309' },

  details: { marginTop: '10px' },
  detailsSummary: {
    cursor: 'pointer', color: '#3b82f6', fontWeight: 500, userSelect: 'none',
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '12px' },
  th: {
    textAlign: 'left', padding: '5px 8px',
    background: '#f1f5f9', color: '#475569', fontWeight: 600,
    borderBottom: '1px solid #e2e8f0',
  },
  td: { padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155' },

  errorBox: {
    padding: '16px',
    background: '#fff1f2',
    borderRadius: '10px',
    border: '1px solid #fecdd3',
  },
  errorHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  errorIcon: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#ef4444', color: '#fff', textAlign: 'center',
    lineHeight: '24px', fontSize: '13px', flexShrink: 0,
  },
  errorTitle: { margin: 0, fontWeight: 600, color: '#9f1239' },
  errorMessage: { margin: 0, color: '#be123c', lineHeight: 1.5 },
};

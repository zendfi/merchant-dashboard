'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { invoices as invoicesApi, CreateInvoiceRequest, LineItem } from '@/lib/api';
import { X, Plus, Trash2, ChevronRight, ChevronLeft, FileText, Send, Banknote, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'live' | 'test';
}

type Step = 1 | 2 | 3;

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const INPUT_CLS =
  'w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow';

const LABEL_CLS =
  'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide';

const SECTION_CLS =
  'bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-white/5';

function emptyLineItem(): LineItem & { _key: number } {
  return { _key: Date.now() + Math.random(), description: '', quantity: 1, unit_price: 0 };
}

export default function CreateInvoiceModal({ isOpen, onClose, mode }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [description, setDescription] = useState('');

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<(LineItem & { _key: number })[]>([]);
  const [dueDate, setDueDate] = useState('');

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const [onramp, setOnramp] = useState(false);
  const [amountNgn, setAmountNgn] = useState('');
  const [payerServiceCharge, setPayerServiceCharge] = useState(true);
  const [collectCustomerInfo, setCollectCustomerInfo] = useState(false);
  const [maxUses, setMaxUses] = useState('1');

  useEffect(() => { setMounted(true); }, []);

  const reset = useCallback(() => {
    setStep(1);
    setCustomerEmail('');
    setCustomerName('');
    setAmount('');
    setToken('USDC');
    setDescription('');
    setLineItems([]);
    setDueDate('');
    setOnramp(false);
    setAmountNgn('');
    setPayerServiceCharge(true);
    setCollectCustomerInfo(false);
    setMaxUses('1');
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ── Line item helpers ─────────────────────────────────────────────────────
  const addLineItem = () => setLineItems(prev => [...prev, emptyLineItem()]);

  const updateLineItem = (key: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev =>
      prev.map(li =>
        li._key === key ? { ...li, [field]: field === 'description' ? value : Number(value) || 0 } : li
      )
    );
  };

  const removeLineItem = (key: number) => {
    setLineItems(prev => prev.filter(li => li._key !== key));
  };

  const lineItemTotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setError('Please enter a valid customer email address.');
      return false;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter an amount greater than 0.');
      return false;
    }
    if (!description.trim()) {
      setError('Please enter an invoice description.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    for (const li of lineItems) {
      if (!li.description.trim()) {
        setError('All line items must have a description.');
        return false;
      }
      if (li.quantity < 1) {
        setError('Line item quantities must be at least 1.');
        return false;
      }
      if (li.unit_price < 0) {
        setError('Line item prices cannot be negative.');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(prev => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  // ── Build request ─────────────────────────────────────────────────────────
  const buildRequest = (): CreateInvoiceRequest => {
    const req: CreateInvoiceRequest = {
      customer_email: customerEmail.trim(),
      customer_name: customerName.trim() || undefined,
      amount: parseFloat(amount),
      token,
      description: description.trim(),
      line_items: lineItems.length > 0
        ? lineItems.map(({ description: d, quantity: q, unit_price: u }) => ({ description: d, quantity: q, unit_price: u }))
        : undefined,
      due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
      onramp,
      amount_ngn: onramp && amountNgn ? parseFloat(amountNgn) : undefined,
      payer_service_charge: onramp ? payerServiceCharge : undefined,
      collect_customer_info: collectCustomerInfo || undefined,
      payment_link_max_uses: parseInt(maxUses) || 1,
    };
    return req;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await invoicesApi.create(buildRequest());
      setSuccessMsg('Invoice saved as draft.');
      setTimeout(() => handleClose(), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAndSend = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await invoicesApi.create(buildRequest());
      await invoicesApi.send(created.id, mode);
      setSuccessMsg(`Invoice ${created.invoice_number} sent to ${customerEmail}.`);
      setTimeout(() => handleClose(), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create or send invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const lineItemMismatch =
    lineItems.length > 0 &&
    Math.abs(lineItemTotal - parseFloat(amount || '0')) > 0.01;

  const content = (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[560px] bg-white dark:bg-[#13131f] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              New Invoice
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Step {step} of 3</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 pt-4 flex-shrink-0">
          {([1, 2, 3] as Step[]).map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Step 1: Customer & Amount ─────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className={SECTION_CLS}>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Customer
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className={LABEL_CLS}>Email *</label>
                    <input
                      type="email"
                      className={INPUT_CLS}
                      placeholder="customer@example.com"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Name</label>
                    <input
                      type="text"
                      className={INPUT_CLS}
                      placeholder="Acme Corp (optional)"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className={SECTION_CLS}>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Invoice details
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={LABEL_CLS}>Amount *</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={INPUT_CLS}
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="w-28">
                      <label className={LABEL_CLS}>Token</label>
                      <select
                        className={INPUT_CLS}
                        value={token}
                        onChange={e => setToken(e.target.value)}
                      >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                        <option value="SOL">SOL</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Description *</label>
                    <textarea
                      className={`${INPUT_CLS} resize-none`}
                      rows={2}
                      placeholder="Web development – March 2026"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Line Items & Due Date ─────────────────────────────── */}
          {step === 2 && (
            <>
              <div className={SECTION_CLS}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Line items <span className="normal-case font-normal">(optional)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add item
                  </button>
                </div>

                {lineItems.length === 0 ? (
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="w-full py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-400 hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Plus className="w-4 h-4 mx-auto mb-1" />
                    Add itemised breakdown
                  </button>
                ) : (
                  <div className="space-y-2">
                    {/* Column labels */}
                    <div className="grid grid-cols-[1fr_60px_80px_28px] gap-2 px-1">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Description</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide text-right">Qty</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide text-right">Price</p>
                      <span />
                    </div>

                    {lineItems.map(li => (
                      <div key={li._key} className="grid grid-cols-[1fr_60px_80px_28px] gap-2 items-center">
                        <input
                          type="text"
                          className={INPUT_CLS}
                          placeholder="Item description"
                          value={li.description}
                          onChange={e => updateLineItem(li._key, 'description', e.target.value)}
                        />
                        <input
                          type="number"
                          min="1"
                          className={`${INPUT_CLS} text-right`}
                          value={li.quantity}
                          onChange={e => updateLineItem(li._key, 'quantity', e.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={`${INPUT_CLS} text-right`}
                          placeholder="0.00"
                          value={li.unit_price || ''}
                          onChange={e => updateLineItem(li._key, 'unit_price', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeLineItem(li._key)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Total row */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10 mt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Line items total</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        ${lineItemTotal.toFixed(2)} {token}
                      </p>
                    </div>

                    {lineItemMismatch && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        Line items total (${lineItemTotal.toFixed(2)}) doesn&apos;t match the invoice amount (${parseFloat(amount || '0').toFixed(2)}). The invoice amount takes precedence.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={SECTION_CLS}>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Due date
                </h3>
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDueDate(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1.5">Leave blank for "upon receipt"</p>
              </div>
            </>
          )}

          {/* ── Step 3: Payment options & Review ──────────────────────────── */}
          {step === 3 && (
            <>
              {/* Onramp */}
              <div className={SECTION_CLS}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                      <Banknote className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Pay with Bank (NGN onramp)</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Customer pays via NGN bank transfer. Converted to {token} and settled to your wallet.
                      </p>
                    </div>
                  </div>
                  <Toggle checked={onramp} onChange={() => setOnramp(v => !v)} />
                </div>

                {onramp && (
                  <div className="mt-4 space-y-3 pl-10">
                    <div>
                      <label className={LABEL_CLS}>NGN Amount (optional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">₦</span>
                        <input
                          type="number"
                          min="1000"
                          step="1"
                          className={`${INPUT_CLS} pl-7`}
                          placeholder="e.g. 42500"
                          value={amountNgn}
                          onChange={e => setAmountNgn(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Sets an exact NGN amount, bypassing the live FX re-quote at checkout. Min ₦1,000.
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Payer covers service charge</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          max(₦30, ceil(amount × 2.5%)) added on top, visible to payer
                        </p>
                      </div>
                      <Toggle checked={payerServiceCharge} onChange={() => setPayerServiceCharge(v => !v)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Collect customer info */}
              <div className={SECTION_CLS}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Collect customer details</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Show a form (name, phone, billing address) on the checkout page before payment.
                    </p>
                  </div>
                  <Toggle checked={collectCustomerInfo} onChange={() => setCollectCustomerInfo(v => !v)} />
                </div>
              </div>

              {/* Max uses */}
              <div className={SECTION_CLS}>
                <label className={LABEL_CLS}>Payment link max uses</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={INPUT_CLS}
                  value={maxUses}
                  onChange={e => setMaxUses(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Defaults to 1. Increase only if the same invoice payment link should be reusable.
                </p>
              </div>

              {/* Review summary */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Summary</p>
                <Row label="Customer" value={customerName ? `${customerName} <${customerEmail}>` : customerEmail} />
                <Row label="Amount" value={`${parseFloat(amount).toFixed(2)} ${token}`} />
                <Row label="Description" value={description} />
                {dueDate && <Row label="Due" value={new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />}
                {lineItems.length > 0 && <Row label="Line items" value={`${lineItems.length} item(s) – $${lineItemTotal.toFixed(2)}`} />}
                <Row label="Payment method" value={onramp ? 'NGN bank transfer (onramp)' : 'Crypto wallet'} />
                {onramp && amountNgn && <Row label="NGN amount" value={`₦${parseFloat(amountNgn).toLocaleString()}`} />}
                <Row label="Max uses" value={maxUses || '1'} />
              </div>
            </>
          )}

          {/* Error / Success */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10 flex-shrink-0">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(prev => (prev - 1) as Step) : handleClose()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {step > 1 && <ChevronLeft className="w-4 h-4" />}
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            {step < 3 && (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-60"
                >
                  <FileText className="w-4 h-4" />
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleCreateAndSend}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending…' : 'Create & Send'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="font-medium text-slate-900 dark:text-white text-right">{value}</span>
    </div>
  );
}

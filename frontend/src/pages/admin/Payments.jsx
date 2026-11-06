import React, { useState, useEffect, useMemo } from 'react';
import { paymentsApi } from '../../api/payments';
import { clientsApi } from '../../api/clients';
import { Modal } from '../../components/Modal';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  DollarSign, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileText, 
  User, 
  Banknote, 
  Smartphone, 
  Receipt
} from 'lucide-react';

export const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentType, setPaymentType] = useState('advance');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  // Delete Confirm Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [paymentsData, summaryData, clientsData] = await Promise.all([
        paymentsApi.list({ page_size: 100 }),
        paymentsApi.summary(),
        clientsApi.list({ page_size: 100 }),
      ]);
      const payList = Array.isArray(paymentsData) ? paymentsData : (paymentsData.results || []);
      const clientList = Array.isArray(clientsData) ? clientsData : (clientsData.results || []);
      setPayments(payList);
      setSummary(summaryData);
      setClients(clientList);
    } catch {
      setError('Failed to load payment records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingPayment(null);
    setClientId(clients.length > 0 ? clients[0].id : '');
    setAmount('');
    setMethod('cash');
    setPaymentType('advance');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNo('');
    setNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (payment) => {
    setEditingPayment(payment);
    setClientId(payment.client);
    setAmount(payment.amount);
    setMethod(payment.method);
    setPaymentType(payment.payment_type);
    setPaymentDate(payment.payment_date || new Date().toISOString().split('T')[0]);
    setReferenceNo(payment.reference_no || '');
    setNotes(payment.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!clientId) {
      setFormError('Please select a client.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }

    setFormSaving(true);
    setFormError('');

    const payload = {
      client: clientId,
      amount: numAmount.toFixed(2),
      method,
      payment_type: paymentType,
      payment_date: paymentDate,
      reference_no: referenceNo.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (editingPayment) {
        await paymentsApi.update(editingPayment.id, payload);
      } else {
        await paymentsApi.create(payload);
      }
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.amount?.[0] || err.response?.data?.detail || 'Failed to save payment record.';
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = (payment) => {
    setPaymentToDelete(payment);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    setDeleting(true);
    try {
      await paymentsApi.delete(paymentToDelete.id);
      setDeleteModalOpen(false);
      setPaymentToDelete(null);
      await fetchData();
    } catch {
      alert('Failed to delete payment record.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch = 
        !searchTerm ||
        p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.reference_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMethod = selectedMethod === 'all' || p.method === selectedMethod;
      const matchesType = selectedType === 'all' || p.payment_type === selectedType;
      const matchesClient = selectedClient === 'all' || p.client === selectedClient;

      return matchesSearch && matchesMethod && matchesType && matchesClient;
    });
  }, [payments, searchTerm, selectedMethod, selectedType, selectedClient]);

  const selectedClientInfo = useMemo(() => {
    return clients.find((c) => c.id === clientId);
  }, [clients, clientId]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">Payments & Receipts</h1>
          <p className="text-stone-500 text-sm mt-1">
            Record manual cash and online payments, manage advance deposits, partial milestones, and track balances.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          Record Payment
        </button>
      </div>

      {/* Metrics Row */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Collected</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-stone-900 font-serif">
              ${Number(summary.total_collected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500 mt-1 flex items-center gap-1">
              <span>{summary.total_transactions} payment{summary.total_transactions !== 1 ? 's' : ''} logged</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Advance Deposits</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-stone-900 font-serif">
              ${Number(summary.advance_collected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <span>Booking confirmations</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Cash vs Online</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-stone-900 flex items-baseline gap-2">
              <span className="text-stone-900">${Number(summary.total_cash).toLocaleString()}</span>
              <span className="text-xs font-normal text-stone-400">cash</span>
              <span className="text-stone-300">/</span>
              <span className="text-blue-600">${Number(summary.total_online).toLocaleString()}</span>
              <span className="text-xs font-normal text-stone-400">online</span>
            </div>
            <div className="text-xs text-stone-500 mt-1">Multi-channel receipting</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Pending Balance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-600 font-serif">
              ${Number(summary.pending_receivables).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              From ${Number(summary.total_contract_value).toLocaleString()} active packages
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by client, receipt #, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Method Filter */}
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash</option>
            <option value="online">Online / Wire</option>
            <option value="upi">UPI / QR</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="all">All Stages</option>
            <option value="advance">Advance Deposit</option>
            <option value="partial">Partial Payment</option>
            <option value="installment">Installment</option>
            <option value="final">Final Settlement</option>
            <option value="full">Full Payment</option>
          </select>

          {/* Client Filter */}
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 max-w-[160px] truncate"
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.groom_name} & {c.bride_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-stone-400 text-sm">
            Loading payments...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-semibold text-stone-900 text-base">No payment records found</h3>
            <p className="text-stone-500 text-xs mt-1 max-w-sm mx-auto">
              {searchTerm || selectedMethod !== 'all' || selectedType !== 'all' || selectedClient !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Click "Record Payment" to log an advance deposit or partial payment for a client.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/75 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Stage</th>
                  <th className="py-3.5 px-4">Reference / Txn ID</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredPayments.map((payment) => {
                  const isCash = payment.method === 'cash';
                  const isOnline = ['online', 'upi', 'card'].includes(payment.method);

                  return (
                    <tr key={payment.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-stone-900">{payment.client_name || '—'}</div>
                        {payment.client_event_date && (
                          <div className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {payment.client_event_date}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-600 whitespace-nowrap text-xs">
                        {payment.payment_date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-900 font-serif">
                        ${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isCash
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : isOnline
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {isCash ? <Banknote className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                          {payment.method_display || payment.method}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                            payment.payment_type === 'advance'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : payment.payment_type === 'final' || payment.payment_type === 'full'
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {payment.payment_type_display || payment.payment_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-stone-600">
                        {payment.reference_no || <span className="text-stone-300 font-sans">—</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-stone-500 max-w-xs truncate" title={payment.notes}>
                        {payment.notes || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(payment)}
                            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                            title="Edit payment"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(payment)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete payment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record / Edit Payment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPayment ? 'Edit Payment Record' : 'Record Client Payment'}
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Client Selection */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Client <span className="text-rose-500">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="" disabled>Select a wedding client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.groom_name} & {c.bride_name} {c.event_date ? `(${c.event_date})` : ''}
                </option>
              ))}
            </select>
            {selectedClientInfo && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-stone-500 px-1">
                <span>Agreed Package: <strong className="text-stone-700">${Number(selectedClientInfo.package_price || 0).toLocaleString()}</strong></span>
                {selectedClientInfo.pending_balance !== undefined && (
                  <span>Pending: <strong className="text-rose-600">${Number(selectedClientInfo.pending_balance).toLocaleString()}</strong></span>
                )}
              </div>
            )}
          </div>

          {/* Amount & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Amount ($) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="cash">Cash</option>
                <option value="online">Online / Wire Transfer</option>
                <option value="upi">UPI / QR Code</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Payment Stage & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Payment Stage <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="advance">Advance / Booking Deposit</option>
                <option value="partial">Partial Payment / Milestone</option>
                <option value="installment">Installment</option>
                <option value="final">Final Settlement</option>
                <option value="full">Full Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Reference / Transaction ID <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. TXN-108291, Cheque #492, Cash Receipt 04"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Notes / Remarks <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Add any specific payment details, recipient notes, or instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSaving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {formSaving ? 'Saving...' : editingPayment ? 'Update Payment' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Payment Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Are you sure you want to delete this payment record of{' '}
            <strong className="text-stone-900 font-serif">
              ${paymentToDelete ? Number(paymentToDelete.amount).toFixed(2) : '0.00'}
            </strong>{' '}
            for <strong className="text-stone-900">{paymentToDelete?.client_name}</strong>?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            This will adjust the client's balance and total collected revenue metrics.
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Record'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

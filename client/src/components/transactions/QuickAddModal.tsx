import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  FileText,
  Layers,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { extractApiErrorMessage } from '../../api/client';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useCategories } from '../../api/hooks/useCategories';
import { useDashboardSummary } from '../../api/hooks/useDashboard';
import { useDebts } from '../../api/hooks/useDebts';
import { useCreateTransaction } from '../../api/hooks/useTransactions';
import type { CreateTransactionPayload, TransactionType } from '../../api/types';
import { useQuickAdd } from '../../context/QuickAddContext';
import { useToast } from '../../context/ToastContext';
import {
  compareMoney,
  finalizeMoneyInput,
  formatRupiah,
  isValidNonNegativeMoney,
  isValidPositiveMoney,
  subtractMoney,
  sumMoney,
} from '../../utils/currency';
import { dateInputToTransactionDate, getCurrentWibPeriod, toDateInputValue } from '../../utils/date';
import { Modal } from '../common/Modal';
import { MoneyInput } from '../common/MoneyInput';

const TAB_CONFIG: Array<{
  type: TransactionType;
  label: string;
  activeClass: string;
  submitClass: string;
  icon: typeof ArrowUpRight;
}> = [
  {
    type: 'EXPENSE',
    label: 'Pengeluaran',
    activeClass: 'border-rose-300 bg-rose-50 text-rose-700 shadow-2xs',
    submitClass: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-200',
    icon: ArrowUpRight,
  },
  {
    type: 'INCOME',
    label: 'Pemasukan',
    activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-2xs',
    submitClass: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-200',
    icon: ArrowDownLeft,
  },
  {
    type: 'TRANSFER',
    label: 'Transfer',
    activeClass: 'border-blue-300 bg-blue-50 text-blue-700 shadow-2xs',
    submitClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200',
    icon: ArrowLeftRight,
  },
  {
    type: 'DEBT_PAYMENT',
    label: 'Bayar Utang',
    activeClass: 'border-violet-300 bg-violet-50 text-violet-700 shadow-2xs',
    submitClass: 'bg-violet-600 hover:bg-violet-700 focus:ring-violet-200',
    icon: CreditCard,
  },
];

export function QuickAddModal() {
  const { isOpen, initialTab, closeQuickAdd } = useQuickAdd();
  const { showToast } = useToast();

  const [tab, setTab] = useState<TransactionType>(initialTab);
  const [amount, setAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [debtId, setDebtId] = useState('');
  const [splitDebtPayment, setSplitDebtPayment] = useState(false);
  const [principalPaid, setPrincipalPaid] = useState('');
  const [interestPaid, setInterestPaid] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => toDateInputValue());
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPeriod = useMemo(() => {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(transactionDate);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
        return { year, month };
      }
    }
    return getCurrentWibPeriod();
  }, [transactionDate]);

  const accountsQuery = useAccounts(isOpen);
  const categoriesQuery = useCategories(undefined, isOpen);
  const activeDebtsQuery = useDebts(true, isOpen);
  const summaryQuery = useDashboardSummary(selectedPeriod.year, selectedPeriod.month, isOpen);
  const createTxMutation = useCreateTransaction();

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const activeDebts = useMemo(() => activeDebtsQuery.data ?? [], [activeDebtsQuery.data]);

  const essentialCategories = useMemo(
    () => categories.filter((cat) => cat.expenseClass === 'ESSENTIAL'),
    [categories],
  );
  const discretionaryCategories = useMemo(
    () => categories.filter((cat) => cat.expenseClass === 'DISCRETIONARY'),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((cat) => cat.expenseClass === null),
    [categories],
  );

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setAmount('');
      setNote('');
      setSplitDebtPayment(false);
      setPrincipalPaid('');
      setInterestPaid('');
      setTransactionDate(toDateInputValue());
      setFormError(null);
    }
  }, [isOpen, initialTab]);

  // Preselect sensible default source account, destination account, category, and debt
  useEffect(() => {
    if (!isOpen) return;
    if (accounts.length > 0 && !accounts.some((acc) => acc.id === sourceAccountId)) {
      setSourceAccountId(accounts[0]!.id);
    }
  }, [isOpen, accounts, sourceAccountId]);

  useEffect(() => {
    if (!isOpen || tab !== 'TRANSFER') return;
    const candidates = accounts.filter((acc) => acc.id !== sourceAccountId);
    if (candidates.length > 0 && !candidates.some((acc) => acc.id === destinationAccountId)) {
      setDestinationAccountId(candidates[0]!.id);
    } else if (candidates.length === 0) {
      setDestinationAccountId('');
    }
  }, [isOpen, tab, accounts, sourceAccountId, destinationAccountId]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'EXPENSE') {
      const expenseCats = [...essentialCategories, ...discretionaryCategories];
      if (expenseCats.length > 0 && !expenseCats.some((cat) => cat.id === categoryId)) {
        setCategoryId(expenseCats[0]!.id);
      }
    } else if (tab === 'INCOME') {
      // Allow categoryId === '' ("Tanpa Kategori") on INCOME tab; only reset if it holds a non-income category id.
      if (categoryId !== '' && !incomeCategories.some((cat) => cat.id === categoryId)) {
        setCategoryId(incomeCategories[0]?.id ?? '');
      }
    }
  }, [isOpen, tab, essentialCategories, discretionaryCategories, incomeCategories, categoryId]);

  useEffect(() => {
    if (!isOpen || tab !== 'DEBT_PAYMENT') return;
    if (activeDebts.length > 0 && !activeDebts.some((debt) => debt.id === debtId)) {
      setDebtId(activeDebts[0]!.id);
    }
  }, [isOpen, tab, activeDebts, debtId]);

  const sourceAccount = useMemo(
    () => accounts.find((acc) => acc.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
  );
  const destinationAccount = useMemo(
    () => accounts.find((acc) => acc.id === destinationAccountId) ?? null,
    [accounts, destinationAccountId],
  );
  const selectedCategory = useMemo(
    () => categories.find((cat) => cat.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedDebt = useMemo(
    () => activeDebts.find((debt) => debt.id === debtId) ?? null,
    [activeDebts, debtId],
  );

  const selectedCategorySpent = useMemo(() => {
    if (!categoryId || !summaryQuery.data) return '0.00';
    const found = summaryQuery.data.categoryMonthlySpent.find((item) => item.categoryId === categoryId);
    return found?.spent ?? '0.00';
  }, [categoryId, summaryQuery.data]);

  const finalAmount = finalizeMoneyInput(amount);
  const finalPrincipal = finalizeMoneyInput(principalPaid);
  const finalInterest = finalizeMoneyInput(interestPaid);

  const isOverdraft = useMemo(() => {
    if (tab === 'INCOME' || !sourceAccount || !isValidPositiveMoney(finalAmount)) return false;
    return compareMoney(finalAmount, sourceAccount.balance) > 0;
  }, [tab, sourceAccount, finalAmount]);

  const projectedNegativeBalance = useMemo(() => {
    if (!isOverdraft || !sourceAccount) return null;
    return subtractMoney(sourceAccount.balance, finalAmount);
  }, [isOverdraft, sourceAccount, finalAmount]);

  // Real-time debt split validation
  const debtValidationError = useMemo(() => {
    if (tab !== 'DEBT_PAYMENT' || !selectedDebt || !isValidPositiveMoney(finalAmount)) return null;

    if (!splitDebtPayment) {
      if (compareMoney(finalAmount, selectedDebt.remainingBalance) > 0) {
        return `Nominal melebihi sisa pokok utang (${formatRupiah(selectedDebt.remainingBalance)}). Aktifkan "Rincikan Pokok & Bunga" jika pembayaran mencakup bunga.`;
      }
      return null;
    }

    if (!isValidNonNegativeMoney(finalPrincipal) || !isValidNonNegativeMoney(finalInterest)) {
      return 'Masukkan nominal pokok dan bunga yang valid.';
    }
    const splitSum = sumMoney([finalPrincipal, finalInterest]);
    if (compareMoney(splitSum, finalAmount) !== 0) {
      return `Pokok (${formatRupiah(finalPrincipal)}) + Bunga (${formatRupiah(finalInterest)}) harus sama dengan total bayar (${formatRupiah(finalAmount)}).`;
    }
    if (compareMoney(finalPrincipal, selectedDebt.remainingBalance) > 0) {
      return `Pokok yang dibayar tidak boleh melebihi sisa utang (${formatRupiah(selectedDebt.remainingBalance)}).`;
    }
    return null;
  }, [tab, selectedDebt, finalAmount, splitDebtPayment, finalPrincipal, finalInterest]);

  const handleAutoFillInterest = (nextPrincipal: string) => {
    setPrincipalPaid(nextPrincipal);
    const cleanPrincipal = finalizeMoneyInput(nextPrincipal);
    if (isValidPositiveMoney(finalAmount) && isValidNonNegativeMoney(cleanPrincipal)) {
      if (compareMoney(finalAmount, cleanPrincipal) >= 0) {
        setInterestPaid(subtractMoney(finalAmount, cleanPrincipal));
      }
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!isValidPositiveMoney(finalAmount)) {
      setFormError('Masukkan nominal transaksi yang lebih besar dari Rp0.');
      return;
    }
    if (!sourceAccountId) {
      setFormError('Pilih akun sumber terlebih dahulu.');
      return;
    }

    let payload: CreateTransactionPayload;

    if (tab === 'EXPENSE') {
      if (!categoryId) {
        setFormError('Pilih kategori pengeluaran.');
        return;
      }
      payload = {
        type: 'EXPENSE',
        amount: finalAmount,
        sourceAccountId,
        categoryId,
        transactionDate: dateInputToTransactionDate(transactionDate),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
    } else if (tab === 'INCOME') {
      payload = {
        type: 'INCOME',
        amount: finalAmount,
        sourceAccountId,
        ...(categoryId ? { categoryId } : {}),
        transactionDate: dateInputToTransactionDate(transactionDate),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
    } else if (tab === 'TRANSFER') {
      if (!destinationAccountId || destinationAccountId === sourceAccountId) {
        setFormError('Pilih akun tujuan yang berbeda dari akun sumber.');
        return;
      }
      payload = {
        type: 'TRANSFER',
        amount: finalAmount,
        sourceAccountId,
        destinationAccountId,
        transactionDate: dateInputToTransactionDate(transactionDate),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
    } else {
      if (!debtId || !selectedDebt) {
        setFormError('Pilih utang aktif yang akan dibayar.');
        return;
      }
      if (debtValidationError) {
        setFormError(debtValidationError);
        return;
      }
      payload = {
        type: 'DEBT_PAYMENT',
        amount: finalAmount,
        sourceAccountId,
        debtId,
        ...(splitDebtPayment
          ? {
              principalPaid: finalPrincipal,
              interestPaid: finalInterest,
            }
          : {}),
        transactionDate: dateInputToTransactionDate(transactionDate),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
    }

    try {
      const response = await createTxMutation.mutateAsync(payload);

      if (tab === 'EXPENSE' && selectedCategory) {
        const updatedCatSpent = sumMoney([selectedCategorySpent, finalAmount]);
        const labelNote = note.trim() ? note.trim() : selectedCategory.name;
        showToast({
          variant: 'success',
          message: `${labelNote} ${formatRupiah(finalAmount)} tersimpan. Total kategori ${selectedCategory.name} bulan ini: ${formatRupiah(updatedCatSpent)}.`,
        });
      } else if (tab === 'INCOME' && sourceAccount) {
        showToast({
          variant: 'success',
          message: `Pemasukan ${formatRupiah(finalAmount)} ke ${sourceAccount.name} berhasil dicatat.`,
        });
      } else if (tab === 'TRANSFER' && sourceAccount && destinationAccount) {
        showToast({
          variant: 'success',
          message: `Transfer ${formatRupiah(finalAmount)} dari ${sourceAccount.name} ke ${destinationAccount.name} berhasil.`,
        });
      } else if (tab === 'DEBT_PAYMENT' && selectedDebt) {
        showToast({
          variant: 'success',
          message: `Cicilan ${selectedDebt.name} sebesar ${formatRupiah(finalAmount)} berhasil dicatat.`,
        });
      } else {
        showToast({
          variant: 'success',
          message: response.message || 'Transaksi berhasil disimpan.',
        });
      }

      for (const warning of response.meta?.warnings ?? []) {
        showToast({
          variant: 'warning',
          message: warning,
          durationMs: 6500,
        });
      }

      closeQuickAdd();
    } catch (error) {
      setFormError(extractApiErrorMessage(error, 'Gagal menyimpan transaksi.'));
    }
  };

  const activeTabConfig = TAB_CONFIG.find((item) => item.type === tab) ?? TAB_CONFIG[0]!;
  const destinationCandidates = accounts.filter((acc) => acc.id !== sourceAccountId);
  const isSubmitDisabled =
    createTxMutation.isPending ||
    accounts.length === 0 ||
    (tab === 'TRANSFER' && destinationCandidates.length === 0) ||
    (tab === 'DEBT_PAYMENT' && (activeDebts.length === 0 || Boolean(debtValidationError)));

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeQuickAdd}
      title="Catat Transaksi Cepat"
      subtitle="Tekan Shift + N kapan saja di desktop untuk membuka jendela ini."
      maxWidthClass="max-w-lg"
    >
      {/* 4 Semantic Transaction Type Tabs */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TAB_CONFIG.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.type;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                setTab(item.type);
                setFormError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                isActive
                  ? item.activeClass
                  : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {/* Nominal Input */}
        <MoneyInput
          id="quick-add-amount"
          label="Nominal Transaksi"
          value={amount}
          onChange={setAmount}
          placeholder="Contoh: 25000"
          required
          autoFocus
        />

        {/* Source Account + Live Balance */}
        <div>
          <label htmlFor="quick-add-source" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Wallet className="h-4 w-4 text-slate-400" />
            <span>{tab === 'INCOME' ? 'Masuk ke Akun' : 'Akun Sumber'}</span>
            <span className="text-rose-500">*</span>
          </label>
          <select
            id="quick-add-source"
            value={sourceAccountId}
            onChange={(event) => setSourceAccountId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({formatRupiah(acc.balance)})
              </option>
            ))}
          </select>
          {sourceAccount && (
            <p className="mt-1 text-xs text-slate-500">
              Saldo tersedia:{' '}
              <span className="money font-semibold text-slate-800">{formatRupiah(sourceAccount.balance)}</span>
            </p>
          )}
        </div>

        {/* EXPENSE Category Selector + Live Monthly Category Spend */}
        {tab === 'EXPENSE' && (
          <div>
            <label
              htmlFor="quick-add-expense-category"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
            >
              <Layers className="h-4 w-4 text-slate-400" />
              <span>Kategori Pengeluaran</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              id="quick-add-expense-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              {essentialCategories.length > 0 && (
                <optgroup label="Kebutuhan Pokok (Essential)">
                  {essentialCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {discretionaryCategories.length > 0 && (
                <optgroup label="Keinginan (Discretionary)">
                  {discretionaryCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>
                Terpakai bulan ini:{' '}
                <strong className="money font-semibold text-slate-800">{formatRupiah(selectedCategorySpent)}</strong>
              </span>
              {selectedCategory && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    selectedCategory.expenseClass === 'ESSENTIAL'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {selectedCategory.expenseClass === 'ESSENTIAL' ? 'Kebutuhan Pokok' : 'Keinginan'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* INCOME Category Selector */}
        {tab === 'INCOME' && (
          <div>
            <label
              htmlFor="quick-add-income-category"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
            >
              <Layers className="h-4 w-4 text-slate-400" />
              <span>Kategori Pemasukan</span>
            </label>
            <select
              id="quick-add-income-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tanpa Kategori</option>
              {incomeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* TRANSFER Destination Account Selector */}
        {tab === 'TRANSFER' && (
          <div>
            <label
              htmlFor="quick-add-destination"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
            >
              <ArrowLeftRight className="h-4 w-4 text-slate-400" />
              <span>Akun Tujuan</span>
              <span className="text-rose-500">*</span>
            </label>
            {destinationCandidates.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                Anda memerlukan minimal 2 akun untuk melakukan transfer antar akun. Tambahkan akun baru di menu Akun &amp;
                Kategori.
              </div>
            ) : (
              <>
                <select
                  id="quick-add-destination"
                  value={destinationAccountId}
                  onChange={(event) => setDestinationAccountId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                >
                  {destinationCandidates.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatRupiah(acc.balance)})
                    </option>
                  ))}
                </select>
                {destinationAccount && (
                  <p className="mt-1 text-xs text-slate-500">
                    Saldo akun tujuan saat ini:{' '}
                    <span className="money font-semibold text-slate-800">
                      {formatRupiah(destinationAccount.balance)}
                    </span>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* DEBT_PAYMENT Active Debt Selector + Optional Principal/Interest Split */}
        {tab === 'DEBT_PAYMENT' && (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="quick-add-debt"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
              >
                <CreditCard className="h-4 w-4 text-slate-400" />
                <span>Pilih Utang Aktif</span>
                <span className="text-rose-500">*</span>
              </label>
              {activeDebts.length === 0 ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-3 text-xs font-medium text-violet-900">
                  Anda tidak memiliki utang aktif yang perlu dibayar.
                </div>
              ) : (
                <>
                  <select
                    id="quick-add-debt"
                    value={debtId}
                    onChange={(event) => setDebtId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  >
                    {activeDebts.map((debt) => (
                      <option key={debt.id} value={debt.id}>
                        {debt.name} — Sisa {formatRupiah(debt.remainingBalance)}
                      </option>
                    ))}
                  </select>
                  {selectedDebt && (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        Sisa utang:{' '}
                        <strong className="money font-semibold text-slate-800">
                          {formatRupiah(selectedDebt.remainingBalance)}
                        </strong>
                      </span>
                      <span>
                        Cicilan minimum:{' '}
                        <strong className="money font-semibold text-slate-700">
                          {formatRupiah(selectedDebt.minimumMonthlyPay)}/bln
                        </strong>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {activeDebts.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                  <span>Rincikan Pokok &amp; Bunga Utang</span>
                  <input
                    type="checkbox"
                    checked={splitDebtPayment}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setSplitDebtPayment(next);
                      if (next && isValidPositiveMoney(finalAmount)) {
                        setPrincipalPaid(finalAmount);
                        setInterestPaid('0');
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {splitDebtPayment && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MoneyInput
                      id="quick-add-principal"
                      label="Pokok Dibayar"
                      value={principalPaid}
                      onChange={handleAutoFillInterest}
                      placeholder="0"
                    />
                    <MoneyInput
                      id="quick-add-interest"
                      label="Bunga Dibayar"
                      value={interestPaid}
                      onChange={setInterestPaid}
                      placeholder="0"
                    />
                  </div>
                )}

                {debtValidationError && (
                  <p className="mt-2 text-xs font-medium text-rose-600">{debtValidationError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline Overdraft Warning (Golden Rule #5) */}
        {isOverdraft && sourceAccount && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-xs text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="leading-relaxed">
              <p className="font-semibold">Peringatan Saldo Tidak Mencukupi (Overdraft)</p>
              <p className="mt-0.5">
                Nominal melebihi saldo tersedia di <strong>{sourceAccount.name}</strong> (
                <span className="money font-semibold">{formatRupiah(sourceAccount.balance)}</span>). Saldo akun akan
                menjadi <span className="money font-semibold">{formatRupiah(projectedNegativeBalance)}</span> jika
                dilanjutkan.
              </p>
            </div>
          </div>
        )}

        {/* Date & Optional Note */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="quick-add-date"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
            >
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Tanggal</span>
            </label>
            <input
              id="quick-add-date"
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label
              htmlFor="quick-add-note"
              className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700"
            >
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Catatan (Opsional)</span>
            </label>
            <input
              id="quick-add-note"
              type="text"
              maxLength={255}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Contoh: Kopi susu gula aren"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {formError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {formError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={closeQuickAdd}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${activeTabConfig.submitClass}`}
          >
            {createTxMutation.isPending ? 'Menyimpan...' : `Simpan ${activeTabConfig.label}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

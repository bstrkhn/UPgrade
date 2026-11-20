import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, Trash2 } from 'lucide-react';
import { extractApiErrorMessage } from '../../api/client';
import { useDeleteTransaction } from '../../api/hooks/useTransactions';
import type { PublicTransaction } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { formatRupiah } from '../../utils/currency';
import { formatDateId } from '../../utils/date';

interface TransactionRowProps {
  transaction: PublicTransaction;
}

const TYPE_META = {
  INCOME: {
    label: 'Pemasukan',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    iconBoxClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amountClass: 'text-emerald-600',
    prefix: '+',
    Icon: ArrowDownLeft,
  },
  EXPENSE: {
    label: 'Pengeluaran',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    iconBoxClass: 'bg-rose-50 text-rose-600 border-rose-200',
    amountClass: 'text-rose-600',
    prefix: '-',
    Icon: ArrowUpRight,
  },
  TRANSFER: {
    label: 'Transfer',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    iconBoxClass: 'bg-blue-50 text-blue-600 border-blue-200',
    amountClass: 'text-blue-600',
    prefix: '',
    Icon: ArrowLeftRight,
  },
  DEBT_PAYMENT: {
    label: 'Bayar Utang',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    iconBoxClass: 'bg-violet-50 text-violet-600 border-violet-200',
    amountClass: 'text-violet-600',
    prefix: '-',
    Icon: CreditCard,
  },
} as const;

export function TransactionRow({ transaction }: TransactionRowProps) {
  const { showToast, showUndoToast } = useToast();
  const deleteMutation = useDeleteTransaction();
  const meta = TYPE_META[transaction.type];
  const Icon = meta.Icon;

  const primaryTitle =
    transaction.note ||
    (transaction.type === 'TRANSFER'
      ? `Transfer ke ${transaction.destinationAccount?.name ?? 'Akun Tujuan'}`
      : transaction.type === 'DEBT_PAYMENT'
        ? `Pembayaran ${transaction.debt?.name ?? 'Utang'}`
        : transaction.category?.name ?? meta.label);

  const accountSubtitle =
    transaction.type === 'TRANSFER'
      ? `${transaction.sourceAccount.name} → ${transaction.destinationAccount?.name ?? '-'}`
      : transaction.sourceAccount.name;

  const handleDelete = async () => {
    if (deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      showUndoToast({
        message: 'Transaksi dihapus — Urungkan dalam 7 detik',
        transactionId: transaction.id,
        durationMs: 7000,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Gagal menghapus transaksi.'),
      });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 transition hover:border-slate-300">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.iconBoxClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{primaryTitle}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}>
              {transaction.category ? transaction.category.name : meta.label}
            </span>
            {transaction.category?.expenseClass && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {transaction.category.expenseClass === 'ESSENTIAL' ? 'Kebutuhan' : 'Keinginan'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {accountSubtitle} • {formatDateId(transaction.transactionDate)}
            {transaction.type === 'DEBT_PAYMENT' && transaction.principalPaid && transaction.interestPaid && (
              <span className="money ml-1 text-slate-400">
                (Pokok {formatRupiah(transaction.principalPaid)}, Bunga {formatRupiah(transaction.interestPaid)})
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className={`money text-sm font-bold ${meta.amountClass}`}>
          {meta.prefix}
          {formatRupiah(transaction.amount)}
        </span>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleteMutation.isPending}
          title="Hapus transaksi (dapat diurungkan)"
          aria-label={`Hapus transaksi ${primaryTitle}`}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

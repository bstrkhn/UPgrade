import { ChevronLeft, ChevronRight, Filter, Plus, ReceiptText, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useAccounts } from '../api/hooks/useAccounts';
import { useCategories } from '../api/hooks/useCategories';
import { useTransactions } from '../api/hooks/useTransactions';
import type { TransactionType } from '../api/types';
import { EmptyState } from '../components/common/EmptyState';
import { TransactionRow } from '../components/transactions/TransactionRow';
import { useQuickAdd } from '../context/QuickAddContext';

export function TransactionsPage() {
  const { openQuickAdd } = useQuickAdd();

  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('');
  const [accountIdFilter, setAccountIdFilter] = useState('');
  const [categoryIdFilter, setCategoryIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const isDateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const transactionsQuery = useTransactions(
    {
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(accountIdFilter ? { accountId: accountIdFilter } : {}),
      ...(categoryIdFilter ? { categoryId: categoryIdFilter } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
      page,
      pageSize,
    },
    !isDateRangeInvalid,
  );

  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];
  const meta = transactionsQuery.data?.meta ?? { page: 1, pageSize, total: 0, totalPages: 1 };

  const hasActiveFilter = Boolean(typeFilter || accountIdFilter || categoryIdFilter || fromDate || toDate);

  const handleResetFilters = () => {
    setTypeFilter('');
    setAccountIdFilter('');
    setCategoryIdFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Riwayat Transaksi</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Telusuri, saring, atau hapus transaksi dengan fitur pemulihan instan 7 detik
          </p>
        </div>
        <button
          type="button"
          onClick={() => openQuickAdd('EXPENSE')}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-600 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Catat Transaksi</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>Filter Transaksi</span>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Atur Ulang Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="tx-filter-type" className="mb-1 block text-xs font-medium text-slate-600">
              Jenis Transaksi
            </label>
            <select
              id="tx-filter-type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as TransactionType | '');
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Semua Jenis</option>
              <option value="EXPENSE">Pengeluaran</option>
              <option value="INCOME">Pemasukan</option>
              <option value="TRANSFER">Transfer Antar Akun</option>
              <option value="DEBT_PAYMENT">Bayar Utang</option>
            </select>
          </div>

          <div>
            <label htmlFor="tx-filter-account" className="mb-1 block text-xs font-medium text-slate-600">
              Akun
            </label>
            <select
              id="tx-filter-account"
              value={accountIdFilter}
              onChange={(event) => {
                setAccountIdFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Semua Akun</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tx-filter-category" className="mb-1 block text-xs font-medium text-slate-600">
              Kategori
            </label>
            <select
              id="tx-filter-category"
              value={categoryIdFilter}
              onChange={(event) => {
                setCategoryIdFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tx-filter-from" className="mb-1 block text-xs font-medium text-slate-600">
              Dari Tanggal (WIB)
            </label>
            <input
              id="tx-filter-from"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="tx-filter-to" className="mb-1 block text-xs font-medium text-slate-600">
              Sampai Tanggal (WIB)
            </label>
            <input
              id="tx-filter-to"
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {isDateRangeInvalid && (
          <p className="mt-3 text-xs font-medium text-rose-600">
            Tanggal awal tidak boleh setelah tanggal akhir. Silakan sesuaikan rentang tanggal.
          </p>
        )}
      </div>

      {/* Transaction List */}
      {transactionsQuery.isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title={hasActiveFilter ? 'Tidak ada transaksi yang cocok dengan filter' : 'Belum ada riwayat transaksi'}
          description={
            hasActiveFilter
              ? 'Coba ubah atau atur ulang filter pencarian di atas untuk melihat transaksi lainnya.'
              : 'Catat pemasukan, pengeluaran, transfer, atau pembayaran utang pertama Anda sekarang.'
          }
          action={
            hasActiveFilter ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Atur Ulang Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openQuickAdd('EXPENSE')}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
              >
                + Catat Transaksi Sekarang
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2.5">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 sm:flex-row">
            <p className="text-xs text-slate-500">
              Menampilkan halaman <strong className="text-slate-800">{meta.page}</strong> dari{' '}
              <strong className="text-slate-800">{meta.totalPages}</strong> (Total{' '}
              <strong className="text-slate-800">{meta.total}</strong> transaksi)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((prev) => prev + 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

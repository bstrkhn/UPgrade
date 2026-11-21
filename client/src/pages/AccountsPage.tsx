import { Edit3, Layers, Lock, Plus, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { extractApiErrorMessage } from '../api/client';
import { useAccounts, useCreateAccount, useUpdateAccount } from '../api/hooks/useAccounts';
import { useCategories, useCreateCategory, useDeleteCategory } from '../api/hooks/useCategories';
import type { AccountType, CategoryKind, PublicAccount } from '../api/types';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { MoneyInput } from '../components/common/MoneyInput';
import { useToast } from '../context/ToastContext';
import { ACCOUNT_TYPE_LABELS } from '../utils/constants';
import {
  finalizeMoneyInput,
  formatRupiah,
  isNegativeMoney,
  isValidNonNegativeMoney,
  sumMoney,
} from '../utils/currency';

const CATEGORY_SECTIONS: Array<{
  kind: CategoryKind;
  title: string;
  subtitle: string;
  badgeClass: string;
}> = [
  {
    kind: 'ESSENTIAL',
    title: 'Pengeluaran Kebutuhan Pokok',
    subtitle: 'Biaya hidup wajib untuk perhitungan Dana Darurat & FIRE',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  {
    kind: 'DISCRETIONARY',
    title: 'Pengeluaran Keinginan',
    subtitle: 'Gaya hidup, hiburan, dan audit Latte Factor',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    kind: 'INCOME',
    title: 'Kategori Pemasukan',
    subtitle: 'Sumber penghasilan utama maupun sampingan',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
];

export function AccountsPage() {
  const { showToast } = useToast();

  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // Create Account modal state
  const [isCreateAccOpen, setIsCreateAccOpen] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('BANK');
  const [accBalance, setAccBalance] = useState('0');
  const [accIsLiquid, setAccIsLiquid] = useState(true);
  const [accFormError, setAccFormError] = useState<string | null>(null);

  // Edit Account modal state (never edits balance directly)
  const [editingAccount, setEditingAccount] = useState<PublicAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('BANK');
  const [editIsLiquid, setEditIsLiquid] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Create Category modal state
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catKind, setCatKind] = useState<CategoryKind>('ESSENTIAL');
  const [catError, setCatError] = useState<string | null>(null);

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const totalAssets = useMemo(() => sumMoney(accounts.map((acc) => acc.balance)), [accounts]);

  const openEditAccount = (account: PublicAccount) => {
    setEditingAccount(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditIsLiquid(account.isLiquid);
    setEditError(null);
  };

  const handleCreateAccount = async (event: FormEvent) => {
    event.preventDefault();
    setAccFormError(null);

    if (!accName.trim()) {
      setAccFormError('Nama akun wajib diisi.');
      return;
    }
    const cleanBalance = finalizeMoneyInput(accBalance || '0');
    if (!isValidNonNegativeMoney(cleanBalance)) {
      setAccFormError('Saldo awal tidak valid.');
      return;
    }

    try {
      const response = await createAccountMutation.mutateAsync({
        name: accName.trim(),
        type: accType,
        balance: cleanBalance,
        isLiquid: accIsLiquid,
      });
      showToast({
        variant: 'success',
        message: response.message || `Akun "${response.data.account.name}" berhasil dibuat.`,
      });
      setIsCreateAccOpen(false);
      setAccName('');
      setAccBalance('0');
    } catch (error) {
      setAccFormError(extractApiErrorMessage(error, 'Gagal membuat akun.'));
    }
  };

  const handleUpdateAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingAccount) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError('Nama akun wajib diisi.');
      return;
    }

    try {
      const response = await updateAccountMutation.mutateAsync({
        id: editingAccount.id,
        payload: {
          name: editName.trim(),
          type: editType,
          isLiquid: editIsLiquid,
        },
      });
      showToast({
        variant: 'success',
        message: response.message || `Akun "${response.data.account.name}" berhasil diperbarui.`,
      });
      setEditingAccount(null);
    } catch (error) {
      setEditError(extractApiErrorMessage(error, 'Gagal memperbarui akun.'));
    }
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    setCatError(null);

    if (!catName.trim()) {
      setCatError('Nama kategori wajib diisi.');
      return;
    }

    try {
      const response = await createCategoryMutation.mutateAsync({
        name: catName.trim(),
        kind: catKind,
      });
      showToast({
        variant: 'success',
        message: response.message || `Kategori "${response.data.category.name}" berhasil dibuat.`,
      });
      setIsCreateCatOpen(false);
      setCatName('');
    } catch (error) {
      setCatError(extractApiErrorMessage(error, 'Gagal membuat kategori.'));
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (deleteCategoryMutation.isPending) return;
    try {
      const response = await deleteCategoryMutation.mutateAsync(id);
      showToast({
        variant: 'success',
        message: response.message || `Kategori "${name}" berhasil dihapus.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Kategori tidak dapat dihapus.'),
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: ASSET ACCOUNTS */}
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Akun Aset &amp; Kategori</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Kelola dompet, rekening bank, dana darurat, investasi, serta kategori transaksi kustom Anda
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-right">
              <p className="text-[11px] font-medium text-emerald-800">Total Seluruh Aset</p>
              <p className="money text-sm font-extrabold text-emerald-700">{formatRupiah(totalAssets)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAccFormError(null);
                setAccName('');
                setAccType('BANK');
                setAccBalance('0');
                setAccIsLiquid(true);
                setIsCreateAccOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Akun</span>
            </button>
          </div>
        </div>

        {accountsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Belum ada akun aset terdaftar"
            description="Tambahkan minimal satu akun aset untuk mulai mencatat pemasukan dan pengeluaran."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => {
              const negative = isNegativeMoney(acc.balance);
              return (
                <div
                  key={acc.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-2xs ${
                    negative ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">{acc.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {ACCOUNT_TYPE_LABELS[acc.type]}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            acc.isLiquid ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {acc.isLiquid ? 'Aset Likuid' : 'Non-Likuid'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditAccount(acc)}
                      title="Ubah nama, tipe, atau status likuiditas akun"
                      aria-label={`Ubah akun ${acc.name}`}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-[11px] text-slate-400">Saldo Saat Ini</p>
                    <p className={`money text-xl font-extrabold ${negative ? 'text-amber-700' : 'text-slate-900'}`}>
                      {formatRupiah(acc.balance)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: CATEGORIES */}
      <section className="space-y-4 border-t border-slate-200 pt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kategori Transaksi</h2>
            <p className="text-xs text-slate-500">
              Kategori bawaan sistem dilindungi otomatis. Anda dapat menambahkan kategori kustom sesuai kebutuhan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCatError(null);
              setCatName('');
              setCatKind('ESSENTIAL');
              setIsCreateCatOpen(true);
            }}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50 sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Kategori Kustom</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CATEGORY_SECTIONS.map((section) => {
            const list = categories.filter((cat) => cat.kind === section.kind);
            return (
              <div key={section.kind} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">{section.subtitle}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${section.badgeClass}`}>
                    {list.length}
                  </span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {list.map((cat) => (
                    <li key={cat.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate text-xs font-semibold text-slate-800">{cat.name}</span>
                      </div>
                      {cat.isSystem ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          <Lock className="h-2.5 w-2.5" />
                          Sistem
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCategory(cat.id, cat.name)}
                          disabled={deleteCategoryMutation.isPending}
                          title="Hapus kategori kustom"
                          aria-label={`Hapus kategori ${cat.name}`}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Create Account Modal */}
      <Modal
        isOpen={isCreateAccOpen}
        onClose={() => setIsCreateAccOpen(false)}
        title="Tambah Akun Aset Baru"
        subtitle="Daftarkan dompet, rekening bank, dana darurat, atau akun investasi."
      >
        <form onSubmit={(event) => void handleCreateAccount(event)} className="space-y-4">
          <div>
            <label htmlFor="acc-create-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nama Akun<span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              id="acc-create-name"
              type="text"
              maxLength={80}
              required
              autoFocus
              value={accName}
              onChange={(event) => setAccName(event.target.value)}
              placeholder="Contoh: BCA Tahapan / Bibit Reksa Dana"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="acc-create-type" className="mb-1.5 block text-sm font-medium text-slate-700">
              Jenis Akun
            </label>
            <select
              id="acc-create-type"
              value={accType}
              onChange={(event) => {
                const nextType = event.target.value as AccountType;
                setAccType(nextType);
                setAccIsLiquid(nextType !== 'INVESTMENT');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="CASH">Tunai / Dompet</option>
              <option value="BANK">Rekening Bank</option>
              <option value="EWALLET">E-Wallet</option>
              <option value="EMERGENCY_FUND">Tabungan Dana Darurat</option>
              <option value="INVESTMENT">Portofolio Investasi</option>
            </select>
          </div>

          <MoneyInput
            id="acc-create-balance"
            label="Saldo Awal"
            value={accBalance}
            onChange={setAccBalance}
            placeholder="0"
          />

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-xs font-medium text-slate-700">
            <span>Aset Likuid (mudah dicairkan sewaktu-waktu)</span>
            <input
              type="checkbox"
              checked={accIsLiquid}
              onChange={(event) => setAccIsLiquid(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          {accFormError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {accFormError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateAccOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createAccountMutation.isPending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {createAccountMutation.isPending ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal (No Direct Balance Edit) */}
      <Modal
        isOpen={Boolean(editingAccount)}
        onClose={() => setEditingAccount(null)}
        title="Ubah Pengaturan Akun"
        subtitle="Demi akurasi audit keuangan, perubahan saldo hanya dilakukan melalui pencatatan transaksi."
      >
        <form onSubmit={(event) => void handleUpdateAccount(event)} className="space-y-4">
          <div>
            <label htmlFor="acc-edit-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nama Akun<span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              id="acc-edit-name"
              type="text"
              maxLength={80}
              required
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="acc-edit-type" className="mb-1.5 block text-sm font-medium text-slate-700">
              Jenis Akun
            </label>
            <select
              id="acc-edit-type"
              value={editType}
              onChange={(event) => setEditType(event.target.value as AccountType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="CASH">Tunai / Dompet</option>
              <option value="BANK">Rekening Bank</option>
              <option value="EWALLET">E-Wallet</option>
              <option value="EMERGENCY_FUND">Tabungan Dana Darurat</option>
              <option value="INVESTMENT">Portofolio Investasi</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-xs font-medium text-slate-700">
            <span>Aset Likuid (mudah dicairkan sewaktu-waktu)</span>
            <input
              type="checkbox"
              checked={editIsLiquid}
              onChange={(event) => setEditIsLiquid(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          {editingAccount && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              Saldo tercatat saat ini:{' '}
              <strong className="money font-bold text-slate-900">{formatRupiah(editingAccount.balance)}</strong>
            </div>
          )}

          {editError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {editError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setEditingAccount(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateAccountMutation.isPending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {updateAccountMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Custom Category Modal */}
      <Modal
        isOpen={isCreateCatOpen}
        onClose={() => setIsCreateCatOpen(false)}
        title="Tambah Kategori Kustom"
        subtitle="Buat kategori baru sesuai kebiasaan pemasukan atau pengeluaran Anda."
      >
        <form onSubmit={(event) => void handleCreateCategory(event)} className="space-y-4">
          <div>
            <label htmlFor="cat-create-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nama Kategori<span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              id="cat-create-name"
              type="text"
              maxLength={60}
              required
              autoFocus
              value={catName}
              onChange={(event) => setCatName(event.target.value)}
              placeholder="Contoh: Sedekah / Perawatan Hewan"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="cat-create-kind" className="mb-1.5 block text-sm font-medium text-slate-700">
              Kelompok Kategori
            </label>
            <select
              id="cat-create-kind"
              value={catKind}
              onChange={(event) => setCatKind(event.target.value as CategoryKind)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ESSENTIAL">Pengeluaran Kebutuhan Pokok (Essential)</option>
              <option value="DISCRETIONARY">Pengeluaran Keinginan (Discretionary)</option>
              <option value="INCOME">Pemasukan (Income)</option>
            </select>
          </div>

          {catError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {catError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateCatOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createCategoryMutation.isPending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {createCategoryMutation.isPending ? 'Menyimpan...' : 'Simpan Kategori'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

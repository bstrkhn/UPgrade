import {
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Layers,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { extractApiErrorMessage } from '../api/client';
import { useCreateSnapshot, useNetWorthSnapshots } from '../api/hooks/useAnalytics';
import { downloadMonthlyPdf } from '../api/hooks/useReports';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { useToast } from '../context/ToastContext';
import { ACCOUNT_TYPE_LABELS } from '../utils/constants';
import {
  calculatePercentage,
  clampPercentBarWidth,
  compareMoney,
  formatPercent,
  formatRupiah,
  isNegativeMoney,
} from '../utils/currency';
import {
  formatPeriodId,
  getCurrentWibPeriod,
  isSamePeriod,
  monthNameId,
  shiftPeriod,
  type Period,
} from '../utils/date';

export function NetWorthPage() {
  const { showToast } = useToast();
  const currentWibPeriod = useMemo(() => getCurrentWibPeriod(), []);

  const [snapshotPeriod, setSnapshotPeriod] = useState<Period>(currentWibPeriod);
  const [pdfPeriod, setPdfPeriod] = useState<Period>(currentWibPeriod);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const snapshotsQuery = useNetWorthSnapshots();
  const createSnapshotMutation = useCreateSnapshot();

  const balanceSheet = snapshotsQuery.data?.currentBalanceSheet;
  const snapshots = useMemo(() => snapshotsQuery.data?.snapshots ?? [], [snapshotsQuery.data?.snapshots]);

  const handleSaveSnapshot = async (targetPeriod: Period = snapshotPeriod) => {
    try {
      const response = await createSnapshotMutation.mutateAsync({
        year: targetPeriod.year,
        month: targetPeriod.month,
      });
      showToast({
        variant: 'success',
        message:
          response.message || `Snapshot Neraca periode ${formatPeriodId(targetPeriod)} berhasil disimpan.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Gagal menyimpan snapshot neraca bulanan.'),
      });
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const filename = await downloadMonthlyPdf(pdfPeriod.year, pdfPeriod.month);
      showToast({
        variant: 'success',
        message: `Laporan PDF "${filename}" berhasil diunduh.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Gagal mengunduh laporan PDF bulanan.'),
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Convert string money to Number ONLY at the Recharts data boundary
  const chartData = useMemo(
    () =>
      snapshots.map((item) => ({
        label: `${monthNameId(item.snapshotMonth).slice(0, 3)} ${item.snapshotYear}`,
        KekayaanBersih: Number(item.netWorth),
        TotalAset: Number(item.totalAssets),
        TotalLiabilitas: Number(item.totalLiabilities),
      })),
    [snapshots],
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Neraca Kekayaan, Snapshot Historis &amp; Laporan PDF
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Pantau komposisi aset vs liabilitas, rekam <em>Tutup Buku Bulanan</em>, dan ekspor laporan keuangan PDF A4
          </p>
        </div>

        <button
          type="button"
          disabled={createSnapshotMutation.isPending}
          onClick={() => void handleSaveSnapshot(currentWibPeriod)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-600 disabled:opacity-50 sm:self-auto"
        >
          <Archive className="h-4 w-4" />
          <span>
            {createSnapshotMutation.isPending
              ? 'Menyimpan...'
              : `Tutup Buku ${formatPeriodId(currentWibPeriod)}`}
          </span>
        </button>
      </div>

      {snapshotsQuery.isError && (
        <ErrorBanner
          message={extractApiErrorMessage(snapshotsQuery.error, 'Gagal memuat data neraca dan snapshot.')}
          onRetry={() => void snapshotsQuery.refetch()}
        />
      )}

      {/* 3 Balance Sheet KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Total Aset Saat Ini</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="money mt-3 text-2xl font-extrabold text-emerald-600">
            {formatRupiah(balanceSheet?.totalAssets ?? '0')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Likuid: <strong className="money text-slate-700">{formatRupiah(balanceSheet?.liquidAssetsTotal ?? '0')}</strong>{' '}
            • Non-Likuid:{' '}
            <strong className="money text-slate-700">{formatRupiah(balanceSheet?.nonLiquidAssetsTotal ?? '0')}</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Total Liabilitas (Utang Aktif)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="money mt-3 text-2xl font-extrabold text-rose-600">
            {formatRupiah(balanceSheet?.totalLiabilities ?? '0')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Konsumtif:{' '}
            <strong className="money text-rose-700">{formatRupiah(balanceSheet?.consumptiveDebtTotal ?? '0')}</strong> •
            Produktif:{' '}
            <strong className="money text-slate-700">{formatRupiah(balanceSheet?.productiveDebtTotal ?? '0')}</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-indigo-700 uppercase">
              Kekayaan Bersih (Net Worth)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`money mt-3 text-2xl font-extrabold ${
              balanceSheet && isNegativeMoney(balanceSheet.netWorth) ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatRupiah(balanceSheet?.netWorth ?? '0')}
          </p>
          <p className="mt-1 text-xs text-slate-600">Selisih bersih seluruh aset dikurangi sisa pokok utang aktif</p>
        </div>
      </div>

      {/* Live Balance Sheet Composition: Assets by Type vs Liabilities */}
      {balanceSheet && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Assets by AccountType */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Komposisi Aset Berdasarkan Jenis Akun</h2>
                <p className="text-xs text-slate-500">Proporsi distribusi kekayaan Anda saat ini</p>
              </div>
              <Layers className="h-4 w-4 text-emerald-600" />
            </div>

            <div className="space-y-3">
              {balanceSheet.assetsByType.map((item) => {
                const sharePct = calculatePercentage(item.totalBalance, balanceSheet.totalAssets);
                const barWidth = clampPercentBarWidth(sharePct);
                return (
                  <div key={item.type} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {ACCOUNT_TYPE_LABELS[item.type]}{' '}
                        <span className="font-normal text-slate-400">({item.count} akun)</span>
                      </span>
                      <span className="money font-extrabold text-slate-900">
                        {formatRupiah(item.totalBalance)}{' '}
                        <span className="text-[11px] font-semibold text-emerald-600">({formatPercent(sharePct)})</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Liabilities & Monthly PDF Report Export Card */}
          <div className="flex flex-col justify-between gap-4">
            {/* Liabilities Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Struktur Kewajiban &amp; Liabilitas</h2>
                  <p className="text-xs text-slate-500">Pemisahan utang konsumtif terhadap utang produktif</p>
                </div>
                <CreditCard className="h-4 w-4 text-rose-600" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3.5">
                  <p className="text-xs font-semibold text-rose-800">Utang Konsumtif Aktif</p>
                  <p className="money mt-1 text-lg font-extrabold text-rose-600">
                    {formatRupiah(balanceSheet.consumptiveDebtTotal)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {compareMoney(balanceSheet.consumptiveDebtTotal, '0') === 0
                      ? 'Bersih Rp0 (Syarat L4 Terpenuhi)'
                      : 'Paylater, Kartu Kredit, KTA'}
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3.5">
                  <p className="text-xs font-semibold text-indigo-800">Utang Produktif / Aset</p>
                  <p className="money mt-1 text-lg font-extrabold text-indigo-700">
                    {formatRupiah(balanceSheet.productiveDebtTotal)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">KPR atau pembiayaan modal produktif</p>
                </div>
              </div>
            </div>

            {/* Monthly PDF Export Panel */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Ekspor Laporan Keuangan Bulanan (PDF A4)</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                    Unduh dokumen PDF berisi Ringkasan Eksekutif Arus Kas, Neraca, Status Level UPgrade, Top 5
                    Pengeluaran, Audit Latte Factor, dan Buku Besar Transaksi.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <div className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => setPdfPeriod((prev) => shiftPeriod(prev, -1))}
                    aria-label="Periode PDF sebelumnya"
                    className="rounded-lg p-1.5 text-slate-200 transition hover:bg-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-32 px-2.5 text-center text-xs font-bold text-white">
                    {formatPeriodId(pdfPeriod)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPdfPeriod((prev) => shiftPeriod(prev, 1))}
                    aria-label="Periode PDF berikutnya"
                    className="rounded-lg p-1.5 text-slate-200 transition hover:bg-white/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isDownloadingPdf}
                  onClick={() => void handleDownloadPdf()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  <span>{isDownloadingPdf ? 'Menyiapkan PDF...' : 'Unduh Laporan Bulanan (PDF)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Net Worth Snapshots & Tutup Buku Bulanan */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Tren Snapshot Kekayaan Bersih &amp; Tutup Buku Bulanan
            </h2>
            <p className="text-xs text-slate-500">
              Simpan rekaman neraca setiap akhir bulan untuk memantau pertumbuhan kekayaan bersih dari waktu ke waktu
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setSnapshotPeriod((prev) => shiftPeriod(prev, -1))}
                aria-label="Bulan snapshot sebelumnya"
                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-32 px-2.5 text-center text-xs font-bold text-slate-800">
                {formatPeriodId(snapshotPeriod)}
              </span>
              <button
                type="button"
                onClick={() => setSnapshotPeriod((prev) => shiftPeriod(prev, 1))}
                aria-label="Bulan snapshot berikutnya"
                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={createSnapshotMutation.isPending}
              onClick={() => void handleSaveSnapshot(snapshotPeriod)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {createSnapshotMutation.isPending
                  ? 'Menyimpan...'
                  : `Simpan Snapshot ${formatPeriodId(snapshotPeriod)}`}
              </span>
            </button>
          </div>
        </div>

        {!isSamePeriod(snapshotPeriod, currentWibPeriod) && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs text-indigo-900">
            <strong>Catatan Transparansi Data:</strong> Total Aset &amp; Liabilitas diambil dari posisi saldo aktif saat
            ini, sedangkan <em>Saving Rate</em> dihitung dari arus kas periode{' '}
            <strong>{formatPeriodId(snapshotPeriod)}</strong>.
          </div>
        )}

        {snapshotsQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        ) : snapshots.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6 text-indigo-600" />}
            title="Belum Ada Rekaman Snapshot Historis"
            description="Klik tombol 'Simpan Snapshot' untuk merekam posisi Total Aset, Total Utang, Kekayaan Bersih, dan Saving Rate bulan ini."
            action={
              <button
                type="button"
                disabled={createSnapshotMutation.isPending}
                onClick={() => void handleSaveSnapshot(currentWibPeriod)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                + Simpan Snapshot Bulan Ini ({formatPeriodId(currentWibPeriod)})
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Recharts Historical Trend Chart */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 18, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="nwNetWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val: number) => formatRupiah(String(Math.round(val)))}
                    width={110}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatRupiah(String(Math.round(Number(value ?? 0)))),
                      '',
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="KekayaanBersih"
                    name="Kekayaan Bersih (Net Worth)"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fill="url(#nwNetWorthGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="TotalAset"
                    name="Total Aset"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                  <Area
                    type="monotone"
                    dataKey="TotalLiabilitas"
                    name="Total Liabilitas"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Historical Snapshot Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Periode Snapshot</th>
                    <th className="px-4 py-3 text-right">Total Aset</th>
                    <th className="px-4 py-3 text-right">Total Liabilitas</th>
                    <th className="px-4 py-3 text-right">Kekayaan Bersih</th>
                    <th className="px-4 py-3 text-right">Saving Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshots.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {formatPeriodId({ year: item.snapshotYear, month: item.snapshotMonth })}
                      </td>
                      <td className="money px-4 py-3 text-right font-semibold text-emerald-600">
                        {formatRupiah(item.totalAssets)}
                      </td>
                      <td className="money px-4 py-3 text-right font-semibold text-rose-600">
                        {formatRupiah(item.totalLiabilities)}
                      </td>
                      <td className="money px-4 py-3 text-right font-extrabold text-slate-900">
                        {formatRupiah(item.netWorth)}
                      </td>
                      <td className="money px-4 py-3 text-right font-semibold text-indigo-700">
                        {formatPercent(item.savingRatePct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

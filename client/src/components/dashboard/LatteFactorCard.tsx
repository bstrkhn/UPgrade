import { CheckCircle2, Coffee, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { LatteFactorAnalytics } from '../../api/types';
import { formatPercent, formatRupiah } from '../../utils/currency';
import { Modal } from '../common/Modal';

interface LatteFactorCardProps {
  latteFactor: LatteFactorAnalytics;
}

export function LatteFactorCard({ latteFactor }: LatteFactorCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasLeaks = latteFactor.items.length > 0;

  return (
    <>
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  hasLeaks ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Audit Latte Factor (30 Hari Terakhir)</h3>
                <p className="text-xs text-slate-500">
                  Pengeluaran Keinginan &le;{' '}
                  <span className="money font-semibold text-slate-700">
                    {formatRupiah(latteFactor.microThresholdUsed)}
                  </span>{' '}
                  dengan frekuensi &ge; 3x
                </p>
              </div>
            </div>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                hasLeaks
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {hasLeaks ? `${latteFactor.items.length} Pos Bocor` : 'Terkendali'}
            </span>
          </div>

          {!hasLeaks ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="leading-relaxed">
                <p className="font-bold">Tidak ada kebocoran halus terdeteksi dalam 30 hari terakhir!</p>
                <p className="mt-0.5 text-emerald-800">
                  Pengeluaran mikro kategori Keinginan Anda sangat disiplin (kurang dari 3x per kategori). Pertahankan
                  kebiasaan ini agar arus kas investasi tetap optimal.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3.5">
                <div>
                  <p className="text-[11px] font-medium text-rose-800">Total Bocor 30 Hari</p>
                  <p className="money mt-0.5 text-lg font-extrabold text-rose-600">
                    {formatRupiah(latteFactor.totalMonthlyLeak)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-rose-800">Proyeksi Tahunan (×12)</p>
                  <p className="money mt-0.5 text-lg font-extrabold text-slate-900">
                    {formatRupiah(latteFactor.totalAnnualLeak)}
                  </p>
                </div>
              </div>

              <ul className="mt-3.5 divide-y divide-slate-100">
                {latteFactor.items.slice(0, 3).map((item) => (
                  <li key={item.categoryId} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{item.categoryName}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.monthlyFrequency}x transaksi dalam 30 hari terakhir
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="money text-xs font-bold text-rose-600">{formatRupiah(item.monthlyTotal)}/bln</p>
                      <p className="money text-[11px] text-slate-400">
                        {formatRupiah(item.annualizedProjection)}/thn
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
          <span className="text-[11px] text-slate-400">
            Asumsi return investasi: {formatPercent(latteFactor.expectedReturnRatePct)}/thn
          </span>
          {hasLeaks && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Lihat Dampak Investasi 5 &amp; 10 Tahun</span>
            </button>
          )}
        </div>
      </div>

      {/* Opportunity Cost Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Simulasi Opportunity Cost Latte Factor"
        subtitle={`Jika kebocoran mikro bulanan diinvestasikan rutin dengan asumsi imbal hasil ${formatPercent(latteFactor.expectedReturnRatePct)} per tahun.`}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Potensi Portofolio 5 Tahun (60 Bulan)</span>
              </div>
              <p className="money mt-1 text-xl font-extrabold text-slate-900">
                {formatRupiah(latteFactor.totalOpportunityCost5Yr)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Potensi Portofolio 10 Tahun (120 Bulan)</span>
              </div>
              <p className="money mt-1 text-xl font-extrabold text-emerald-700">
                {formatRupiah(latteFactor.totalOpportunityCost10Yr)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Kategori Keinginan</th>
                  <th className="px-3.5 py-2.5 text-right">Bocor / Bln</th>
                  <th className="px-3.5 py-2.5 text-right">1 Tahun</th>
                  <th className="px-3.5 py-2.5 text-right">Investasi 5 Thn</th>
                  <th className="px-3.5 py-2.5 text-right">Investasi 10 Thn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latteFactor.items.map((item) => (
                  <tr key={item.categoryId} className="hover:bg-slate-50/80">
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                      {item.categoryName}{' '}
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {item.monthlyFrequency}x
                      </span>
                    </td>
                    <td className="money px-3.5 py-2.5 text-right font-semibold text-rose-600">
                      {formatRupiah(item.monthlyTotal)}
                    </td>
                    <td className="money px-3.5 py-2.5 text-right text-slate-700">
                      {formatRupiah(item.annualizedProjection)}
                    </td>
                    <td className="money px-3.5 py-2.5 text-right font-semibold text-indigo-700">
                      {formatRupiah(item.opportunityCost5Yr)}
                    </td>
                    <td className="money px-3.5 py-2.5 text-right font-bold text-emerald-700">
                      {formatRupiah(item.opportunityCost10Yr)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-bold text-slate-900">
                <tr>
                  <td className="px-3.5 py-2.5">Total Akumulasi</td>
                  <td className="money px-3.5 py-2.5 text-right text-rose-600">
                    {formatRupiah(latteFactor.totalMonthlyLeak)}
                  </td>
                  <td className="money px-3.5 py-2.5 text-right">{formatRupiah(latteFactor.totalAnnualLeak)}</td>
                  <td className="money px-3.5 py-2.5 text-right text-indigo-700">
                    {formatRupiah(latteFactor.totalOpportunityCost5Yr)}
                  </td>
                  <td className="money px-3.5 py-2.5 text-right text-emerald-700">
                    {formatRupiah(latteFactor.totalOpportunityCost10Yr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-600"
            >
              Tutup Simulasi
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

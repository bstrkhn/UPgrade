import type { AccountType } from '../api/types';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: 'Tunai',
  BANK: 'Bank',
  EWALLET: 'E-Wallet',
  EMERGENCY_FUND: 'Dana Darurat',
  INVESTMENT: 'Investasi',
};

export const LEVEL_TITLES_ID: Record<number, { title: string; tagline: string }> = {
  1: {
    title: 'Ketergantungan Kritis',
    tagline: 'Fokus hentikan utang konsumtif baru dan catat pengeluaran 30 hari penuh.',
  },
  2: {
    title: 'Kemandirian Dasar',
    tagline: 'Arus kas mulai positif. Sisihkan 1%–10% penghasilan di awal gajian.',
  },
  3: {
    title: 'Ruang Bernapas',
    tagline: 'Dana darurat 1x pengeluaran pokok tercapai. Saatnya lunasi utang lebih cepat.',
  },
  4: {
    title: 'Stabilitas Finansial',
    tagline: 'Bebas utang konsumtif dengan dana darurat 3x pengeluaran pokok.',
  },
  5: {
    title: 'Fleksibilitas',
    tagline: 'Portofolio investasi mencapai minimal 12x biaya hidup bulanan.',
  },
  6: {
    title: 'Kebebasan Finansial Dasar',
    tagline: 'Aset investasi mampu menopang pengeluaran pokok melalui Safe Withdrawal Rate.',
  },
  7: {
    title: 'Kekayaan Melimpah',
    tagline: 'Portofolio melampaui 2x angka FIRE. Fokus pelestarian aset & dampak sosial.',
  },
};

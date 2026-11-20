import type { ExpenseClass } from '@prisma/client';

export interface DefaultCategory {
  name: string;
  expenseClass: ExpenseClass | null;
}

/** Default system categories seeded per user. `expenseClass: null` marks an INCOME category. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  // Pemasukan (INCOME)
  { name: 'Gaji', expenseClass: null },
  { name: 'Bonus & THR', expenseClass: null },
  { name: 'Usaha Sampingan', expenseClass: null },
  { name: 'Hasil Investasi', expenseClass: null },
  { name: 'Hadiah & Lainnya', expenseClass: null },

  // Kebutuhan (ESSENTIAL)
  { name: 'Makan & Kebutuhan Dapur', expenseClass: 'ESSENTIAL' },
  { name: 'Tempat Tinggal (Sewa/KPR)', expenseClass: 'ESSENTIAL' },
  { name: 'Listrik, Air & Internet', expenseClass: 'ESSENTIAL' },
  { name: 'Transportasi', expenseClass: 'ESSENTIAL' },
  { name: 'Kesehatan & BPJS', expenseClass: 'ESSENTIAL' },
  { name: 'Pendidikan', expenseClass: 'ESSENTIAL' },
  { name: 'Asuransi', expenseClass: 'ESSENTIAL' },

  // Keinginan (DISCRETIONARY)
  { name: 'Jajan & Kopi', expenseClass: 'DISCRETIONARY' },
  { name: 'Makan di Luar', expenseClass: 'DISCRETIONARY' },
  { name: 'Hiburan & Langganan', expenseClass: 'DISCRETIONARY' },
  { name: 'Belanja Online', expenseClass: 'DISCRETIONARY' },
  { name: 'Hobi & Gaya Hidup', expenseClass: 'DISCRETIONARY' },
  { name: 'Liburan', expenseClass: 'DISCRETIONARY' },
];

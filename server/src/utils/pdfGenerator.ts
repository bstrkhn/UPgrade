import PDFDocument from 'pdfkit';
import type { ExpenseClass, TransactionType } from '@prisma/client';
import type {
  EmergencyFundResult,
  LatteFactorResult,
  MilestoneEvaluationResult,
} from './financialMath.js';
import { formatRupiah } from './money.js';

export interface MonthlyPdfTopExpenseItem {
  categoryName: string;
  expenseClass: ExpenseClass | null;
  spent: string;
}

export interface MonthlyPdfTransactionItem {
  transactionDate: Date;
  type: TransactionType;
  amount: string;
  note: string | null;
  categoryName: string | null;
  sourceAccountName: string;
  destinationAccountName: string | null;
  debtName: string | null;
}

export interface MonthlyReportPdfData {
  user: {
    name: string;
    email: string;
  };
  period: {
    year: number;
    month: number;
  };
  generatedAt?: Date;
  cashFlow: {
    totalIncome: string;
    totalExpense: string;
    essentialExpense: string;
    discretionaryExpense: string;
    debtPaymentTotal: string;
    surplus: string;
    savingRatePct: string;
  };
  netWorth: {
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
  };
  emergencyFund: EmergencyFundResult;
  latteFactor: LatteFactorResult;
  milestone: MilestoneEvaluationResult;
  topExpenses: MonthlyPdfTopExpenseItem[];
  transactions: MonthlyPdfTransactionItem[];
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const TX_TYPE_LABELS_ID: Record<TransactionType, string> = {
  INCOME: 'Pemasukan',
  EXPENSE: 'Pengeluaran',
  TRANSFER: 'Transfer',
  DEBT_PAYMENT: 'Bayar Utang',
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function formatMonthYearId(year: number, month: number): string {
  return `${MONTH_NAMES_ID[month - 1] ?? String(month)} ${year}`;
}

function formatShortDateWib(date: Date): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const year = shifted.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTimeWib(date: Date): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const day = shifted.getUTCDate();
  const monthName = MONTH_NAMES_ID[shifted.getUTCMonth()] ?? '';
  const year = shifted.getUTCFullYear();
  const hours = String(shifted.getUTCHours()).padStart(2, '0');
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${day} ${monthName} ${year}, ${hours}.${minutes} WIB`;
}

function formatPctId(value: string): string {
  return `${value.replace('.', ',')}%`;
}

function truncateText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 1))}…`;
}

/**
 * Generates an A4 Bahasa Indonesia monthly financial report PDF buffer using PDFKit.
 * Uses fixed column coordinates, automatic page-break guards, repeating table headers,
 * and numbered page footers so columns never overlap.
 */
export function generateMonthlyReportPdf(data: MonthlyReportPdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      bufferPages: true,
      info: {
        Title: `UPgrade - Laporan Keuangan ${formatMonthYearId(data.period.year, data.period.month)}`,
        Author: 'UPgrade Financial Freedom Roadmap',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const leftX = 42;
    const contentWidth = 511;
    const rightX = leftX + contentWidth;
    const generatedAt = data.generatedAt ?? new Date();
    const periodLabel = formatMonthYearId(data.period.year, data.period.month);

    // ========================================================================
    // 1. HEADER BANNER
    // ========================================================================
    doc.roundedRect(leftX, 38, contentWidth, 68, 8).fill('#0f172a');

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('UPgrade — Laporan Keuangan Bulanan', leftX + 16, 50, {
        width: 330,
        lineBreak: false,
      });

    doc
      .fillColor('#cbd5e1')
      .font('Helvetica')
      .fontSize(9.5)
      .text(`Periode Laporan: ${periodLabel}`, leftX + 16, 72, {
        width: 330,
        lineBreak: false,
      })
      .text(`Dicetak pada: ${formatDateTimeWib(generatedAt)}`, leftX + 16, 86, {
        width: 330,
        lineBreak: false,
      });

    doc
      .fillColor('#e2e8f0')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(truncateText(data.user.name, 30), leftX + 340, 54, {
        width: 155,
        align: 'right',
        lineBreak: false,
      });

    doc
      .fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(8.5)
      .text(truncateText(data.user.email, 34), leftX + 340, 70, {
        width: 155,
        align: 'right',
        lineBreak: false,
      });

    // ========================================================================
    // 2. EXECUTIVE SUMMARY (2-COLUMN GRID)
    // ========================================================================
    let cursorY = 120;
    const colWidth = 248;
    const col1X = leftX;
    const col2X = leftX + colWidth + 15;
    const boxHeight = 148;

    doc.roundedRect(col1X, cursorY, colWidth, boxHeight, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.roundedRect(col2X, cursorY, colWidth, boxHeight, 6).fillAndStroke('#f8fafc', '#e2e8f0');

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text('Ringkasan Arus Kas Bulanan', col1X + 12, cursorY + 11, {
        width: colWidth - 24,
        lineBreak: false,
      });

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text('Neraca & Status Roadmap UPgrade', col2X + 12, cursorY + 11, {
        width: colWidth - 24,
        lineBreak: false,
      });

    const drawKeyValueRow = (x: number, y: number, label: string, value: string, boldValue = false) => {
      doc
        .fillColor('#475569')
        .font('Helvetica')
        .fontSize(8.5)
        .text(label, x + 12, y, { width: 118, lineBreak: false });
      doc
        .fillColor('#0f172a')
        .font(boldValue ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .text(truncateText(value, 28), x + 130, y, {
          width: colWidth - 142,
          align: 'right',
          lineBreak: false,
        });
    };

    const cashFlowRows: Array<[string, string, boolean]> = [
      ['Total Pemasukan', formatRupiah(data.cashFlow.totalIncome), true],
      ['Pengeluaran Pokok', formatRupiah(data.cashFlow.essentialExpense), false],
      ['Pengeluaran Keinginan', formatRupiah(data.cashFlow.discretionaryExpense), false],
      ['Total Pengeluaran', formatRupiah(data.cashFlow.totalExpense), true],
      ['Cicilan Utang', formatRupiah(data.cashFlow.debtPaymentTotal), false],
      ['Surplus / Defisit Bersih', formatRupiah(data.cashFlow.surplus), true],
      ['Rasio Tabungan (Saving Rate)', formatPctId(data.cashFlow.savingRatePct), true],
    ];

    cashFlowRows.forEach(([label, val, bold], idx) => {
      drawKeyValueRow(col1X, cursorY + 32 + idx * 15.5, label, val, bold);
    });

    const healthLabel =
      data.milestone.healthStatus === 'RECOVERY_MODE'
        ? `Mode Pemulihan (Rekor L${data.milestone.highestLevel})`
        : 'Normal';

    const netWorthRows: Array<[string, string, boolean]> = [
      ['Total Aset', formatRupiah(data.netWorth.totalAssets), false],
      ['Total Utang Aktif', formatRupiah(data.netWorth.totalLiabilities), false],
      ['Kekayaan Bersih (Net Worth)', formatRupiah(data.netWorth.netWorth), true],
      ['Level UPgrade Saat Ini', `L${data.milestone.currentLevel} - ${data.milestone.title}`, true],
      ['Status Kesehatan', healthLabel, false],
      [
        'Saldo Dana Darurat',
        `${formatRupiah(data.emergencyFund.currentBalance)} (${data.emergencyFund.monthsCovered.replace('.', ',')} bln)`,
        false,
      ],
      [
        `Target Dana Darurat (${data.emergencyFund.activeTargetMonths}x)`,
        `${formatRupiah(data.emergencyFund.activeTargetAmount)} • ${data.emergencyFund.badge}`,
        false,
      ],
    ];

    netWorthRows.forEach(([label, val, bold], idx) => {
      drawKeyValueRow(col2X, cursorY + 32 + idx * 15.5, label, val, bold);
    });

    // ========================================================================
    // 3. TOP 5 EXPENSE CATEGORIES & LATTE FACTOR AUDIT
    // ========================================================================
    cursorY += boxHeight + 14;
    const section3Height = 112;

    doc.roundedRect(col1X, cursorY, colWidth, section3Height, 6).fillAndStroke('#ffffff', '#e2e8f0');
    doc.roundedRect(col2X, cursorY, colWidth, section3Height, 6).fillAndStroke('#ffffff', '#e2e8f0');

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Top 5 Kategori Pengeluaran', col1X + 12, cursorY + 10, {
        width: colWidth - 24,
        lineBreak: false,
      });

    if (data.topExpenses.length === 0) {
      doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(8.5)
        .text('Belum ada pengeluaran tercatat pada periode ini.', col1X + 12, cursorY + 32, {
          width: colWidth - 24,
        });
    } else {
      data.topExpenses.slice(0, 5).forEach((item, idx) => {
        const rowY = cursorY + 30 + idx * 15;
        const tag = item.expenseClass === 'ESSENTIAL' ? 'Pokok' : 'Keinginan';
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(8.2)
          .text(`${idx + 1}. ${truncateText(item.categoryName, 20)} (${tag})`, col1X + 12, rowY, {
            width: 145,
            lineBreak: false,
          });
        doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(8.2)
          .text(formatRupiah(item.spent), col1X + 158, rowY, {
            width: colWidth - 170,
            align: 'right',
            lineBreak: false,
          });
      });
    }

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Temuan Audit Latte Factor (30 Hari)', col2X + 12, cursorY + 10, {
        width: colWidth - 24,
        lineBreak: false,
      });

    if (data.latteFactor.items.length === 0) {
      doc
        .fillColor('#15803d')
        .font('Helvetica')
        .fontSize(8.5)
        .text('Tidak ada kebocoran halus terdeteksi dalam 30 hari terakhir.', col2X + 12, cursorY + 32, {
          width: colWidth - 24,
        });
    } else {
      doc
        .fillColor('#be123c')
        .font('Helvetica-Bold')
        .fontSize(8.2)
        .text(
          `Total Bocor: ${formatRupiah(data.latteFactor.totalMonthlyLeak)}/bln (${formatRupiah(data.latteFactor.totalAnnualLeak)}/thn)`,
          col2X + 12,
          cursorY + 27,
          { width: colWidth - 24, lineBreak: false },
        );

      data.latteFactor.items.slice(0, 4).forEach((item, idx) => {
        const rowY = cursorY + 44 + idx * 15;
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(8.2)
          .text(`${truncateText(item.categoryName, 20)} (${item.monthlyFrequency}x)`, col2X + 12, rowY, {
            width: 140,
            lineBreak: false,
          });
        doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(8.2)
          .text(formatRupiah(item.monthlyTotal), col2X + 154, rowY, {
            width: colWidth - 166,
            align: 'right',
            lineBreak: false,
          });
      });
    }

    // ========================================================================
    // 4. MONTHLY TRANSACTION LEDGER TABLE (NON-OVERLAPPING & PAGINATED)
    // ========================================================================
    cursorY += section3Height + 18;

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`Rincian Mutasi Transaksi (${data.transactions.length} Transaksi)`, leftX, cursorY, {
        width: contentWidth,
        lineBreak: false,
      });

    cursorY += 16;

    // 5 non-overlapping columns inside 511pt printable width:
    // Tanggal (66pt) | Jenis (68pt) | Kategori / Catatan (173pt) | Akun (108pt) | Nominal (90pt)
    const COL_DATE_X = leftX + 4;
    const COL_DATE_W = 62;
    const COL_TYPE_X = leftX + 70;
    const COL_TYPE_W = 66;
    const COL_DESC_X = leftX + 140;
    const COL_DESC_W = 171;
    const COL_ACC_X = leftX + 315;
    const COL_ACC_W = 104;
    const COL_AMT_X = leftX + 423;
    const COL_AMT_W = 84;
    const ROW_HEIGHT = 18;

    const drawTableHeader = (y: number): number => {
      doc.roundedRect(leftX, y, contentWidth, 20, 4).fill('#1e293b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.2);
      doc.text('Tanggal', COL_DATE_X, y + 6, { width: COL_DATE_W, lineBreak: false });
      doc.text('Jenis', COL_TYPE_X, y + 6, { width: COL_TYPE_W, lineBreak: false });
      doc.text('Kategori / Catatan', COL_DESC_X, y + 6, { width: COL_DESC_W, lineBreak: false });
      doc.text('Akun', COL_ACC_X, y + 6, { width: COL_ACC_W, lineBreak: false });
      doc.text('Nominal', COL_AMT_X, y + 6, { width: COL_AMT_W, align: 'right', lineBreak: false });
      return y + 22;
    };

    cursorY = drawTableHeader(cursorY);

    if (data.transactions.length === 0) {
      doc.roundedRect(leftX, cursorY, contentWidth, 28, 4).fillAndStroke('#f8fafc', '#e2e8f0');
      doc
        .fillColor('#64748b')
        .font('Helvetica')
        .fontSize(8.5)
        .text('Tidak ada transaksi tercatat pada periode bulan ini.', leftX + 12, cursorY + 10, {
          width: contentWidth - 24,
          align: 'center',
          lineBreak: false,
        });
    } else {
      const pageBottomLimit = doc.page.height - 68;

      data.transactions.forEach((tx, index) => {
        if (cursorY + ROW_HEIGHT > pageBottomLimit) {
          doc.addPage();
          cursorY = drawTableHeader(42);
        }

        if (index % 2 === 1) {
          doc.rect(leftX, cursorY, contentWidth, ROW_HEIGHT).fill('#f8fafc');
        }

        const dateStr = formatShortDateWib(tx.transactionDate);
        const typeStr = TX_TYPE_LABELS_ID[tx.type] ?? tx.type;

        const baseCategoryOrTarget =
          tx.type === 'TRANSFER'
            ? `Transfer ke ${tx.destinationAccountName ?? 'Akun Tujuan'}`
            : tx.type === 'DEBT_PAYMENT'
              ? `Utang: ${tx.debtName ?? '-'}`
              : tx.categoryName ?? typeStr;

        const descStr = tx.note ? `${baseCategoryOrTarget} - ${tx.note}` : baseCategoryOrTarget;
        const accStr =
          tx.type === 'TRANSFER' && tx.destinationAccountName
            ? `${tx.sourceAccountName} -> ${tx.destinationAccountName}`
            : tx.sourceAccountName;

        const signPrefix = tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' || tx.type === 'DEBT_PAYMENT' ? '-' : '';
        const amountStr = `${signPrefix}${formatRupiah(tx.amount)}`;

        const textY = cursorY + 5;
        doc.fillColor('#334155').font('Helvetica').fontSize(8);
        doc.text(dateStr, COL_DATE_X, textY, { width: COL_DATE_W, lineBreak: false });
        doc.text(truncateText(typeStr, 14), COL_TYPE_X, textY, { width: COL_TYPE_W, lineBreak: false });
        doc.text(truncateText(descStr, 36), COL_DESC_X, textY, { width: COL_DESC_W, lineBreak: false });
        doc.text(truncateText(accStr, 22), COL_ACC_X, textY, { width: COL_ACC_W, lineBreak: false });

        const amtColor =
          tx.type === 'INCOME'
            ? '#047857'
            : tx.type === 'EXPENSE'
              ? '#be123c'
              : tx.type === 'DEBT_PAYMENT'
                ? '#6d28d9'
                : '#1d4ed8';

        doc
          .fillColor(amtColor)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(truncateText(amountStr, 20), COL_AMT_X, textY, {
            width: COL_AMT_W,
            align: 'right',
            lineBreak: false,
          });

        doc
          .moveTo(leftX, cursorY + ROW_HEIGHT)
          .lineTo(rightX, cursorY + ROW_HEIGHT)
          .strokeColor('#f1f5f9')
          .lineWidth(0.5)
          .stroke();

        cursorY += ROW_HEIGHT;
      });
    }

    // ========================================================================
    // 5. PAGE NUMBER FOOTERS ACROSS ALL BUFFERED PAGES
    // ========================================================================
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i += 1) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 34;
      doc
        .fillColor('#94a3b8')
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          `Halaman ${i + 1} dari ${totalPages} — Dihasilkan oleh UPgrade (7-Level Financial Freedom Roadmap)`,
          leftX,
          footerY,
          {
            width: contentWidth,
            align: 'center',
            lineBreak: false,
          },
        );
    }

    doc.end();
  });
}

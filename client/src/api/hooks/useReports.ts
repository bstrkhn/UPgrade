import { apiClient, extractApiErrorMessage } from '../client';

/**
 * Downloads the monthly financial report PDF via Blob and triggers a browser file download.
 * Any JSON error envelope inside a failed Blob response is automatically converted into
 * an ApiClientError with its Bahasa Indonesia message by the response interceptor in client.ts.
 */
export async function downloadMonthlyPdf(year: number, month: number): Promise<string> {
  try {
    const response = await apiClient.get<Blob>('/reports/monthly-pdf', {
      params: { year, month },
      responseType: 'blob',
    });

    const paddedMonth = String(month).padStart(2, '0');
    const filename = `UPgrade-Laporan-${year}-${paddedMonth}.pdf`;
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 3000);

    return filename;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, 'Gagal mengunduh laporan PDF bulanan.'));
  }
}

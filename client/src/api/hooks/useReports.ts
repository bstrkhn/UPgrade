import axios from 'axios';
import { apiClient, extractApiErrorMessage } from '../client';
import type { ApiErrorEnvelope } from '../types';

/**
 * Downloads the monthly financial report PDF via Blob and triggers a browser file download.
 * If the server returns a JSON error envelope inside a Blob, extracts the Indonesian message.
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
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text) as ApiErrorEnvelope;
        if (parsed && typeof parsed.message === 'string' && parsed.message.length > 0) {
          throw new Error(parsed.message);
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
          throw parseErr;
        }
      }
    }
    throw new Error(extractApiErrorMessage(error, 'Gagal mengunduh laporan PDF bulanan.'));
  }
}

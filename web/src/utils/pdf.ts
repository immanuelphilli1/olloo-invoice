import { captureElement } from './capture';

const A4 = { width: 210, height: 297 };
const MARGIN = 10;

/** Each .doc-sheet becomes one A4 page, scaled to fit inside the margins. */
export async function downloadPdf(element: HTMLElement, filename: string) {
  const { jsPDF } = await import('jspdf');
  const sheets = Array.from(element.querySelectorAll<HTMLElement>('.doc-sheet'));
  if (!sheets.length) throw new Error('Nothing to export');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  for (const [index, sheet] of sheets.entries()) {
    const dataUrl = await captureElement(sheet);
    const { width, height } = await imageSize(dataUrl);
    const maxW = A4.width - MARGIN * 2;
    const maxH = A4.height - MARGIN * 2;
    const scale = Math.min(maxW / width, maxH / height);
    const w = width * scale;
    const h = height * scale;
    if (index > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'PNG', (A4.width - w) / 2, MARGIN, w, h, undefined, 'FAST');
  }
  pdf.save(filename);
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

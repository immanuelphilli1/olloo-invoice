import { toPng } from 'html-to-image';

/** Documents are designed at this width (max-w-180); phones show them narrower with a scrolling table. */
const DOCUMENT_WIDTH = 720;

/**
 * Render an element to a PNG data URL, after fonts and images have settled.
 * The element is laid out at full document width while capturing, so on a phone
 * the image still includes every column instead of the visible scroll window.
 */
export async function captureElement(element: HTMLElement): Promise<string> {
  await document.fonts.ready;
  // A till slip declares its own (narrower) width so the image isn't mostly margin.
  const declared = Number(element.querySelector<HTMLElement>('[data-doc-width]')?.dataset.docWidth);
  const width = declared > 0 ? declared : DOCUMENT_WIDTH;
  const previousWidth = element.style.width;
  const previousMaxWidth = element.style.maxWidth;
  element.style.width = `${width}px`;
  element.style.maxWidth = 'none';
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
    const sheet = element.classList.contains('doc-sheet') ? element : element.querySelector<HTMLElement>('.doc-sheet');
    const background = sheet ? getComputedStyle(sheet).backgroundColor : '#ffffff';
    return await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: background,
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains('print:hidden')),
    });
  } finally {
    element.style.width = previousWidth;
    element.style.maxWidth = previousMaxWidth;
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The element that holds the document sheets on view pages. */
export function printArea(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#doc-print-area');
}

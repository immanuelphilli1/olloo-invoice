import { whatsappDigits } from '@olloo/shared';
import { captureElement, dataUrlToBlob, downloadBlob } from './capture';

export interface ShareableDoc {
  /** "Invoice" | "Receipt" */
  label: string;
  number: string;
  businessName: string;
  customerName: string;
  customerPhone?: string;
}

function fileName(doc: ShareableDoc) {
  return `${doc.label.toLowerCase()}-${doc.number}.png`;
}

function openWhatsAppChat(phone?: string, text?: string) {
  const digits = phone ? whatsappDigits(phone) : '';
  const encoded = text ? `?text=${encodeURIComponent(text)}` : '';
  window.open(`https://wa.me/${digits}${encoded}`, '_blank', 'noopener,noreferrer');
}

/**
 * Capture the document as an image and share it.
 * Prefers the Web Share API (on phones this opens the share sheet → WhatsApp).
 * Otherwise downloads the PNG and opens the customer's WhatsApp chat to attach it.
 */
export async function shareDocumentImage(element: HTMLElement, doc: ShareableDoc): Promise<'shared' | 'downloaded'> {
  const blob = await dataUrlToBlob(await captureElement(element));
  const file = new File([blob], fileName(doc), { type: 'image/png' });
  const caption = `${doc.businessName} — ${doc.label} № ${doc.number} · ${doc.customerName}`;

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${doc.label} № ${doc.number}`, text: caption });
      return 'shared';
    } catch (err) {
      // Closing the share sheet isn't a failure — and shouldn't trigger a download.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }

  downloadBlob(blob, fileName(doc));
  openWhatsAppChat(doc.customerPhone, `${caption} — please see the attached image.`);
  return 'downloaded';
}

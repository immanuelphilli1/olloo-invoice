import { TEMPLATES, type CompanyInfo, type DocumentSnapshot, type ReceiptTemplateId, type TemplateId } from '@olloo/shared';

/** A made-up business for the landing page's live documents. */
export const DEMO_COMPANY: CompanyInfo = {
  name: "AMA'S BUILDING SUPPLIES",
  location: 'Kasoa Main Road',
  poBox: 'P.O. Box KS 42, Kasoa',
  phone: '(+233) 24 000 0000',
  email: '',
  tin: '',
  footerText: 'Goods sold are not returnable',
  logoUrl: null,
  signatureUrl: null,
};

export function demoSnapshot(template: TemplateId = 'classic-ink', receiptTemplate?: ReceiptTemplateId): DocumentSnapshot {
  const preset = TEMPLATES[template].preset;
  return {
    company: DEMO_COMPANY,
    style: receiptTemplate ? { ...preset, receiptTemplate } : preset,
    watermark: false,
  };
}

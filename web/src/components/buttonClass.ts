export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'whatsapp';
export type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-teal-600 text-white shadow-sm hover:bg-teal-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1ebe57]',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

import type { BusinessInput } from '@olloo/shared';

export const EMPTY_BUSINESS: Required<BusinessInput> = {
  name: '',
  location: '',
  poBox: '',
  phone: '',
  email: '',
  tin: '',
  footerText: 'Goods sold are not returnable',
};

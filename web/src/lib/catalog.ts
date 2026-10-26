import type { Customer, Product } from '@olloo/shared';
import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export function useCustomers() {
  return useQuery({ queryKey: ['customers'], queryFn: () => get<Customer[]>('/customers'), staleTime: 60_000 });
}

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: () => get<Product[]>('/products'), staleTime: 60_000 });
}

/** The customer fields on an invoice/receipt form. */
export interface CustomerDraft {
  customerId: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
}

export const emptyCustomer = (): CustomerDraft => ({ customerId: null, customerName: '', customerAddress: '', customerPhone: '' });

export function customerToDraft(c: Customer): CustomerDraft {
  return { customerId: c.id, customerName: c.name, customerAddress: c.address, customerPhone: c.phone };
}

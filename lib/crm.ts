import { Customer, Payment, Sale } from '../types';

export type CustomerTimelineItem =
  | (Sale & { _type: 'SALE' })
  | (Payment & { _type: 'PAYMENT' });

export interface CustomerInsights {
  timeline: CustomerTimelineItem[];
  lastActivityDate: string | null;
  debtAgeDays: number;
  riskScore: number;
}

const daysFromDate = (dateStr: string): number => {
  if (!dateStr) return 0;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
};

export const getCustomerTimeline = (
  customerId: string,
  sales: Sale[],
  payments: Payment[],
  limit = 5
): CustomerTimelineItem[] => {
  const custSales = sales.filter(s => s.customerId === customerId).map(s => ({ ...s, _type: 'SALE' as const }));
  const custPayments = payments.filter(p => p.customerId === customerId).map(p => ({ ...p, _type: 'PAYMENT' as const }));
  return [...custSales, ...custPayments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
};

export const getCustomerInsights = (
  customer: Customer,
  sales: Sale[],
  payments: Payment[]
): CustomerInsights => {
  const timeline = getCustomerTimeline(customer.id, sales, payments, 5);
  const lastActivityDate = timeline.length > 0 ? timeline[0].date : null;

  const unpaidSales = sales
    .filter(s => s.customerId === customer.id && s.isPaid === false)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const debtAgeDays = (customer.debt > 0 && unpaidSales.length > 0) ? daysFromDate(unpaidSales[0].date) : 0;

  // Basic score 0..100 using debt size + age + inactivity
  let score = 0;
  if (customer.debt > 0) score += Math.min(40, customer.debt / 2500);
  if (debtAgeDays > 0) score += Math.min(35, debtAgeDays / 2);
  if (lastActivityDate) score += Math.min(25, daysFromDate(lastActivityDate) / 3);
  else if (customer.debt > 0) score += 25;

  return {
    timeline,
    lastActivityDate,
    debtAgeDays,
    riskScore: Math.max(0, Math.min(100, Math.round(score))),
  };
};

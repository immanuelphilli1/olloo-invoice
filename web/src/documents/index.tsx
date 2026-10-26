import { receiptStyle, type Invoice, type Receipt } from '@olloo/shared';
import { ItemsDocument } from './ItemsDocument';
import { ReceiptClassic } from './ReceiptClassic';
import { paymentLine } from './snapshot';
import { TillReceipt } from './TillReceipt';

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <ItemsDocument
      kind="invoice"
      snapshot={invoice.snapshot}
      number={invoice.number}
      customerName={invoice.customerName}
      customerAddress={invoice.customerAddress}
      customerPhone={invoice.customerPhone}
      lpoNo={invoice.lpoNo}
      date={invoice.date}
      dueDate={invoice.dueDate}
      items={invoice.items}
      subtotal={invoice.subtotal}
      discount={invoice.discount}
      discountAmount={invoice.discountAmount}
      taxes={invoice.taxes}
      total={invoice.total}
      notes={invoice.notes}
      isVoid={invoice.status === 'void'}
      showTotalStamp
    />
  );
}

/** Any receipt, drawn with its own receipt template (Receipt Book, Clean Modern, Minimal Mono or Till Slip). */
export function ReceiptDocument({ receipt: raw }: { receipt: Receipt }) {
  const snapshot = { ...raw.snapshot, style: receiptStyle(raw.snapshot.style) };
  const receipt = { ...raw, snapshot };

  if (snapshot.style.receiptTemplate === 'till') return <TillReceipt receipt={receipt} />;

  if (receipt.layout === 'itemized') {
    return (
      <ItemsDocument
        kind="receipt"
        snapshot={snapshot}
        number={receipt.number}
        customerName={receipt.customerName}
        customerAddress={receipt.customerAddress}
        customerPhone={receipt.customerPhone}
        date={receipt.date}
        items={receipt.items}
        subtotal={receipt.subtotal}
        discount={receipt.discount}
        discountAmount={receipt.discountAmount}
        taxes={receipt.taxes}
        total={receipt.amount}
        notes={receipt.paymentFor}
        paymentLine={paymentLine(receipt.method, receipt.reference)}
        isVoid={receipt.status === 'void'}
      />
    );
  }
  return (
    <ReceiptClassic
      snapshot={snapshot}
      number={receipt.number}
      date={receipt.date}
      customerName={receipt.customerName}
      amount={receipt.amount}
      paymentFor={receipt.paymentFor}
      method={receipt.method}
      reference={receipt.reference}
      balanceAfter={receipt.balanceAfter}
      isVoid={receipt.status === 'void'}
    />
  );
}

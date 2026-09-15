import { PCBuild, InventoryComponent } from '../types';
import { getBuildPresentation } from './buildPresentation';

export const generateInvoice = async (build: PCBuild, components: InventoryComponent[]) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  const presentation = getBuildPresentation(build, components);
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(40);
  doc.text('INVOICE', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Invoice ID: INV-${build.id.substring(0, 8).toUpperCase()}`, 14, 30);
  doc.text(`Date: ${build.saleDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })}`, 14, 35);
  doc.text(`Status: Paid`, 14, 40);

  // Billing Info
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text('Bill To:', 14, 55);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(build.buyerName || 'Valued Customer', 14, 62);
  
  // Title
  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text(`Item: ${build.name}`, 14, 75);

  // Table
  const tableData = presentation.allComponents.map(part => [
    part.category,
    part.source === 'TRADE_IN_BASE'
      ? 'Trade-In Base'
      : part.source === 'PURCHASED_BASE'
      ? 'Purchased PC Base'
      : 'Upgrade',
    part.name,
    part.quantity,
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Category', 'Source', 'Component / Part', 'Qty']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] }, // Amber 500
  });

  // Summary - jspdf-autotable augments jsPDF instance dynamically with lastAutoTable metadata
  const docWithAutoTable = doc as typeof doc & { lastAutoTable?: { finalY: number } };
  const finalY = (docWithAutoTable.lastAutoTable?.finalY ?? 85) + 15;
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(`Total Amount: $${(build.salePrice || 0).toFixed(2)}`, 14, finalY);

  if (build.paymentMethod) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Payment Method: ${build.paymentMethod}`, 14, finalY + 7);
  }

  // Save the PDF
  doc.save(`Invoice_${build.name.replace(/\s+/g, '_')}_${build.id.substring(0, 5)}.pdf`);
};

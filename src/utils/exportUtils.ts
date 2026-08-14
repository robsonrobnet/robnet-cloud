import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Category, Company } from '../types';

interface ExportFilters {
  searchTerm?: string;
  typeFilter?: string;
  scopeFilter?: string;
  companyName?: string;
}

const formatCurrency = (val: number): string => {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

/**
 * Exporta transações filtradas para CSV com encoding UTF-8 BOM para compatibilidade com Excel.
 */
export const exportTransactionsToCSV = (
  transactions: Transaction[],
  categories: Category[],
  companies: Company[],
  filters?: ExportFilters
) => {
  if (transactions.length === 0) {
    alert("Nenhum lançamento para exportar.");
    return;
  }

  const headers = [
    'Data',
    'Vencimento',
    'Tipo',
    'Descricao',
    'Categoria',
    'Escopo',
    'Empresa',
    'Valor (R$)',
    'Status',
    'Tipo Custo',
    'Recorrente',
    'Parcela'
  ];

  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const companyMap = new Map(companies.map(c => [c.id, c.name]));

  const rows = transactions.map(t => {
    const categoryName = t.category_id ? (categoryMap.get(t.category_id) || t.category) : t.category;
    const entityName = t.scope === 'PERSONAL' ? 'Pessoa Física' : (companyMap.get(t.company_id || '') || 'Corporativo');
    const typeLabel = t.type === 'INCOME' ? 'Receita' : 'Despesa';
    const statusLabel = t.status === 'PAID' ? 'Pago' : t.status === 'OVERDUE' ? 'Atrasado' : 'Pendente';
    const costTypeLabel = t.cost_type === 'FIXED' ? 'Fixo' : 'Variavel';
    const installmentStr = t.installment_total && t.installment_total > 1 
      ? `${t.installment_current || 1}/${t.installment_total}` 
      : '1/1';

    // Sanitize values for CSV
    const sanitize = (val: any) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    return [
      sanitize(formatDate(t.date)),
      sanitize(formatDate(t.due_date || t.date)),
      sanitize(typeLabel),
      sanitize(t.description),
      sanitize(categoryName),
      sanitize(t.scope === 'PERSONAL' ? 'PF' : 'PJ'),
      sanitize(entityName),
      sanitize(formatCurrency(t.amount)),
      sanitize(statusLabel),
      sanitize(costTypeLabel),
      sanitize(t.is_recurring ? 'Sim' : 'Nao'),
      sanitize(installmentStr)
    ].join(';');
  });

  // Calculate totals for CSV summary footer
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach(t => {
    if (t.type === 'INCOME') totalIncome += Number(t.amount || 0);
    else totalExpense += Number(t.amount || 0);
  });
  const balance = totalIncome - totalExpense;

  const summaryRows = [
    '',
    ['"--- RESUMO FINANCEIRO ---"'].join(';'),
    ['"Total Receitas"', `"${formatCurrency(totalIncome)}"`].join(';'),
    ['"Total Despesas"', `"${formatCurrency(totalExpense)}"`].join(';'),
    ['"Saldo Liquido"', `"${formatCurrency(balance)}"`].join(';'),
    ['"Total de Registros"', `"${transactions.length}"`].join(';'),
    ['"Data de Extracao"', `"${new Date().toLocaleString('pt-BR')}"`].join(';')
  ];

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows, ...summaryRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const now = new Date();
  const dateSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', `extrato_financeiro_${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exporta transações filtradas para PDF formatado com relatório visual e tabela paginada.
 */
export const exportTransactionsToPDF = (
  transactions: Transaction[],
  categories: Category[],
  companies: Company[],
  filters?: ExportFilters
) => {
  if (transactions.length === 0) {
    alert("Nenhum lançamento para exportar.");
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const companyMap = new Map(companies.map(c => [c.id, c.name]));

  // Calculate Metrics
  let totalIncome = 0;
  let totalExpense = 0;
  let paidCount = 0;
  let pendingCount = 0;

  transactions.forEach(t => {
    const amt = Number(t.amount || 0);
    if (t.type === 'INCOME') totalIncome += amt;
    else totalExpense += amt;

    if (t.status === 'PAID') paidCount++;
    else pendingCount++;
  });

  const balance = totalIncome - totalExpense;
  const nowStr = new Date().toLocaleString('pt-BR');

  // --- HEADER SECTION ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 26, 'F');

  // App Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANAI OS', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('RELATÓRIO EXECUTIVO DE EXTRATO FINANCEIRO', 14, 19);

  // Issue Date Header
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Emissão: ${nowStr}`, 283, 12, { align: 'right' });
  doc.text(`Total de Lançamentos: ${transactions.length}`, 283, 18, { align: 'right' });

  // --- FILTER CRITERIA SUBHEADER ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 30, 269, 12, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  
  const scopeLabel = filters?.scopeFilter === 'PERSONAL' ? 'Pessoal (PF)' : filters?.scopeFilter === 'BUSINESS' ? 'Empresas (PJ)' : 'Todos';
  const typeLabel = filters?.typeFilter === 'INCOME' ? 'Apenas Receitas' : filters?.typeFilter === 'EXPENSE' ? 'Apenas Despesas' : 'Todas Operações';
  const compLabel = filters?.companyName ? filters.companyName : 'Todas';

  doc.text(`Filtros: Escopo [${scopeLabel}]  |  Tipo [${typeLabel}]  |  Empresa [${compLabel}]${filters?.searchTerm ? `  |  Busca: "${filters.searchTerm}"` : ''}`, 18, 37.5);

  // --- SUMMARY KPI BOXES ---
  const kpiY = 46;
  const kpiWidth = 63;
  const kpiHeight = 16;
  const kpiGap = 5.6;

  // Box 1: Receitas
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(14, kpiY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('TOTAL RECEITAS (+)', 18, kpiY + 5.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatCurrency(totalIncome)}`, 18, kpiY + 12);

  // Box 2: Despesas
  const box2X = 14 + kpiWidth + kpiGap;
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 202, 202); // rose-200
  doc.roundedRect(box2X, kpiY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text('TOTAL DESPESAS (-)', box2X + 4, kpiY + 5.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatCurrency(totalExpense)}`, box2X + 4, kpiY + 12);

  // Box 3: Saldo Líquido
  const box3X = box2X + kpiWidth + kpiGap;
  doc.setFillColor(balance >= 0 ? 240 : 255, balance >= 0 ? 253 : 241, balance >= 0 ? 244 : 242);
  doc.setDrawColor(balance >= 0 ? 187 : 254, balance >= 0 ? 247 : 202, balance >= 0 ? 208 : 202);
  doc.roundedRect(box3X, kpiY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(balance >= 0 ? 22 : 190, balance >= 0 ? 101 : 18, balance >= 0 ? 52 : 60);
  doc.text('SALDO LÍQUIDO', box3X + 4, kpiY + 5.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${formatCurrency(balance)}`, box3X + 4, kpiY + 12);

  // Box 4: Status Operacional
  const box4X = box3X + kpiWidth + kpiGap;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(box4X, kpiY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CONSOLIDAÇÃO', box4X + 4, kpiY + 5.5);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${paidCount} Pagos  |  ${pendingCount} Pendentes`, box4X + 4, kpiY + 12);

  // --- DATA TABLE ---
  const tableRows = transactions.map(t => {
    const categoryName = t.category_id ? (categoryMap.get(t.category_id) || t.category) : t.category;
    const entityName = t.scope === 'PERSONAL' ? 'PF' : (companyMap.get(t.company_id || '') || 'PJ');
    const isIncome = t.type === 'INCOME';
    const sign = isIncome ? '+' : '-';
    const statusText = t.status === 'PAID' ? 'Pago' : t.status === 'OVERDUE' ? 'Atrasado' : 'Pendente';

    return [
      formatDate(t.date),
      t.description || 'Sem descrição',
      categoryName || 'Outros',
      entityName,
      isIncome ? 'Receita' : 'Despesa',
      statusText,
      `${sign} R$ ${formatCurrency(t.amount)}`
    ];
  });

  autoTable(doc, {
    startY: 66,
    head: [['Data', 'Descrição', 'Categoria', 'Entidade', 'Tipo', 'Status', 'Valor (R$)']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [51, 65, 85],
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Data
      1: { cellWidth: 'auto' }, // Descricao
      2: { cellWidth: 38 }, // Categoria
      3: { cellWidth: 28 }, // Entidade
      4: { cellWidth: 22 }, // Tipo
      5: { cellWidth: 22 }, // Status
      6: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } // Valor
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    didDrawCell: (data) => {
      // Highlight amounts based on Income / Expense
      if (data.section === 'body' && data.column.index === 6) {
        const rawText = data.cell.text[0] || '';
        if (rawText.startsWith('+')) {
          doc.setTextColor(5, 150, 105); // emerald-600
        } else {
          doc.setTextColor(30, 41, 59); // slate-800
        }
      }
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `FinanAI OS • Documento gerado automaticamente para fins de controle e conciliação financeira • Página ${data.pageNumber} de ${pageCount}`,
        14,
        202
      );
    },
    margin: { left: 14, right: 14, bottom: 16 }
  });

  const now = new Date();
  const dateSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  doc.save(`relatorio_financeiro_${dateSuffix}.pdf`);
};

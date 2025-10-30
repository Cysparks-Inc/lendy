// PDF Generator utility using browser print functionality
// This provides a branded PDF-like experience without external dependencies

export interface PaymentReceipt {
  paymentReference: string;
  memberName: string;
  loanAccount: string;
  installmentNumber: number;
  amount: number;
  paymentDate: string;
  loanOfficer: string;
  branch: string;
  group: string;
}

export interface InstallmentSchedule {
  loanAccount: string;
  memberName: string;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  issueDate: string;
  loanProgram: string;
  installmentType: string;
  installments: Array<{
    number: number;
    dueDate: string;
    principal: number;
    interest: number;
    total: number;
    status: string;
  }>;
}

export const generatePaymentReceipt = (receipt: PaymentReceipt): void => {
  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Receipt - ${receipt.paymentReference}</title>
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none; }
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .receipt {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #1f2937;
          border-radius: 8px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          padding: 20px;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .receipt-title {
          text-align: center;
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 30px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 15px;
        }
        .receipt-number {
          text-align: center;
          font-size: 18px;
          color: #6b7280;
          margin-bottom: 30px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .info-item {
          padding: 15px;
          background: #f9fafb;
          border-radius: 6px;
          border-left: 4px solid #059669;
        }
        .info-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .info-value {
          font-size: 16px;
          color: #1f2937;
          font-weight: 600;
        }
        .amount-section {
          text-align: center;
          padding: 30px;
          background: #f0fdf4;
          border-radius: 8px;
          margin: 30px 0;
        }
        .amount-label {
          font-size: 16px;
          color: #059669;
          margin-bottom: 10px;
        }
        .amount-value {
          font-size: 36px;
          font-weight: bold;
          color: #059669;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #059669;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          z-index: 1000;
        }
        .print-button:hover {
          background: #047857;
        }
      </style>
    </head>
    <body>
      <button class="print-button no-print" onclick="window.print()">
        🖨️ Print Receipt
      </button>
      
      <div class="receipt">
        <div class="header">
          <div class="logo">PETT VISION</div>
          <div class="subtitle">Empowering Communities Through Financial Inclusion</div>
        </div>
        
        <div class="content">
          <div class="receipt-title">PAYMENT RECEIPT</div>
          <div class="receipt-number">Reference: ${receipt.paymentReference}</div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Member Name</div>
              <div class="info-value">${receipt.memberName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Loan Account</div>
              <div class="info-value">${receipt.loanAccount}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Installment Number</div>
              <div class="info-value">#${receipt.installmentNumber}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Payment Date</div>
              <div class="info-value">${new Date(receipt.paymentDate).toLocaleDateString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Loan Officer</div>
              <div class="info-value">${receipt.loanOfficer}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Branch</div>
              <div class="info-value">${receipt.branch}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Group</div>
              <div class="info-value">${receipt.group}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Payment Reference</div>
              <div class="info-value">${receipt.paymentReference}</div>
            </div>
          </div>
          
          <div class="amount-section">
            <div class="amount-label">Amount Paid</div>
            <div class="amount-value">KES ${receipt.amount.toLocaleString()}</div>
          </div>
        </div>
        
        <div class="footer">
          <p>This receipt serves as proof of payment for the above installment.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>Thank you for your payment!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
  }
};

export const generateInstallmentSchedulePDF = (schedule: InstallmentSchedule): void => {
  const scheduleHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Installment Schedule - ${schedule.loanAccount}</title>
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none; }
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .schedule {
          max-width: 1000px;
          margin: 0 auto;
          border: 2px solid #1f2937;
          border-radius: 8px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          padding: 20px;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .schedule-title {
          text-align: center;
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 30px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 15px;
        }
        .loan-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #374151;
        }
        .info-value {
          font-weight: 600;
          color: #059669;
        }
        .installments-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .installments-table th,
        .installments-table td {
          border: 1px solid #d1d5db;
          padding: 12px;
          text-align: center;
        }
        .installments-table th {
          background: #f3f4f6;
          font-weight: 600;
          color: #374151;
        }
        .installments-table tr:nth-child(even) {
          background: #f9fafb;
        }
        .status-paid {
          background: #dcfce7;
          color: #166534;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-pending {
          background: #fef3c7;
          color: #92400e;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .status-overdue {
          background: #fee2e2;
          color: #991b1b;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .summary {
          margin-top: 30px;
          padding: 20px;
          background: #f0fdf4;
          border-radius: 8px;
          border-left: 4px solid #059669;
        }
        .summary h3 {
          color: #059669;
          margin-bottom: 15px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-value {
          font-size: 24px;
          font-weight: bold;
          color: #059669;
        }
        .summary-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #059669;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          z-index: 1000;
        }
        .print-button:hover {
          background: #047857;
        }
      </style>
    </head>
    <body>
      <button class="print-button no-print" onclick="window.print()">
        🖨️ Print Schedule
      </button>
      
      <div class="schedule">
        <div class="header">
          <div class="logo">PETT VISION</div>
          <div class="subtitle">Installment Schedule</div>
        </div>
        
        <div class="content">
          <div class="schedule-title">LOAN INSTALLMENT SCHEDULE</div>
          
          <div class="loan-info">
            <div class="info-item">
              <span class="info-label">Loan Account:</span>
              <span class="info-value">${schedule.loanAccount}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Member Name:</span>
              <span class="info-value">${schedule.memberName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Principal Amount:</span>
              <span class="info-value">KES ${schedule.principalAmount.toLocaleString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Interest Amount:</span>
              <span class="info-value">KES ${schedule.interestAmount.toLocaleString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Amount:</span>
              <span class="info-value">KES ${schedule.totalAmount.toLocaleString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Issue Date:</span>
              <span class="info-value">${new Date(schedule.issueDate).toLocaleDateString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Loan Program:</span>
              <span class="info-value">${schedule.loanProgram === 'small_loan' ? 'Small Loan (8 weeks)' : 'Big Loan (12 weeks)'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Installment Type:</span>
              <span class="info-value">${schedule.installmentType}</span>
            </div>
          </div>
          
          <table class="installments-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Due Date</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${schedule.installments.map(inst => `
                <tr>
                  <td>${inst.number}</td>
                  <td>${new Date(inst.dueDate).toLocaleDateString()}</td>
                  <td>KES ${inst.principal.toLocaleString()}</td>
                  <td>KES ${inst.interest.toLocaleString()}</td>
                  <td>KES ${inst.total.toLocaleString()}</td>
                  <td>
                    <span class="status-${inst.status.toLowerCase()}">${inst.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">${schedule.installments.length}</div>
                <div class="summary-label">Total Installments</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">KES ${schedule.totalAmount.toLocaleString()}</div>
                <div class="summary-label">Total Amount</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${schedule.installments.filter(i => i.status === 'paid').length}</div>
                <div class="summary-label">Paid Installments</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This schedule shows the breakdown of your loan repayment plan.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>Please ensure timely payments to avoid penalties.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(scheduleHTML);
    printWindow.document.close();
    printWindow.focus();
  }
};

// Fake Payment Gateway for Demo
// ============================

const crypto = require('crypto');

// Simulate Indian payment gateways like Razorpay, Paytm, etc.
const PAYMENT_GATEWAYS = {
  RAZORPAY: 'Razorpay',
  PAYTM: 'Paytm',
  PHONEPE: 'PhonePe',
  GPAY: 'Google Pay',
  UPI: 'UPI'
};

// Generate fake transaction ID
function generateTransactionId(gateway = 'RAZORPAY') {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  switch (gateway) {
    case 'RAZORPAY':
      return `pay_${random}${timestamp.slice(-6)}`;
    case 'PAYTM':
      return `TXN${timestamp.slice(-8)}${random}`;
    case 'PHONEPE':
      return `PE${timestamp.slice(-10)}`;
    case 'UPI':
      return `UPI${timestamp}${random}`;
    default:
      return `TXN_${random}_${timestamp.slice(-6)}`;
  }
}

// Simulate payment processing
function processPayment(paymentData) {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      const { amount, gateway, patientId, invoiceId } = paymentData;
      
      // 95% success rate for demo
      const isSuccess = Math.random() > 0.05;
      
      if (isSuccess) {
        resolve({
          success: true,
          transactionId: generateTransactionId(gateway),
          gateway: PAYMENT_GATEWAYS[gateway] || 'Unknown',
          amount: parseFloat(amount),
          currency: 'INR',
          status: 'SUCCESS',
          paymentMethod: getRandomPaymentMethod(),
          timestamp: new Date().toISOString(),
          patientId,
          invoiceId,
          gatewayResponse: {
            code: '200',
            message: 'Payment processed successfully',
            bankRef: `BANK${Math.random().toString().slice(2, 12)}`
          }
        });
      } else {
        resolve({
          success: false,
          transactionId: generateTransactionId(gateway),
          gateway: PAYMENT_GATEWAYS[gateway] || 'Unknown',
          amount: parseFloat(amount),
          currency: 'INR',
          status: 'FAILED',
          timestamp: new Date().toISOString(),
          patientId,
          invoiceId,
          error: {
            code: getRandomErrorCode(),
            message: getRandomErrorMessage()
          }
        });
      }
    }, Math.random() * 2000 + 1000); // 1-3 second delay
  });
}

function getRandomPaymentMethod() {
  const methods = [
    'UPI - Google Pay',
    'UPI - PhonePe',
    'UPI - Paytm',
    'Credit Card - Visa',
    'Credit Card - Mastercard',
    'Debit Card - Visa',
    'Debit Card - Rupay',
    'Net Banking - SBI',
    'Net Banking - HDFC',
    'Net Banking - ICICI'
  ];
  return methods[Math.floor(Math.random() * methods.length)];
}

function getRandomErrorCode() {
  const codes = ['INSUFFICIENT_FUNDS', 'CARD_DECLINED', 'NETWORK_ERROR', 'BANK_ERROR', 'TIMEOUT'];
  return codes[Math.floor(Math.random() * codes.length)];
}

function getRandomErrorMessage() {
  const messages = [
    'Insufficient funds in account',
    'Card declined by issuing bank',
    'Network connectivity issue',
    'Bank server temporarily unavailable',
    'Transaction timeout'
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Generate payment link (for demo)
function generatePaymentLink(invoiceData) {
  const { invoiceId, amount, patientName, description } = invoiceData;
  const linkId = crypto.randomBytes(16).toString('hex');
  
  return {
    paymentLink: `https://demo-payments.dentalclinic.com/pay/${linkId}`,
    linkId,
    amount,
    currency: 'INR',
    description: description || `Payment for dental treatment - Invoice #${invoiceId}`,
    customerName: patientName,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    status: 'ACTIVE'
  };
}

module.exports = {
  PAYMENT_GATEWAYS,
  processPayment,
  generatePaymentLink,
  generateTransactionId
};
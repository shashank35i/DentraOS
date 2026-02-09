# Fake Payment Gateway Demo - Quick Start Guide

## Overview
The dental clinic system includes a fully functional fake payment gateway that simulates Indian payment methods (Razorpay, Paytm, PhonePe, Google Pay, UPI).

---

## How to Access the Payment Gateway Demo

### Step 1: Login as Patient
1. Go to **http://localhost:5173**
2. Click "Login" or navigate to login page
3. Use these credentials:
   - **Email**: patient@demo.com
   - **Password**: patient123
   - **Role**: Patient

### Step 2: Navigate to Billing
1. After login, click on **"Billing"** in the patient portal menu
2. You'll see the **Payments & Invoices** page

### Step 3: View Pending Invoices
The page displays:
- **Current Balance**: ₹4,500.00 (total pending amount)
- **Pending Invoices**: 2 invoices awaiting payment
- **Invoice Table** with:
  - Invoice ID
  - Date
  - Description (Dental treatment type)
  - Amount in INR
  - Status (Pending/Overdue/Paid)
  - **"Pay Now" button** (blue button for unpaid invoices)

### Step 4: Click "Pay Now"
1. Click the blue **"Pay Now"** button on any pending invoice
2. A payment modal will open

---

## Payment Modal Workflow

### Screen 1: Select Payment Method
The modal shows:
- **Amount to Pay**: ₹2,500.00 (or selected invoice amount)
- **Invoice ID**: INV-1 (or corresponding invoice)
- **Payment Methods Available**:
  - ✅ Razorpay
  - ✅ Paytm
  - ✅ PhonePe
  - ✅ Google Pay
  - ✅ UPI

**Action**: Select any payment method and click **"Pay Now"**

### Screen 2: Processing Payment
Shows:
- Loading spinner animation
- Message: "Processing Payment..."
- Gateway name (e.g., "Razorpay")
- Warning: "Do not close this window or refresh the page"

**Duration**: 1-3 seconds (simulated network delay)

### Screen 3: Payment Result

#### Success Scenario (95% of the time)
Shows:
- ✅ Green checkmark icon
- **"Payment Successful!"** message
- Transaction details:
  - **Transaction ID**: pay_ABC123456789 (unique ID)
  - **Payment Method**: UPI - Google Pay (or selected method)
  - **Status**: SUCCESS
  - **Amount**: ₹2,500.00
- Auto-closes in 3 seconds and refreshes invoice list

#### Failed Scenario (5% of the time)
Shows:
- ❌ Red alert icon
- **"Payment Failed"** message
- Error details:
  - **Error Code**: INSUFFICIENT_FUNDS (or other error)
  - **Transaction ID**: pay_XYZ987654321
- Options:
  - **Close**: Close the modal
  - **Try Again**: Retry the payment

---

## Sample Test Scenarios

### Scenario 1: Successful Payment
1. Login as patient@demo.com
2. Go to Billing
3. Click "Pay Now" on ₹2,500.00 invoice
4. Select "Razorpay"
5. Click "Pay Now"
6. Wait for success screen
7. Invoice status changes to "Paid" ✅

### Scenario 2: Failed Payment
1. Repeat steps 1-5 above
2. If you get the failed screen (5% chance):
   - Note the error code
   - Click "Try Again"
   - Select different payment method
   - Click "Pay Now" again

### Scenario 3: Multiple Payments
1. Pay the ₹2,500.00 invoice
2. Go back to billing
3. Pay the ₹1,200.00 invoice
4. Current balance updates to ₹800.00
5. Only 1 pending invoice remains

---

## Payment Gateway Features

### Supported Payment Methods
```
1. Razorpay
   - Transaction ID format: pay_XXXXXX
   - Supports: UPI, Cards, Net Banking

2. Paytm
   - Transaction ID format: TXNXXXXXXXX
   - Supports: Wallet, Cards, Net Banking

3. PhonePe
   - Transaction ID format: PEXXXXXXXXXX
   - Supports: UPI, Cards

4. Google Pay
   - Transaction ID format: UPIXXXXXXXXXXXXXXX
   - Supports: UPI, Cards

5. UPI
   - Transaction ID format: UPI_XXXXXXXXXXXXXXX
   - Supports: All UPI apps
```

### Payment Method Simulation
Each payment method shows realistic:
- Transaction IDs (unique per transaction)
- Payment method details (e.g., "UPI - Google Pay")
- Bank references
- Processing delays (1-3 seconds)

---

## Backend API Endpoints

### Get Available Payment Gateways
```
GET /api/payments/gateways
Authorization: Bearer {token}

Response:
{
  "gateways": [
    { "id": "RAZORPAY", "name": "Razorpay", "enabled": true },
    { "id": "PAYTM", "name": "Paytm", "enabled": true },
    ...
  ]
}
```

### Generate Payment Link
```
POST /api/payments/generate-link
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "invoiceId": 1,
  "amount": 2500.00,
  "patientName": "Demo Patient",
  "description": "Dental treatment - Composite Filling"
}

Response:
{
  "paymentLink": "https://demo-payments.dentalclinic.com/pay/abc123...",
  "linkId": "abc123...",
  "amount": 2500.00,
  "currency": "INR",
  "expiresAt": "2026-01-28T06:44:27.000Z",
  "status": "ACTIVE"
}
```

### Process Payment
```
POST /api/payments/process
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "invoiceId": 1,
  "amount": 2500.00,
  "gateway": "RAZORPAY",
  "patientId": 1
}

Response (Success):
{
  "success": true,
  "transactionId": "pay_ABC123456789",
  "gateway": "Razorpay",
  "amount": 2500.00,
  "currency": "INR",
  "status": "SUCCESS",
  "paymentMethod": "UPI - Google Pay",
  "timestamp": "2026-01-27T06:44:27.000Z"
}

Response (Failed):
{
  "success": false,
  "transactionId": "pay_XYZ987654321",
  "gateway": "Razorpay",
  "amount": 2500.00,
  "currency": "INR",
  "status": "FAILED",
  "timestamp": "2026-01-27T06:44:27.000Z",
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient funds in account"
  }
}
```

### Get Payment History
```
GET /api/payments/history/:patientId
Authorization: Bearer {token}

Response:
{
  "payments": [
    {
      "id": 1,
      "issue_date": "2026-01-25",
      "amount": 2500.00,
      "status": "Paid",
      "paid_date": "2026-01-25",
      "appointment_code": "A001",
      "appointment_type": "Filling"
    },
    ...
  ]
}
```

---

## Database Tables

### payment_transactions
Stores all payment records:
- `id`: Unique transaction ID
- `invoice_id`: Associated invoice
- `patient_id`: Patient who made payment
- `amount`: Payment amount
- `gateway`: Payment gateway used
- `transaction_id`: Gateway transaction ID
- `status`: SUCCESS/FAILED/PENDING/REFUNDED
- `payment_method`: Method used (e.g., "UPI - Google Pay")
- `gateway_response`: JSON response from gateway
- `created_at`: Timestamp

### payment_links
Tracks payment links:
- `link_id`: Unique link identifier
- `invoice_id`: Associated invoice
- `patient_id`: Patient
- `amount`: Amount to pay
- `status`: ACTIVE/EXPIRED/USED/CANCELLED
- `expires_at`: Link expiration time

---

## Demo Data

### Patient Account
- **Email**: patient@demo.com
- **Password**: patient123
- **Name**: Demo Patient
- **Role**: Patient

### Sample Invoices
1. **₹2,500.00** - Pending (Composite Filling)
2. **₹1,200.00** - Pending (Dental Sealant)
3. **₹800.00** - Overdue (Fluoride Treatment)
4. **₹15,000.00** - Paid (Crown Ceramic)
5. **₹3,000.00** - Paid (Orthodontic Braces)

### Total Balance
- **Total Billed**: ₹22,500.00
- **Total Paid**: ₹18,000.00
- **Outstanding**: ₹4,500.00

---

## Features Demonstrated

✅ **Multiple Payment Gateways**: Choose from 5 Indian payment methods
✅ **Realistic Transactions**: Unique transaction IDs and payment methods
✅ **Success/Failure Simulation**: 95% success rate for demo
✅ **Real-time Updates**: Invoice status updates after payment
✅ **Transaction History**: View all payment records
✅ **Error Handling**: Graceful error messages
✅ **Security**: JWT authentication required
✅ **Indian Pricing**: All amounts in INR (₹)

---

## Troubleshooting

### Payment Modal Won't Open
- Ensure you're logged in as a patient
- Check that you have pending invoices
- Verify browser console for errors

### Payment Processing Stuck
- Wait 3-5 seconds for simulation to complete
- Don't refresh the page during processing
- Try again if timeout occurs

### Invoice Status Not Updating
- Click "Refresh" button on billing page
- Reload the page (F5)
- Check browser console for API errors

### Can't Login as Patient
- Verify email: patient@demo.com
- Verify password: patient123
- Check that backend is running on port 4000

---

## Next Steps

1. **Test Multiple Payments**: Pay different invoices
2. **Try Different Gateways**: Select different payment methods
3. **Check Transaction History**: View all payments made
4. **Monitor Revenue**: See updated analytics after payments
5. **Integrate Real Gateway**: Replace fake gateway with actual Razorpay/Paytm

---

## Production Deployment

To use real payment gateways:

1. **Razorpay Integration**:
   - Get API keys from Razorpay dashboard
   - Update `payment_gateway.js` with real API calls
   - Replace fake transaction IDs with real ones

2. **Paytm Integration**:
   - Get merchant credentials
   - Implement Paytm API calls
   - Add checksum validation

3. **PhonePe Integration**:
   - Register as merchant
   - Implement PhonePe API
   - Add webhook handlers

---

## Support

For issues or questions:
- Check backend logs: `Backend/server.js` output
- Check frontend console: Browser DevTools
- Review payment API responses
- Check database: `payment_transactions` table

---

**Last Updated**: January 27, 2026
**Status**: ✅ Fully Functional Demo
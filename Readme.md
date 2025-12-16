# 🌳 GreenReceipt - Digital Receipts Platform

Eliminate paper bills with a virtual printer driver that converts physical receipts into digital ones.

## Features

- **Virtual Printer Driver**: Acts like a printer for existing billing software
- **QR Code Generation**: Instant digital receipt delivery
- **Customer Wallet**: All receipts organized in one app
- **Merchant Dashboard**: Analytics, cost savings, customer engagement
- **Eco Tracking**: Track paper saved and environmental impact
- **Cloud Storage**: Secure PDF/JSON storage

## Tech Stack

- **Frontend**: HTML, Tailwind CSS, Vanilla JS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Storage**: Local/AWS S3
- **QR Codes**: qrcode library
- **PDF Generation**: PDFKit

## Quick Start

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Access the app
open http://localhost:3000
```

### Manual Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Setup Database**
```bash
# Create PostgreSQL database
createdb greenreceipt

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials

# Run migrations
npm run db:migrate
```

3. **Start Server**
```bash
npm run dev
```

4. **Start Virtual Printer (Optional)**
```bash
npm run printer
```

## API Endpoints

### Authentication
- `POST /api/auth/merchant/register` - Register merchant
- `POST /api/auth/merchant/login` - Merchant login
- `POST /api/auth/customer/login` - Customer OTP login

### Receipts
- `POST /api/receipts/generate` - Generate receipt & QR
- `GET /api/receipts/:receiptId` - Get receipt details
- `POST /api/receipts/:receiptId/scan` - Mark as scanned

### Merchant
- `GET /api/merchant/dashboard` - Dashboard stats
- `GET /api/merchant/receipts` - Recent receipts

### Customer
- `GET /api/customer/receipts` - Customer receipts
- `GET /api/customer/profile` - Profile & eco stats
- `GET /api/customer/shops` - Shop filter list

## Virtual Printer Usage

The virtual printer watches a directory for print jobs:

```bash
# Create a print job (JSON format)
echo '{
  "merchantToken": "your_jwt_token",
  "shop_name": "My Store",
  "items": [
    {"name": "Product 1", "qty": 2, "price": 100}
  ]
}' > print-queue/bill-001.json
```

The printer service will:
1. Detect the file
2. Send to API
3. Generate QR code
4. Save receipt to database

## Environment Variables

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=greenreceipt
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
STORAGE_TYPE=local
```

## Production Deployment

1. Set up PostgreSQL database
2. Configure AWS S3 (optional)
3. Set environment variables
4. Deploy using Docker or your preferred platform

```bash
docker-compose -f docker-compose.yml up -d
```

## Revenue Model

- **B2B SaaS**: ₹500-2000/month per shop
- **B2C Ads**: Coupons/offers in receipts
- **Premium Features**: Loyalty, analytics, GST integration
- **CSR Partnerships**: Eco-branding with NGOs

## Future Roadmap

- [ ] UPI app integration (GPay, Paytm, PhonePe)
- [ ] AI expense tracking
- [ ] B2B analytics for FMG brands
- [ ] Government GST integration
- [ ] Mobile apps (React Native/Flutter)
- [ ] Warranty & returns management
- [ ] Loyalty program integration

## License

MIT

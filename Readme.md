<p align="center">
  <img src="https://img.icons8.com/color/96/receipt-dollar.png" alt="GreenReceipt Logo"/>
</p>

<h1 align="center">🧾 GreenReceipt</h1>

<p align="center">
  <strong>Digitizing Receipts. Empowering Consumers. Enabling Sustainability.</strong>
</p>

<p align="center">
  <a href="#-the-problem">Problem</a> •
  <a href="#-our-solution">Solution</a> •
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/MongoDB-4.4+-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
</p>

---

## 📊 The Problem

> **Every year, 10 billion+ paper receipts are printed globally, contributing to deforestation and 1.5 billion pounds of waste.**

| Pain Point | Impact |
|------------|--------|
| 🌲 **Environmental Waste** | 10M trees cut annually just for receipt paper |
| 📉 **Lost Receipts** | 70% of consumers lose receipts needed for returns/warranties |
| 📊 **No Spending Insights** | Manual tracking is tedious; most people don't bother |
| 🏪 **Merchant Blindspot** | Small businesses lack customer analytics that big retailers have |

---

## 💡 Our Solution

**GreenReceipt** is a full-stack digital receipt platform that connects **merchants** and **customers** through QR-code-based instant receipt delivery.

```
┌─────────────┐    QR Scan    ┌─────────────┐    Instant    ┌─────────────┐
│   Merchant  │ ────────────► │ GreenReceipt│ ────────────► │  Customer   │
│   POS/App   │               │   Cloud     │               │   App       │
└─────────────┘               └─────────────┘               └─────────────┘
                                    │
                              ┌─────┴─────┐
                              │ Analytics │
                              │ Dashboard │
                              └───────────┘
```

### 🎯 Value Proposition

| For Customers | For Merchants |
|---------------|---------------|
| ✅ Never lose a receipt again | ✅ Reduce paper costs by 90% |
| ✅ Auto-organized spending journal | ✅ Real-time sales analytics |
| ✅ Smart insights & budgeting | ✅ Customer engagement tools |
| ✅ Easy returns & warranty tracking | ✅ Category management |
| ✅ Upload legacy paper receipts | ✅ Professional digital receipts |

---

## ✨ Features

### 👤 Customer Portal
- **Digital Receipt Wallet** — All receipts in one place, searchable & organized
- **Smart Analytics** — Spending breakdown by category, merchant, time period
- **Calendar View** — Visual spending timeline with daily summaries
- **Receipt Upload** — Digitize old paper receipts with image capture
- **QR Claiming** — Instant receipt via merchant QR scan
- **Expense Tracking** — Include/exclude receipts from analytics

### 🏪 Merchant Portal  
- **Receipt Generation** — Create professional digital receipts instantly
- **Sales Dashboard** — Real-time revenue, transaction trends, top items
- **Category Management** — Organize products with custom categories
- **Customer Analytics** — Understand purchasing patterns
- **Billing History** — Track subscription and payments

### 🔐 Security & Performance
- **JWT Authentication** with email OTP verification
- **Rate Limiting** — Protection against abuse (API & route-level)
- **Helmet Security Headers** — XSS, clickjacking protection
- **NoSQL Injection Prevention** — Sanitized inputs
- **Request Retry Logic** — Auto-retry on network failures
- **Database Connection Pooling** — Optimized for scale
- **Response Caching** — 5-minute TTL on analytics

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI Framework with latest features |
| **Vite** | Lightning-fast build tool |
| **Tailwind CSS** | Utility-first styling |
| **Lucide Icons** | Beautiful, consistent iconography |
| **React Router v7** | Client-side routing |
| **Axios** | HTTP client with interceptors |
| **React Hot Toast** | Elegant notifications |
| **Recharts** | Data visualization |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | Runtime environment |
| **Express.js** | Web framework |
| **MongoDB + Mongoose** | Database & ODM |
| **JWT + bcrypt** | Authentication |
| **Nodemailer** | Email delivery |
| **Helmet** | Security headers |
| **Express Rate Limit** | Abuse prevention |
| **Compression** | Response optimization |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- SMTP credentials (Gmail App Password recommended)

### 1️⃣ Clone & Install
```bash
git clone https://github.com/yourusername/greenreceipt.git
cd greenreceipt

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 2️⃣ Configure Environment

**backend/.env**
```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/greenreceipt
JWT_SECRET=your_super_secure_secret_key_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:5001/api
```

### 3️⃣ Run Development Servers
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

🎉 **App running at:** http://localhost:5173

---

## 🏗 Architecture

```
greenreceipt/
├── backend/
│   └── src/
│       ├── config/
│       │   └── db.js              # MongoDB connection with pooling
│       ├── controllers/
│       │   ├── authController.js   # Auth, OTP, password reset
│       │   ├── receiptController.js # CRUD + pagination
│       │   └── analyticsController.js # Cached analytics
│       ├── middleware/
│       │   ├── authMiddleware.js   # JWT verification
│       │   └── validate.js         # Request validation
│       ├── models/
│       │   ├── User.js            # Customer schema + indexes
│       │   ├── Merchant.js        # Merchant schema + auto-code
│       │   └── Receipt.js         # Receipt schema
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── receiptRoutes.js   # Rate-limited
│       │   └── analyticsRoutes.js # Rate-limited
│       ├── utils/
│       │   └── sendEmail.js       # Nodemailer wrapper
│       └── server.js              # Express app + security
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── customer/          # Customer dashboard components
│       │   ├── merchant/          # Merchant dashboard components
│       │   ├── common/            # Shared components
│       │   └── layout/            # Navbar, Footer
│       ├── pages/                 # Route pages
│       ├── services/
│       │   └── api.js             # Axios with retry logic
│       └── App.jsx                # Router setup
│
└── README.md
```

---

## 📈 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup/customer` | Customer registration |
| POST | `/api/auth/signup/merchant` | Merchant registration |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/otp/request` | Request OTP email |
| POST | `/api/auth/otp/verify` | Verify OTP code |
| POST | `/api/auth/forgot-password` | Password reset email |
| POST | `/api/auth/reset-password` | Reset with token |

### Receipts (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/receipts/customer` | Get customer receipts (paginated) |
| GET | `/api/receipts/merchant` | Get merchant receipts (paginated) |
| POST | `/api/receipts` | Create receipt |
| POST | `/api/receipts/claim` | Claim via QR code |
| GET | `/api/receipts/:id` | Get single receipt |

### Analytics (Protected + Cached)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/customer` | Customer spending analytics |
| GET | `/api/analytics/merchant` | Merchant sales analytics |

---

## 🛡 Security Features

| Feature | Implementation |
|---------|----------------|
| **Authentication** | JWT tokens with 7-day expiry |
| **Password Security** | bcrypt hashing (12 rounds) |
| **OTP Verification** | 6-digit codes, 10-min expiry, 5 attempts max |
| **Rate Limiting** | Global (200/15min), Routes (20-100/min) |
| **Security Headers** | Helmet.js (XSS, CSP, Clickjacking) |
| **Input Sanitization** | express-mongo-sanitize |
| **CORS** | Whitelist-based origin control |
| **Body Limits** | 10KB JSON payload max |

---

## 🗺 Roadmap

### Phase 1 — MVP ✅
- [x] Customer & Merchant Authentication
- [x] Digital Receipt Creation & Storage
- [x] Basic Analytics Dashboard
- [x] Email OTP Verification
- [x] Receipt Upload Feature

### Phase 2 — Enhanced Features 🚧
- [ ] Push Notifications
- [ ] Receipt OCR (AI-powered)
- [ ] Export to PDF/Excel
- [ ] Multi-language Support
- [ ] Dark Mode

### Phase 3 — Scale & Monetization
- [ ] POS Integration SDK
- [ ] Merchant Subscription Tiers
- [ ] White-label Solution
- [ ] Mobile Apps (React Native)
- [ ] Advanced Analytics (ML insights)

---

## 💰 Business Model

| Revenue Stream | Description |
|----------------|-------------|
| **Freemium SaaS** | Free tier for small merchants, paid for advanced features |
| **Transaction Fees** | Small fee per receipt for high-volume merchants |
| **Analytics Premium** | Advanced insights & reports subscription |
| **API Access** | Developer API for POS integrations |
| **White-label** | Custom branded solutions for enterprises |

---

## 🌍 Impact Metrics

| Metric | Target (Year 1) |
|--------|-----------------|
| 📄 Paper receipts eliminated | 1M+ |
| 🌳 Trees saved | ~100 |
| 👥 Active users | 10,000+ |
| 🏪 Merchant partners | 500+ |
| 💾 CO₂ emissions reduced | 50 tons |

---

## 🖼 Screenshots

<details>
<summary>Click to view screenshots</summary>

### Customer Dashboard
> Digital wallet view with spending analytics

### Merchant Dashboard  
> Sales overview with real-time metrics

### Receipt Details
> Itemized receipt with merchant info

</details>

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👥 Team

Built with 💚 for a sustainable future.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>🌱 Every digital receipt is a step towards a greener planet.</strong>
</p>

<p align="center">
  <a href="https://github.com/yourusername/greenreceipt">⭐ Star this repo</a> •
  <a href="https://github.com/yourusername/greenreceipt/issues">🐛 Report Bug</a> •
  <a href="https://github.com/yourusername/greenreceipt/issues">💡 Request Feature</a>
</p>

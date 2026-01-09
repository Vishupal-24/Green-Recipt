# GreenReceipt

Digital receipts for customers + a lightweight dashboard for merchants.

- Live app: https://green-recipt.vercel.app
- Backend health: `GET /api/health`

## Monorepo layout

- `backend/` — Node.js (ESM) + Express + MongoDB API
- `frontend/` — React (Vite) web app

## Key features (as implemented)

### Auth (Customer + Merchant)

- Separate collections for customer and merchant accounts (`User` + `Merchant`)
- JWT access token (sent as `Authorization: Bearer <token>`)
- Refresh token stored in an HTTP-only cookie (rotated via `/api/auth/refresh`)
- Email OTP flows:
  - Signup OTP (send + verify)
  - Dedicated email OTP routes
  - Password reset via OTP (send + verify + reset)
- Account/profile endpoints:
  - Session check, profile, update profile, change password, logout, logout-all

### Receipts

- Merchant/customer can create receipts (`POST /api/receipts`)
- Customer can claim a receipt via claim code (`POST /api/receipts/claim`)
- Merchant can mark receipt as paid (`PATCH /api/receipts/:id/mark-paid`)

### Merchant onboarding + catalog

- Merchant onboarding flow (business info, operating hours, categories, items)
- Manage categories (CRUD + reorder)
- Manage items (CRUD + bulk create + reorder + availability toggle)

### Bills, reminders, and notifications

- Recurring bills API (`/api/bills/*`)
- In-app notifications API (`/api/notifications/*`)
- Background jobs started with the server:
  - In-app bill reminder scheduler (creates idempotent notifications)
  - Email reminder scheduler (hourly reminders + daily digest check)
  - Email queue worker (polls queue and sends in batches)

### Email system (SendGrid)

- SendGrid integration for transactional emails
- Email queue + retry/backoff via `EmailLog` (MongoDB-backed)
- Email preferences for customers (master switch + bill reminder frequency + marketing/product updates)
- One-click unsubscribe via token

### Frontend UX

- Customer and merchant dashboards
- QR scanning support (client-side)
- Dark mode
- i18n scaffolding (English + Hindi)
- PWA shell: `manifest.json` + service worker registration

## Tech stack

### Backend (`backend/`)

- Runtime: Node.js (ES modules)
- Web: Express
- DB: MongoDB + Mongoose
- Auth: JWT (access token) + refresh token cookie
- Validation: Zod
- Email: SendGrid (`@sendgrid/mail`)
- Hardening: `helmet`, `express-rate-limit`, `express-mongo-sanitize`, `hpp`, `compression`, `cors`, `cookie-parser`

### Frontend (`frontend/`)

- React 19 + React Router
- Vite
- Tailwind CSS + PostCSS
- Axios (configured with `withCredentials: true` for refresh cookie support)
- i18next + react-i18next
- UI/UX libs: framer-motion, swiper, lucide-react, fontawesome, react-hot-toast

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

Optional (for real emails):

- SendGrid account + API key

## Environment variables

### Backend (`backend/.env`)

Required:

```env
MONGO_URI=mongodb://localhost:27017/greenreceipt
JWT_SECRET=your_secure_random_string_min_32_chars
```

Recommended:

```env
PORT=5001
NODE_ENV=development

# Comma-separated CORS allowlist. Example:
# CLIENT_URL=http://localhost:5173,https://green-recipt.vercel.app
CLIENT_URL=http://localhost:5173

# If omitted, defaults to JWT_SECRET + "_refresh"
REFRESH_TOKEN_SECRET=your_refresh_secret
```

Email (optional; if not set, email sending is skipped):

```env
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
```

Dev note:

- When `NODE_ENV` is not `production`, OTPs are logged to the backend console.

### Frontend (`frontend/.env`)

Optional (defaults to `http://localhost:5001/api`):

```env
VITE_API_URL=http://localhost:5001/api
```

## Run locally

### Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Start backend

```bash
cd backend
npm run dev
```

API default: `http://localhost:5001` (base path `/api`).

### Start frontend

```bash
cd frontend
npm run dev
```

Vite default: `http://localhost:5173`.

## Scripts

### Backend

- `npm run dev` — start API with nodemon
- `npm start` — start API
- `npm run migrate:receipt-dates` — migrate receipt dates (one-off)

### Frontend

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview build
- `npm run lint` — eslint

## Auth + cookies (important)

- Frontend uses `axios` with `withCredentials: true`.
- Refresh token is stored in an HTTP-only cookie (sent automatically by the browser).
- Access token is stored client-side and attached as `Authorization: Bearer ...`.

Cross-domain production note (e.g., Vercel frontend + separate backend domain):

- Cookies require `SameSite=None; Secure` (enabled when `NODE_ENV=production`).
- Backend CORS must allow the exact frontend origin via `CLIENT_URL`.

## API overview

Base path: `/api`

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all` (protected)
- `GET /api/auth/session` (protected)
- `GET /api/auth/me` (protected)
- `PATCH /api/auth/me` (protected)
- `POST /api/auth/change-password` (protected)
- `DELETE /api/auth/me` (protected)

Signup OTP flow:

- `POST /api/auth/send-signup-otp`
- `POST /api/auth/verify-signup-otp`

Dedicated OTP routes (mounted under `/api/auth`):

- `POST /api/auth/email/send-otp`
- `POST /api/auth/email/verify-otp`
- `POST /api/auth/email/resend-otp`
- `GET /api/auth/email/otp-status`
- `POST /api/auth/password/send-otp`
- `POST /api/auth/password/verify-otp`
- `POST /api/auth/password/reset`

Legacy (kept for backward compatibility):

- `POST /api/auth/signup/customer`
- `POST /api/auth/signup/merchant`
- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `GET /api/auth/verify/:token`

### Email preferences + unsubscribe

- `GET /api/user/email-preferences` (protected)
- `PUT /api/user/email-preferences` (protected)
- `GET /api/email/unsubscribe` (public, token-based)
- `POST /api/email/resubscribe` (public, token-based)

### Receipts

- `POST /api/receipts` (protected)
- `GET /api/receipts/customer` (customer)
- `GET /api/receipts/merchant` (merchant)
- `POST /api/receipts/claim` (customer)
- `PATCH /api/receipts/:id/mark-paid` (merchant)
- `PATCH /api/receipts/:id` (protected)
- `DELETE /api/receipts/:id` (protected)
- `GET /api/receipts/:id` (protected)

### Analytics

- `GET /api/analytics/customer` (customer)
- `GET /api/analytics/merchant` (merchant)

### Bills

- `GET /api/bills/upcoming` (protected)
- `GET /api/bills/categories` (protected)
- `POST /api/bills` (protected)
- `GET /api/bills` (protected)
- `GET /api/bills/:id` (protected)
- `PATCH /api/bills/:id` (protected)
- `DELETE /api/bills/:id` (protected)
- `PATCH /api/bills/:id/status` (protected)
- `POST /api/bills/:id/mark-paid` (protected)

### Notifications

- `GET /api/notifications` (protected)
- `GET /api/notifications/count` (protected)
- `GET /api/notifications/preferences` (protected)
- `PATCH /api/notifications/:id/read` (protected)
- `POST /api/notifications/mark-all-read` (protected)
- `DELETE /api/notifications/:id` (protected)
- `POST /api/notifications/dismiss-all` (protected)

### Merchant onboarding + catalog

- `GET /api/merchant/onboarding/status`
- `POST /api/merchant/onboarding/business-info`
- `POST /api/merchant/onboarding/operating-hours`
- `POST /api/merchant/onboarding/categories`
- `POST /api/merchant/onboarding/items`
- `POST /api/merchant/onboarding/complete`
- `POST /api/merchant/onboarding/skip`
- `GET /api/merchant/profile/full`

Categories:

- `GET /api/merchant/categories`
- `POST /api/merchant/categories`
- `PATCH /api/merchant/categories/reorder`
- `PATCH /api/merchant/categories/:id`
- `DELETE /api/merchant/categories/:id`

Items:

- `GET /api/merchant/items`
- `POST /api/merchant/items`
- `POST /api/merchant/items/bulk`
- `PATCH /api/merchant/items/reorder`
- `GET /api/merchant/items/:id`
- `PATCH /api/merchant/items/:id`
- `PATCH /api/merchant/items/:id/availability`
- `DELETE /api/merchant/items/:id`

## Background processes (server-side)

When the backend starts, it also starts:

- In-app reminder scheduler (hourly checks; creates idempotent notifications)
- Email queue worker (polls MongoDB queue and sends emails in batches)
- Bill reminder email scheduler (hourly individual reminders + daily digest check at ~8 AM server time)

## Troubleshooting

- CORS erre welcome contributions from the community. Please follow these guidelines:

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** with conventional commits: `git commit -m "feat: add new feature"`
4. **Push** to your fork: `git push origin feature/your-feature-name`
5. **Open** a Pull Request with a clear description

### Code Standards

- **Linting**: ESLint with React recommended rules
- **Formatting**: Consistent indentation (2 spaces)
- **Naming**: camelCase for functions/variables, PascalCase for components
- **Comments**: JSDoc for utilities, inline comments for complex logic

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Testing Locally

```bash
# Run backend
cd backend && npm run dev

# Run frontend
cd frontend && npm run dev

# Build for production
cd frontend && npm run build
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[Live Demo](https://green-recipt.vercel.app)** · **[Report Issue]([https://github.com/24f3001062/greenreceipt/issues](https://github.com/24f3001062/Green-Recipt/issues))** · **[Request Feature]([https://github.com/24f3001062/greenreceipt/issues](https://github.com/24f3001062/Green-Recipt/issues))**

</div>



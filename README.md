# Dokan - Smart Shop Management (Frontend)

Frontend for the Dokan academic project (Web Programming Lab + Project). It covers the workflow in SRS section 7: sales reduce stock, purchases increase stock, credit sales create dues, and payments update balances. All data comes from the Dokan API in the `dokan-backend` project.

**Stack:** React 18, Vite, Tailwind CSS 3, Lucide React, Chart.js with react-chartjs-2, React Router.

## Run it

You need [Node.js](https://nodejs.org) 18.18 or newer. The app needs the API running, so use two terminals.

In the `dokan-backend` folder (this does not need PostgreSQL installed):

```bash
npm install
npm run dev:local
```

In this folder:

```bash
npm install
npm run dev
```

The app opens at http://localhost:5173. It expects the API at http://localhost:5000. If yours is elsewhere, copy `.env.example` to `.env` and set `VITE_API_URL`.

**Demo login:** `admin@dokan.example` / `dokan123`, created by the backend's seed. In development, the login page has a link that fills these in. Under `npm run dev:local`, **Continue with Google** also signs you in to this account.

Other commands: `npm run build` creates a production build in `dist/`, and `npm run preview` serves that build.

## Pages

| Route | What it does | SRS |
|---|---|---|
| `/login` | Sign in and create account, plus demo-only Google sign-in and a simulated forgot password screen | FR-01 |
| `/dashboard` | Metrics, revenue and expenses chart, profit and loss, stock status, top products, recent transactions, smart alerts | FR-09, FR-13 |
| `/inventory` | Search and filters, add, edit and delete products, CSV import and export, low-stock status, reorder | FR-02, FR-03 |
| `/sales` | Point of sale, printable invoices, daily, weekly and monthly reports | FR-04, FR-05 |
| `/purchases` | Purchase orders, add purchase, supplier payments and dues | FR-06 |
| `/credit` | Customer balances, partial and full payments, SMS reminders | FR-07, FR-08 |
| `/notifications` | Categorised alerts with read and unread status | FR-12 |
| `/settings` | Shop information, SMS settings, low-stock threshold, 2FA, payment methods, password | FR-01, FR-11 |

## Project structure

```
src/
  main.jsx, App.jsx      Entry point and routes
  index.css              Glass surfaces, form and table styles
  data/constants.js      Fixed lists such as categories and payment channels
  context/               Auth, app data store and toasts
  lib/api.js             Requests to the API, with the sign-in token
  lib/adapters.js        Translates API fields into the shapes pages use
  lib/                   Also formatting, CSV and Chart.js setup
  components/ui/         Buttons, forms, modals, badges, metric cards
  components/layout/     Sidebar, top bar, page shell, background
  components/charts/     Revenue, sales report and sparkline charts
  components/dashboard/  Dashboard widgets
  pages/                 One file per route
```

## What is simulated or not connected

- **SMS** is simulated by the API unless the server is set to live mode.
- **Google sign-in** does not contact Google. Under the backend's `npm run dev:local` it signs in to the demo account, and elsewhere it says it is not set up.
- **Password reset emails** are not sent.
- **2FA** is a saved setting only, and the **Test** button on payment methods does not contact a gateway.
- **Branches:** the API supports several branches per shop, but this frontend always uses the first one because it has no branch switcher yet.

To restore the original sample data, run `npm run db:seed` in the backend. That deletes everything else in the database.

## Changing the colours

- **Theme:** colours are defined in `tailwind.config.js` under `cosmos`, `frost` and `brand`. The glass surface is `.glass` in `src/index.css`.

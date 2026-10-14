# HAVIE Badminton Store

React + Vite frontend demo using semantic HTML, modern CSS, ES6+, React Router and lucide-react. **No Tailwind, Bootstrap, or external script CDN.**

## Run
```bash
npm install
npm run dev
```
Open the localhost URL printed by Vite.

## Screens
Home, Product Listing, Product Details, Sign In / Sign Up, Shopping Cart, Admin Dashboard. Also includes demo checkout.

## Demo interactions
Search and category filtering, sorting, product details, quantity selection, add/remove cart, demo checkout, form validation, dashboard order status. Cart and demo orders are persisted to localStorage.

## Important
This is a frontend prototype. Authentication, payment, order processing, inventory, and dashboard data are simulated locally, **not secure production implementations**. Product images are locally generated SVG illustrations (not real product photography). Replace these with licensed product photography and connect a real backend before deployment as a live store.

## Architecture
`src/main.jsx`: routes and UI state; `src/data.js`: mock catalog; `src/style.css`: mobile-first styling; `public/images/`: locally stored SVG product illustrations.

`Rule.md` preserves the supplied constraints and documents the React/Vite exception.

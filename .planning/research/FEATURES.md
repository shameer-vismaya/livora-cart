# Livora Cart — Feature Catalog

> Multi-vendor marketplace, Indian market. Actors: Customer, Store Owner, Store Staff, Platform Admin, Delivery Driver.
> Legend — **TS** = Table Stakes (expected), **DIFF** = Differentiator. Priority: **M** = Must (v1), **S** = Should, **C** = Could.
> Benchmarked against: Amazon/Flipkart marketplace, Meesho, Dukaan, Shopify+Dokan, CS-Cart/Yo!Kart/Bagisto, ONDC.
> Date: 2026-06-16.

---

## A. Customer

### A1. Registration & Auth
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Email + password signup | TS | M | Keycloak |
| Mobile OTP login | TS | M | MSG91, DLT templates |
| Social login (Google/Apple) | TS | M | Apple required for iOS later |
| Guest checkout | TS | M | Convert to account post-order |
| MFA (optional for users) | DIFF | S | TOTP via Keycloak |

### A2. Discovery & Location
| Feature | Type | v1 | Notes |
|---|---|---|---|
| GPS location detect + manual address | TS | M | geolocator + geocoding |
| Nearby stores (distance) | DIFF | M | OpenSearch geo_distance |
| Store delivery-radius awareness | DIFF | M | Hide stores that can't deliver to user |
| Pickup option | DIFF | S | Store pickup vs delivery |
| Browse by category | TS | M | |
| Product search (typo-tolerant) | TS | M | OpenSearch |
| Store search | TS | M | |
| Filters: category/price/distance/availability/rating | TS | M | Faceted |
| Sort: relevance/price/distance/rating/newest | TS | M | |

### A3. Shopping
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Cart (multi-store aware) | TS | M | Split by store at checkout |
| Wishlist | TS | M | |
| Product comparison | DIFF | S | |
| Coupons / promo codes | TS | M | Promotion service |
| Loyalty points | DIFF | S | Earn/burn |
| Recently viewed / reorder | TS | S | |

### A4. Checkout & Payment
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Multiple addresses | TS | M | |
| UPI / cards / netbanking | TS | M | Razorpay |
| COD | TS | M | COD reconciliation (see PITFALLS) |
| In-app wallet | DIFF | M | Ledger-backed |
| GST invoice generation | TS | M | Legal requirement |
| Order summary w/ tax & delivery split | TS | M | |

### A5. Order Management
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Real-time order tracking | TS | M | Realtime gateway |
| Order history | TS | M | |
| Reorder | TS | S | |
| Returns | TS | M | Return workflow + window |
| Refunds | TS | M | To source / wallet |
| Cancellations | TS | M | Pre-dispatch |

### A6. Engagement
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Reviews & ratings (verified purchase) | TS | M | |
| Product Q&A | TS | S | |
| Chat with store | DIFF | S | Realtime gateway |
| Notifications (push/SMS/WhatsApp/email) | TS | M | Notification service |

---

## B. Store Owner

### B1. Store Management
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Store onboarding (KYC, GSTIN, bank) | TS | M | Admin approval workflow |
| Store profile & branding | TS | M | Logo, banner, description |
| Operating hours | TS | M | Affects availability |
| Delivery zones / radius | DIFF | M | Drives nearby-store match |
| Pickup config | DIFF | S | |

### B2. Catalog & Pricing
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Product CRUD + images | TS | M | Variants, attributes |
| Variants (size/color) | TS | M | |
| Categories mapping | TS | M | To platform taxonomy |
| Pricing + MRP/discount | TS | M | GST-inclusive/exclusive |
| Bulk import (CSV) | TS | S | Onboarding accelerator |
| Promotions (store-level) | TS | S | |

### B3. Inventory
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Stock management | TS | M | Authoritative DB reservations |
| Low-stock alerts | TS | M | |
| Reorder levels | TS | S | |
| Batch management | DIFF | M | Required for exchange/expiry |
| Expiry management | DIFF | M | FEFO for grocery/pharma |
| Barcode / QR | DIFF | S | Warehouse + POS |

### B4. Order Fulfilment
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Accept / reject orders | TS | M | SLA timer |
| Process / pack | TS | M | Status updates |
| Assign delivery | TS | M | Driver or 3PL |
| Print GST invoice / label | TS | M | |

### B5. Reports & Staff
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Sales reports | TS | M | |
| Inventory reports | TS | M | |
| Customer reports | TS | S | |
| Settlement reports | TS | M | What platform owes the store |
| Staff RBAC (cashier/inventory mgr/store mgr) | TS | M | ABAC scoping |

---

## C. Platform Admin

### C1. Governance
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Store onboarding workflow (create/approve/suspend) | TS | M | KYC/GST verification |
| Product approval / moderation | TS | M | Queue + policy |
| Category & taxonomy management | TS | M | |
| Brand management | TS | S | |
| User & role management | TS | M | All actor types |

### C2. Marketplace Ops
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Campaigns / banners | TS | S | |
| Platform-wide promotions | TS | S | |
| Loyalty program config | DIFF | S | |

### C3. Finance (accounting-ready)
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Commission engine (per category/store rules) | TS | M | |
| Platform fees | TS | M | |
| Settlement engine (daily/weekly/monthly) | TS | M | T+1/T+2 cycles |
| Revenue sharing | TS | M | |
| Reconciliation (ledger↔PG↔bank) | TS | M | Break queue |
| Wallet management (customer/store/platform) | DIFF | M | Double-entry ledger |
| Store payouts (RazorpayX) | TS | M | |
| Refund management | TS | M | |
| Tax (GST) engine | TS | M | CGST/SGST/IGST, HSN |

### C4. Analytics
| Feature | Type | v1 | Notes |
|---|---|---|---|
| Marketplace dashboard | TS | M | GMV, orders, stores |
| Revenue dashboard | TS | M | Commission, payouts |
| Sales dashboard | TS | S | |
| Operational dashboard | TS | S | Fulfilment SLAs |

---

## D. Inventory Exchange & Warehouse  ⭐ DIFFERENTIATOR

| Feature | Type | v1 | Notes |
|---|---|---|---|
| Store submits excess inventory (product/qty/price) | DIFF | M | The headline feature |
| Admin review / accept / reject | DIFF | M | |
| Price negotiation | DIFF | M | Offer/counter-offer |
| Central warehouse stock management | DIFF | M | Bins/locations/nodes |
| Receiving (GRN) | DIFF | M | Two-phase transfer |
| Dispatch | DIFF | M | |
| Inter-warehouse transfers | DIFF | M | |
| Stock movement tracking | DIFF | M | Auditable, location-aware |
| Purchase orders | DIFF | M | |
| Distribution orders (redistribute to same/other stores) | DIFF | M | Demand+geo policy |
| Batch tracking | DIFF | M | |
| Barcode / QR support | DIFF | S | |
| Multiple warehouses | DIFF | S | Start with 1 node, model for N |

---

## E. Logistics

| Feature | Type | v1 | Notes |
|---|---|---|---|
| Delivery assignment | TS | M | Driver or 3PL |
| Delivery tracking | TS | M | Realtime |
| Driver management | TS | M | Onboarding, status, earnings |
| 3PL integration (Delhivery/Shadowfax) | TS | S | Pluggable |
| Route optimization | DIFF | C | **Fast-follow, not v1** (per scope) |

---

## Top Differentiators (what to market)
1. **Store→Platform inventory exchange + warehouse redistribution** — unique; no mainstream marketplace offers this.
2. **Location-first discovery** — nearby stores by GPS + delivery radius + pickup.
3. **Accounting-ready triple-wallet ledger** — customer/store/platform double-entry with daily reconciliation.
4. **Batch/expiry-aware inventory** — opens grocery/pharma verticals.

## Gaps in the Owner's Spec (recommend adding)
1. **GST e-invoicing / IRN** — legally required above turnover thresholds; not mentioned. **Add to v1 finance.**
2. **COD reconciliation & remittance** — COD is in scope but the cash-collection→remittance→settlement loop must be modeled. **Add to finance.**
3. **Return/refund SLA + reverse logistics** — returns mentioned but reverse pickup + restocking not detailed. **Add to logistics + inventory.**
4. **Dispute / grievance management** — marketplaces need a complaints/escalation workflow (consumer protection rules). **Add to admin (S).**
5. **Multi-store cart split** — a single customer cart spanning multiple stores needs explicit per-store order splitting, fees, and delivery. **Confirmed must in v1.**
6. **Search relevance / merchandising controls** — admin boosting/pinning of products. **Should.**
7. **Audit trail for money & governance actions** — implied by security but call it out as a finance/admin requirement. **Must.**
8. **ONDC interoperability** — strategic for India; design contracts to be mappable. **Could (design-aware now).**

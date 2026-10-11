# Research: how this app compares with Odoo Inventory and community-built Odoo inventory apps

- **Collected on:** 2026-10-11
- **Question:** Does Afonsa Inventory follow the leads of Odoo Inventory and the inventory apps the Odoo community has built, and where is it ahead or behind?
- **Decision it informs:** what (if anything) to build next for a single-warehouse, low-traffic, free-tier parts inventory used mostly on phones.
- **Route used:** WebFetch/WebSearch on primary pages and the GitHub API (`gh api`) for OCA repositories. ScrapeGraphAI had no API key and Exa's browser search was not used (the browser extension was unstable), so this is the documented fallback route.
- **Stopping rule:** official Odoo feature list + pricing, the Odoo Apps Store inventory category by downloads, and the OCA stock-logistics repositories. Per-module usage numbers are not published and stay unknown.

## Evidence cards

| # | Claim | State | Source | Scope / limits |
|---|---|---|---|---|
| R1 | Odoo Inventory's feature list covers: locations, putaway rules, removal strategies, packages, receipts/returns/pick/pack/scrap/adjustments, routes (drop-ship, cross-dock, push/pull, multi-warehouse), barcode, replenishment (reordering rules, forecast, lead times, MTO), lots/serials, expiration dates, variants, costing/valuation methods, landed costs, double-entry inventory, stock aging report, quality checks. | EXTRACTED | https://www.odoo.com/app/inventory-features | Marketing feature list; does not say which features need Enterprise. |
| R2 | Every Odoo stock move has a source and destination location; location types include internal, vendor, customer, inventory loss, view, transit; quants hold quantity per location. | EXTRACTED | https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management.html | Odoo 19 docs. |
| R3 | Odoo Barcode covers receipts, deliveries, transfers, batch transfers and inventory adjustments by scanning, product and location barcodes, lot/serial barcodes, GS1 and RFID. The page names barcode scanners as hardware and does not mention offline use. | EXTRACTED | https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/barcode.html | Docs index page only. |
| R4 | Odoo's "One App Free" plan is one app with unlimited users on Odoo Online; Standard is US$8.95/user/month (discounted from 11.20), Custom US$16.40. | EXTRACTED | https://www.odoo.com/pricing | Prices change; re-verify before quoting. |
| R5 | Using Inventory **and** the separate Barcode app on Odoo Online would need a paid plan. | INFERRED from R4 + R3 (Barcode is its own app) | — | Not confirmed with Odoo; apps that are dependencies of the chosen app are free. |
| R6 | The 20 most-downloaded Inventory apps on the Odoo Apps Store (all free) are, in order: Stock Disallow Negative (OCA), a camera-based warehouse mobile app with offline support (Stocka), stock analytic, inventory-adjustment approval rules, multiple barcodes per product, another adjustment approval app, two inter-company transfer apps, dead-stock aging report, delivery schedule, stock dashboard, multi-user inventory count sessions, loan orders, stock info on order lines, quality assurance, a phone warehouse scanner, warehouse map, per-user location access control, rack/bin "smart storage", all-in-one barcode scanner. | EXTRACTED | https://apps.odoo.com/apps/modules/category/Inventory/browse?order=Downloads | Snapshot of page 1; vendor descriptions are self-reported; download counts not shown. |
| R7 | OCA `stock-logistics-warehouse` (418 stars, 19.0 branch, pushed 2026-10-11) currently ships modules for inventory count sessions (`stock_inventory`), count discrepancy thresholds, count justification, location lockdown during counts, moving stock between locations in bulk (`stock_move_location`), location positions (aisle/rack/level), secondary units, per-user picking-type restriction and warehouse security. | EXTRACTED | `gh api repos/OCA/stock-logistics-warehouse/contents?ref=19.0` | Module names only; behaviour read from names and the v15 summaries in R9. |
| R8 | OCA `stock-logistics-workflow` (304 stars) includes `stock_no_negative`, `scrap_reason_code`, backorder policies, batch picking extensions, lot handling helpers; `stock-logistics-barcode` (199 stars) includes `product_multi_barcode` and barcode generators. | EXTRACTED | `gh api repos/OCA/stock-logistics-workflow/contents`, `.../stock-logistics-barcode/contents` | Names only. |
| R9 | OCA count modules: `stock_inventory_discrepancy` can block validation when a count differs from the system by more than a threshold; `stock_inventory_lockdown` locks locations during a count. | EXTRACTED (secondary: repository mirrors' readme text via search) | https://github.com/OCA/stock-logistics-warehouse | Text came from v15 mirrors; verify on the 19.0 branch before copying behaviour. |
| R10 | The official Barcode app is Enterprise-only; Community users rely on third-party scanning modules. | AMBIGUOUS | https://www.odoo.com/forum/help-1/odoo-pricing-for-the-barcode-app-is-it-free-194260 (forum, older versions) | No current official statement found for Odoo 19/20. |

## Where this app follows the leads

| Lead | Source | In this app |
|---|---|---|
| Double-entry moves, location tree with virtual counterpart locations, quants | R1, R2 | Yes: `stock_move`, `location` (view/internal/vendor/customer/inventory/scrap), `stock_quant` |
| Operation documents with references and a draft -> done flow | R1 | Yes: receipts, deliveries, internal transfers, adjustments, scrap (`IN/…`, `OUT/…`, `INT/…`, `ADJ/…`, `SCRP/…`) |
| No negative stock (the most-downloaded community app; also an OCA module) | R6, R8 | Yes, built in and atomic under concurrency |
| Reordering rules (min/max) and replenishment list | R1 | Yes, per size and location |
| Product variants | R1 | Yes: one item, many sizes, each with its own stock |
| Scrap with reasons | R1, R8 | Yes: damaged -> scrap location, reason recorded |
| Inventory adjustment by count | R1, R3 | Yes, single-user count per item/size/location |
| Search by location and by barcode; phone-camera scanning | R1, R6 | Yes (camera scanning needs a browser with `BarcodeDetector`; manual entry otherwise) |
| Multi-warehouse, hierarchical categories, audit trail | R1 | Yes |

## Where Odoo and its community apps are ahead (not in this app)

Lots/serial numbers and expiry dates; costing methods and inventory valuation in accounting, landed costs; putaway/removal strategies, reservations, packages; routes (push/pull, drop-ship, cross-dock) and pick-pack-ship steps; purchase and sales order integration, forecasts, lead times; batch/wave picking; unit-of-measure conversion; quality checks; customer portal and carrier labels (R1). From the community (R6–R9): multiple barcodes per product, location barcodes/labels, approval thresholds for adjustments, multi-user count sessions with lockdown, dead-stock/aging report, per-user location access, warehouse map, offline phone use, data import/export.

## Where this app is ahead for this specific user (inference, not a general claim)

- Cost: free for any number of users including photos and phone scanning (Vercel Hobby + Supabase free + 10 GB bucket); Odoo Online is free for one app only (R4, R5).
- Speed of the daily job: find item -> add/subtract an amount per size and section in one dialog, and create a new size while adding stock. Odoo needs a receipt/delivery/adjustment document per change.
- Photos per size, shrunk on the phone; installable on the home screen.
- No setup or training: one warehouse and its sections exist after sign-up.

This does **not** make it "better than Odoo" in general: Odoo is far broader, older and battle-tested. It is narrower and simpler by design.

## Proposed next options (PROPOSED, ranked by value for one warehouse of parts on phones)

1. **CSV export (and import) of items, stock and history** — backup on a free database with no automatic backups, and bulk first load. Evidence: ops need; common store-app theme.
2. **Location QR/barcode labels + scan a section to see what is in it** — R3 (location barcodes).
3. **Multiple barcodes per size** — R6 #5, R8 `product_multi_barcode`.
4. **Count sessions**: count a whole section in one screen, with a discrepancy threshold that needs an admin to approve — R6 #4/#6/#12, R7, R9.
5. **Dead-stock / aging report** (not moved in N days) — R1 stock aging, R6 #9.
6. **Lots/serial numbers** — only if parts are tracked individually.

Open question for the owner: which of these matter; none are assumed.

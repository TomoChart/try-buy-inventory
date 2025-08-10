# YOUniversity Try & Buy Admin – Spec (v1)

## Programs & Countries
- Countries: HR, SI, RS (svaka zemlja odvojena).
- Roles:
  - Superadmin: vidi sve zemlje.
  - Country admin: samo svoju zemlju (CRUD inventar, lokacije, import).
  - Operator: smije unositi/uređivati korisnike (PII), statuse i datume; ne smije mijenjati lokacije, CSV uvoz, brisati uređaje.

## Navigation (left sidebar)
- Try & Buy (Loans)  ← (lista prijavljenih/čekanje/posudbe)
- Devices (shared pool per country; Students + General)
- Reports
- BTL Inventory (odvojeni modul)
- Settings (zemaljski e‑mailovi, lokacije)
- Imports (CSV)

## Data Model (PostgreSQL)
- countries(id, code)
- locations(id, country_id, name, address, contact, working_hours)
- users(id, email, password_hash, role, country_id?)
- devices(id, country_id, model, imei, serial, status, program_available_for JSON['students','general'])
- applications(id, country_id, program ENUM['students','general'], full_name, username, email, phone, city, applied_at, status, notes)
- loans(id, country_id, application_id, device_id, issued_at, return_due, returned_at, condition ENUM['OK','DAMAGED'], comment)
- btl_devices(id, country_id, device_model, imei, serial, received_from_client_date, current_location, status, notes)
- gdpr_deletion_queue(id, application_id, ready_on, confirmed_deleted_at NULL)

## Rules & Workflow
- Maks 14 dana; bez produženja. `return_due = issued_at + 14d`.
- Queue FIFO po `applied_at`; bez auto-rezervacije (samo prikaz/filter “Waiting”).
- Stanja: APPLIED → CONTACTED → ISSUED → ON_LOAN → RETURNED → CLOSED (+ comments NO_SHOW/DECLINED).
- Device transfer: dopušteno između Students/General; zabranjeno između zemalja.
- GDPR: 30 dana nakon `returned_at` ide u “Delete queue”; Country admin ručno potvrđuje hard‑delete PII (ostaju anonimizirani agregati).

## CSV Import
- Kolone: `full_name, username, email, phone, city` (bez program/country).
- Program i zemlja biraju se u UI pri importu.
- Odvojen CSV za General audience.

## Notifications (SMTP)
- T‑2 dana prije isteka; Overdue odmah po isteku 14 dana.
- Tjedni sažetak ponedjeljkom 09:00 CET po zemlji.
- E‑mail adrese po zemlji su editable (seed placeholderi).

## UI (Next.js 14 + Tailwind)
- Sidebar + stranice: /trybuy, /devices, /reports, /btl, /settings, /imports.
- Tablice s filtrima i paginacijom; XLSX export.
- Forms za issue/return (condition, comment; damage photos – feature flag MAX 3).

## Backend (Express + Prisma)
- REST rute: auth (invite/login/reset), locations, devices, applications, loans, btl, reports, gdpr, imports.
- Cron: T‑2/Overdue + Weekly digest u 09:00 CET.

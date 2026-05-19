## Goal

Introduce "chairs/seats" as a first-class concept so each salon can have N chairs. Customers pick a chair when booking or joining the queue. Add a new **Barber** user role: each barber is assigned to a chair, sees their own queue, can view the overall queue, and can request to transfer a customer to another chair — the receiving barber must accept.

## Scope

### 1. Database (new + altered)

**New tables**
- `chairs` — `id`, `salon_id`, `chair_number`, `name`, `is_active`, timestamps. Unique `(salon_id, chair_number)`.
- `barber_assignments` — `id`, `user_id` (the barber), `salon_id`, `chair_id` (nullable for unassigned), `is_active`. Unique `(chair_id)` while active.
- `chair_transfer_requests` — `id`, `booking_id` (nullable), `queue_id` (nullable), `from_chair_id`, `to_chair_id`, `from_barber_id`, `to_barber_id`, `status` (`pending` / `accepted` / `rejected` / `cancelled`), timestamps.

**Altered tables**
- `bookings` — add `chair_id uuid` (nullable for legacy rows).
- `queues` — add `chair_id uuid` (nullable). Update unique/position logic to be **per-chair per-day**.
- `app_role` enum — add `'barber'`.

**RPC updates**
- `place_hold`, `confirm_hold`, `confirm_booking_from_hold`, `join_queue`, `get_queue_status`, `get_occupied_slots`, `is_slot_occupied`, `get_next_queue_position`, `mark_queue_served`, `resequence_queue_positions` — all become chair-aware (slot uniqueness becomes `(barber_id, chair_id, date, time)`; queue position scoped to chair).
- New: `request_chair_transfer`, `respond_chair_transfer`.

**RLS**
- `chairs`: public read, owner/admin write.
- `barber_assignments`: owner/admin manage; barber reads own.
- `chair_transfer_requests`: barbers see requests where they are sender/receiver; owner/admin see all for own salon.
- Extend `bookings`/`queues` policies so an assigned barber can see rows for their chair.

### 2. Admin dashboard
- New "Chairs" management per salon: add / rename / activate / deactivate.
- New "Barbers" tab: invite/assign existing users as barbers, attach to a chair.

### 3. Salon owner dashboard
- New "Chairs" tab inside `OwnerSettingsTab` — same CRUD as admin scoped to own salon.
- New "Staff/Barbers" tab — assign barber users to chairs, remove assignments.
- `OwnerQueueTab` grouped by chair; owner can reassign queue/booking to another chair manually (no approval needed for owner).

### 4. Customer flow
- `ConfirmBooking` (booking flow): after picking date/time, add a **Chair selector** showing only chairs whose slot is free at that time. Pass `chair_id` to `place_hold` / `confirm_booking_from_hold`.
- `JoinQueue`: add **Chair selector** (shows current queue length per chair); pass `chair_id` to `join_queue`. `QueueStatus` shows position within selected chair.
- `BookingConfirmed` shows the chair name/number.

### 5. New Barber role + UI
- New route `/barber-dashboard` (in `src/features/barber/`).
- Auth: barber signs in via existing salon-auth page; role check routes them to `/barber-dashboard`.
- Dashboard tabs:
  - **My Queue** — only entries for the barber's assigned chair (waiting + serving). Mark served / remove.
  - **All Chairs** — toggle showing whole salon's queue grouped by chair (read-only overview).
  - **Transfer** — on any of their own queue entries or upcoming bookings, "Transfer to chair…" picks a target chair (must have an active barber). Creates a `chair_transfer_requests` row.
  - **Incoming requests** — pending transfers targeting this barber's chair; Accept / Reject. Accept atomically updates the booking/queue `chair_id` (and re-sequences queue position on the new chair).

### 6. Routing / role plumbing
- Update `useAdminCheck`-style hook → generic `useUserRole` returning `admin | barber | owner | customer`.
- Update post-login routing in salon/customer auth pages.
- Add memory note: roles now include `barber`; per-chair scoping is the source of truth for slot uniqueness and queue position.

## Technical details

```text
booking slot uniqueness:
  UNIQUE(barber_id, chair_id, booking_date, booking_time)
queue position scope:
  per (salon_id, chair_id, joined_at::date)
transfer accept (atomic):
  UPDATE booking/queue SET chair_id = to_chair_id
  UPDATE chair_transfer_requests SET status='accepted'
  re-run resequence trigger for both old + new chair
```

Legacy rows with `chair_id IS NULL` are treated as "any chair" only for read; new writes always require a chair once a salon has ≥1 chair defined. A salon with **zero chairs defined** keeps current single-station behavior (back-compat).

## Out of scope (ask if needed)
- Barber self-signup flow (assumed: owner/admin invites by email and assigns).
- Per-chair pricing or per-chair services.
- Realtime push notifications for transfer requests (will use existing Supabase realtime channel only).

## Open questions
1. Should customers **see barber names** per chair when picking, or just chair number?
2. When no barber is assigned to a chair, should that chair be bookable at all?
3. Should owner be able to override/force-transfer without barber acceptance?

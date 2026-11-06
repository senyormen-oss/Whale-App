-- A specialist must not be able to review their own listing (e.g. via an old self-booking). Idempotent.
drop policy if exists "clients review their completed orders" on public.reviews;
create policy "clients review their completed orders"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.user_id = auth.uid()
        and o.specialist_id = reviews.specialist_id
        and o.status = 'completed'
    )
    and not exists (
      select 1 from public.specialists s
      where s.id = reviews.specialist_id
        and s.owner_id = auth.uid()
    )
  );

-- Add owner_id to barbers table to link salon owners
ALTER TABLE public.barbers ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_barbers_owner_id ON public.barbers(owner_id);

-- Update RLS policy for barbers - owners can view their own barber shops
CREATE POLICY "Owners can view own barber shops" 
ON public.barbers 
FOR SELECT 
USING (auth.uid() = owner_id);

-- Update RLS policy for barbers - owners can update their own barber shops
CREATE POLICY "Owners can update own barber shops" 
ON public.barbers 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- Add RLS policy for bookings - salon owners can view bookings for their barber shops
CREATE POLICY "Salon owners can view their bookings" 
ON public.bookings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.barbers 
    WHERE barbers.id = bookings.barber_id 
    AND barbers.owner_id = auth.uid()
  )
);

-- Add RLS policy for bookings - salon owners can update bookings for their barber shops
CREATE POLICY "Salon owners can update their bookings" 
ON public.bookings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.barbers 
    WHERE barbers.id = bookings.barber_id 
    AND barbers.owner_id = auth.uid()
  )
);
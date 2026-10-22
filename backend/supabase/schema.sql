-- ====================================================================
-- SwiftRide — Supabase PostgreSQL Database Schema & Migrations
-- Tables: profiles, drivers, rides, payments, ride_status_history
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Riders, Drivers, Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'rider' CHECK (role IN ('rider', 'driver', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    car TEXT NOT NULL,
    plate TEXT UNIQUE NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'swift-go' CHECK (vehicle_type IN ('swift-go', 'swift-comfort', 'swift-xl')),
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.85 CHECK (rating >= 1.0 AND rating <= 5.0),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    eta_mins INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Rides / Bookings Table
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT UNIQUE NOT NULL,
    rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    ride_id TEXT NOT NULL CHECK (ride_id IN ('swift-go', 'swift-comfort', 'swift-xl')),
    ride_name TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 4,
    base_fare NUMERIC(10, 2) NOT NULL,
    distance_km NUMERIC(6, 2) NOT NULL,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 25.00,
    total_fare NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('PENDING', 'REQUESTED', 'CONFIRMED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('RAZORPAY_TEST', 'CASH')),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'PENDING_CASH', 'FAILED', 'CANCELLED')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    booked_at TEXT NOT NULL,
    paid_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Payments Table (Transaction Audit Log)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
    reference_id TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Ride Status History (Lifecycle State Machine Tracking)
CREATE TABLE IF NOT EXISTS public.ride_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'system',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_rides_reference_id ON public.rides(reference_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference_id ON public.payments(reference_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id);

-- 8. Seed Default Active Demo Drivers
INSERT INTO public.drivers (id, name, phone, car, plate, vehicle_type, rating, is_available, eta_mins)
VALUES 
    ('d1111111-1111-1111-1111-111111111111', 'Rahul Sharma', '+91 98765 43210', 'White Maruti Dzire (CNG/AC)', 'DL 01 AB 4291', 'swift-go', 4.89, true, 3),
    ('d2222222-2222-2222-2222-222222222222', 'Vikram Singh', '+91 98111 22334', 'Hyundai Aura Sedan (AC)', 'DL 03 XY 8812', 'swift-comfort', 4.95, true, 4),
    ('d3333333-3333-3333-3333-333333333333', 'Manpreet Kaur', '+91 99887 76655', 'Toyota Innova Crysta (6 Seater)', 'DL 08 CD 5543', 'swift-xl', 4.92, true, 6)
ON CONFLICT (plate) DO NOTHING;

-- 9. Row Level Security (RLS) Setup
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;

-- Public read access for drivers
CREATE POLICY "Allow public read access to available drivers" 
ON public.drivers FOR SELECT USING (true);

-- Backend API full access policy (Service role has bypass by default, anon read enabled for demo)
CREATE POLICY "Allow anon read rides by reference" 
ON public.rides FOR SELECT USING (true);

CREATE POLICY "Allow anon insert rides" 
ON public.rides FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update rides" 
ON public.rides FOR UPDATE USING (true);

-- 10. Reviews & Ratings Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL REFERENCES public.rides(reference_id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_ride_review UNIQUE (reference_id)
);

-- 11. Customer Feedback & Suggestions Table
CREATE TABLE IF NOT EXISTS public.customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('GENERAL', 'BUG_REPORT', 'FEATURE_REQUEST', 'PAYMENT', 'DRIVER_EXPERIENCE')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    contact_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for reviews and feedback
CREATE INDEX IF NOT EXISTS idx_reviews_reference_id ON public.reviews(reference_id);
CREATE INDEX IF NOT EXISTS idx_reviews_driver_id ON public.reviews(driver_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.customer_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to reviews" 
ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert reviews" 
ON public.reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert customer_feedback" 
ON public.customer_feedback FOR INSERT WITH CHECK (true);


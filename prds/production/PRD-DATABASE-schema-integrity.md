# PRD: Database Schema & Data Integrity

## Overview
Ensure all database tables, relationships, and RLS policies are properly configured for production use.

## Problem Statement
Before going to production, we need to verify:
- All required tables exist with correct columns
- Foreign key relationships are properly configured
- Row Level Security (RLS) policies are in place
- Demo data is properly seeded
- Indexes exist for performance-critical queries

## User Stories

### US-001: Verify Customer Table Schema
**Description:** As a developer, I need the customers table to have all required columns.

**Acceptance Criteria:**
- customers table has: id, name, industry, arr, health_score, stage, is_demo, owner_id, created_at, updated_at
- is_demo column exists with default false
- owner_id column references auth.users(id)
- Indexes on is_demo and owner_id exist
- Typecheck passes

### US-002: Verify Contracts Table Schema
**Description:** As a developer, I need the contracts table to store parsed contract data.

**Acceptance Criteria:**
- contracts table has: id, customer_id, file_name, parsed_data, created_at
- customer_id references customers(id)
- parsed_data is JSONB type for flexible storage
- Typecheck passes

### US-003: Verify User Profiles Table
**Description:** As a developer, I need user profiles to track users and roles.

**Acceptance Criteria:**
- user_profiles table has: id, email, full_name, avatar_url, role, created_at
- id references auth.users(id)
- role column supports 'admin' and 'design_partner' values
- Typecheck passes

### US-004: Verify RLS Policies
**Description:** As a developer, I need RLS policies to protect data access.

**Acceptance Criteria:**
- customers table has RLS enabled
- Design partners can only see: is_demo=true OR owner_id=their_id
- Admins can see all customers
- Create/update policies respect owner_id
- Typecheck passes

### US-005: Seed Demo Customers
**Description:** As a developer, I need demo customers seeded for design partners.

**Acceptance Criteria:**
- 3 demo customers exist with is_demo=true
- Acme Corp ($250K, 85% health, active)
- TechStart Inc ($85K, 42% health, at_risk)
- GlobalTech ($480K, 92% health, expanding)
- Demo customers have valid UUIDs
- Typecheck passes

### US-006: Verify Invite Codes Table
**Description:** As a developer, I need invite codes for gated access.

**Acceptance Criteria:**
- invite_codes table has: id, code, max_uses, current_uses, expires_at, is_active
- Default invite code '2362369' exists and is active
- Validation query returns correct status
- Typecheck passes

## Technical Implementation

### Required Migrations
```sql
-- 1. Add is_demo column
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- 2. Add owner_id column
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_is_demo ON public.customers(is_demo);
CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON public.customers(owner_id);

-- 4. Seed demo customers
INSERT INTO public.customers (id, name, industry, arr, health_score, stage, is_demo)
VALUES
  ('de000001-0001-0001-0001-000000000001', 'Acme Corp', 'Technology', 250000, 85, 'active', true),
  ('de000002-0002-0002-0002-000000000002', 'TechStart Inc', 'SaaS', 85000, 42, 'at_risk', true),
  ('de000003-0003-0003-0003-000000000003', 'GlobalTech', 'Enterprise Software', 480000, 92, 'expanding', true)
ON CONFLICT (id) DO UPDATE SET is_demo = true;
```

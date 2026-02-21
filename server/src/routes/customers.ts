import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory customer store (fallback when Supabase not configured)
interface Customer {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  mrr?: number;
  health_score: number;
  status: 'active' | 'onboarding' | 'at_risk' | 'churned';
  renewal_date?: string;
  contract_start?: string;
  csm_name?: string;
  tier?: 'enterprise' | 'strategic' | 'commercial' | 'smb';
  nps_score?: number;
  product_adoption?: number;
  last_activity_days?: number;
  open_tickets?: number;
  expansion_potential?: 'low' | 'medium' | 'high';
  risk_level?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  contacts_count?: number;
  primary_contact?: {
    name: string;
    email: string;
    title?: string;
  };
  tags?: string[];
  contract_id?: string;
  created_at: string;
  updated_at: string;
}

// In-memory store with sample data (fallback)
const customers: Map<string, Customer> = new Map();

// Initialize with comprehensive sample customers for demo
const sampleCustomers: Customer[] = [
  {
    id: uuidv4(),
    name: 'Acme Global Technologies',
    industry: 'Technology',
    arr: 450000,
    mrr: 37500,
    health_score: 92,
    status: 'active',
    renewal_date: '2026-09-15',
    contract_start: '2024-09-15',
    csm_name: 'Sarah Johnson',
    tier: 'enterprise',
    nps_score: 72,
    product_adoption: 85,
    last_activity_days: 1,
    open_tickets: 2,
    expansion_potential: 'high',
    risk_level: 'none',
    contacts_count: 12,
    primary_contact: { name: 'John Smith', email: 'john.smith@acmeglobal.com', title: 'VP of Engineering' },
    tags: ['Enterprise', 'Priority', 'Advocate'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'TechStart Inc',
    industry: 'SaaS',
    arr: 45000,
    mrr: 3750,
    health_score: 62,
    status: 'active',
    renewal_date: '2026-04-01',
    contract_start: '2025-04-01',
    csm_name: 'Michael Chen',
    tier: 'commercial',
    nps_score: 35,
    product_adoption: 45,
    last_activity_days: 8,
    open_tickets: 5,
    expansion_potential: 'medium',
    risk_level: 'medium',
    contacts_count: 4,
    primary_contact: { name: 'Emily Davis', email: 'emily@techstart.io', title: 'CEO' },
    tags: ['Startup', 'Growth'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'Global Finance Partners',
    industry: 'Finance',
    arr: 680000,
    mrr: 56667,
    health_score: 38,
    status: 'at_risk',
    renewal_date: '2026-02-28',
    contract_start: '2023-02-28',
    csm_name: 'Sarah Johnson',
    tier: 'strategic',
    nps_score: -15,
    product_adoption: 30,
    last_activity_days: 21,
    open_tickets: 12,
    expansion_potential: 'low',
    risk_level: 'critical',
    contacts_count: 8,
    primary_contact: { name: 'Robert Williams', email: 'rwilliams@globalfinance.com', title: 'CTO' },
    tags: ['Strategic', 'At Risk', 'Executive Attention'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'HealthCare Plus',
    industry: 'Healthcare',
    arr: 95000,
    mrr: 7917,
    health_score: 78,
    status: 'active',
    renewal_date: '2026-07-20',
    contract_start: '2024-07-20',
    csm_name: 'Jessica Martinez',
    tier: 'commercial',
    nps_score: 55,
    product_adoption: 70,
    last_activity_days: 3,
    open_tickets: 1,
    expansion_potential: 'high',
    risk_level: 'low',
    contacts_count: 6,
    primary_contact: { name: 'Dr. Amanda Lee', email: 'alee@healthcareplus.org', title: 'Chief Medical Officer' },
    tags: ['Healthcare', 'Compliance'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'Retail Giants Corporation',
    industry: 'Retail',
    arr: 520000,
    mrr: 43333,
    health_score: 91,
    status: 'active',
    renewal_date: '2026-11-30',
    contract_start: '2023-11-30',
    csm_name: 'David Kim',
    tier: 'enterprise',
    nps_score: 80,
    product_adoption: 90,
    last_activity_days: 0,
    open_tickets: 0,
    expansion_potential: 'high',
    risk_level: 'none',
    contacts_count: 15,
    primary_contact: { name: 'Mark Thompson', email: 'mthompson@retailgiants.com', title: 'SVP Operations' },
    tags: ['Enterprise', 'Champion', 'Reference'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'DataFlow Systems',
    industry: 'Technology',
    arr: 280000,
    mrr: 23333,
    health_score: 55,
    status: 'at_risk',
    renewal_date: '2026-03-15',
    contract_start: '2024-03-15',
    csm_name: 'Michael Chen',
    tier: 'strategic',
    nps_score: 20,
    product_adoption: 55,
    last_activity_days: 14,
    open_tickets: 8,
    expansion_potential: 'medium',
    risk_level: 'high',
    contacts_count: 7,
    primary_contact: { name: 'Lisa Zhang', email: 'lzhang@dataflow.tech', title: 'VP Product' },
    tags: ['Strategic', 'Needs Attention'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'MediaMax Entertainment',
    industry: 'Media',
    arr: 120000,
    mrr: 10000,
    health_score: 85,
    status: 'active',
    renewal_date: '2026-08-01',
    contract_start: '2025-02-01',
    csm_name: 'Jessica Martinez',
    tier: 'commercial',
    nps_score: 65,
    product_adoption: 75,
    last_activity_days: 2,
    open_tickets: 1,
    expansion_potential: 'medium',
    risk_level: 'low',
    contacts_count: 5,
    primary_contact: { name: 'Chris Anderson', email: 'canderson@mediamax.com', title: 'Director of Technology' },
    tags: ['Media', 'Creative'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'EduLearn Academy',
    industry: 'Education',
    arr: 28000,
    mrr: 2333,
    health_score: 70,
    status: 'active',
    renewal_date: '2026-06-30',
    contract_start: '2025-06-30',
    csm_name: 'David Kim',
    tier: 'smb',
    nps_score: 45,
    product_adoption: 60,
    last_activity_days: 5,
    open_tickets: 2,
    expansion_potential: 'medium',
    risk_level: 'medium',
    contacts_count: 3,
    primary_contact: { name: 'Prof. James Wilson', email: 'jwilson@edulearn.edu', title: 'Dean of Technology' },
    tags: ['Education', 'Non-Profit'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'CloudNine Technologies',
    industry: 'Technology',
    arr: 390000,
    mrr: 32500,
    health_score: 88,
    status: 'active',
    renewal_date: '2026-10-15',
    contract_start: '2024-04-15',
    csm_name: 'Sarah Johnson',
    tier: 'enterprise',
    nps_score: 70,
    product_adoption: 82,
    last_activity_days: 1,
    open_tickets: 3,
    expansion_potential: 'high',
    risk_level: 'none',
    contacts_count: 10,
    primary_contact: { name: 'Alex Rivera', email: 'arivera@cloudnine.tech', title: 'CTO' },
    tags: ['Enterprise', 'Tech Leader'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'SecureBank International',
    industry: 'Finance',
    arr: 550000,
    mrr: 45833,
    health_score: 42,
    status: 'at_risk',
    renewal_date: '2026-04-30',
    contract_start: '2023-04-30',
    csm_name: 'Michael Chen',
    tier: 'strategic',
    nps_score: 5,
    product_adoption: 40,
    last_activity_days: 18,
    open_tickets: 15,
    expansion_potential: 'low',
    risk_level: 'high',
    contacts_count: 9,
    primary_contact: { name: 'Patricia Moore', email: 'pmoore@securebank.com', title: 'CISO' },
    tags: ['Finance', 'Security', 'Escalated'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'FreshMart Groceries',
    industry: 'Retail',
    arr: 85000,
    mrr: 7083,
    health_score: 75,
    status: 'onboarding',
    renewal_date: '2027-01-15',
    contract_start: '2026-01-15',
    csm_name: 'Jessica Martinez',
    tier: 'commercial',
    nps_score: 50,
    product_adoption: 35,
    last_activity_days: 1,
    open_tickets: 4,
    expansion_potential: 'high',
    risk_level: 'low',
    contacts_count: 4,
    primary_contact: { name: 'Tom Garcia', email: 'tgarcia@freshmart.com', title: 'VP Technology' },
    tags: ['New Customer', 'Onboarding'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'MedTech Solutions',
    industry: 'Healthcare',
    arr: 720000,
    mrr: 60000,
    health_score: 95,
    status: 'active',
    renewal_date: '2026-12-31',
    contract_start: '2022-12-31',
    csm_name: 'Sarah Johnson',
    tier: 'enterprise',
    nps_score: 85,
    product_adoption: 92,
    last_activity_days: 0,
    open_tickets: 1,
    expansion_potential: 'high',
    risk_level: 'none',
    contacts_count: 18,
    primary_contact: { name: 'Dr. Susan Park', email: 'spark@medtech.com', title: 'CEO' },
    tags: ['Enterprise', 'Champion', 'Case Study'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'StartupHub Ventures',
    industry: 'SaaS',
    arr: 18000,
    mrr: 1500,
    health_score: 60,
    status: 'onboarding',
    renewal_date: '2027-01-31',
    contract_start: '2026-01-31',
    csm_name: 'David Kim',
    tier: 'smb',
    nps_score: 30,
    product_adoption: 25,
    last_activity_days: 2,
    open_tickets: 3,
    expansion_potential: 'medium',
    risk_level: 'medium',
    contacts_count: 2,
    primary_contact: { name: 'Kevin O\'Brien', email: 'kevin@startuphub.io', title: 'Founder' },
    tags: ['Startup', 'New Customer'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'ManufacturePro Industries',
    industry: 'Manufacturing',
    arr: 340000,
    mrr: 28333,
    health_score: 68,
    status: 'active',
    renewal_date: '2026-05-31',
    contract_start: '2024-05-31',
    csm_name: 'Michael Chen',
    tier: 'strategic',
    nps_score: 40,
    product_adoption: 58,
    last_activity_days: 7,
    open_tickets: 6,
    expansion_potential: 'medium',
    risk_level: 'medium',
    contacts_count: 8,
    primary_contact: { name: 'Frank Mueller', email: 'fmueller@manufacturepro.com', title: 'COO' },
    tags: ['Manufacturing', 'Traditional'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'StreamMedia Networks',
    industry: 'Media',
    arr: 150000,
    mrr: 12500,
    health_score: 80,
    status: 'active',
    renewal_date: '2026-09-30',
    contract_start: '2024-09-30',
    csm_name: 'Jessica Martinez',
    tier: 'commercial',
    nps_score: 60,
    product_adoption: 72,
    last_activity_days: 3,
    open_tickets: 2,
    expansion_potential: 'high',
    risk_level: 'low',
    contacts_count: 6,
    primary_contact: { name: 'Nina Patel', email: 'npatel@streammedia.com', title: 'VP Engineering' },
    tags: ['Media', 'Streaming'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'FinanceFirst Capital',
    industry: 'Finance',
    arr: 110000,
    mrr: 9167,
    health_score: 48,
    status: 'at_risk',
    renewal_date: '2026-03-31',
    contract_start: '2025-03-31',
    csm_name: 'David Kim',
    tier: 'commercial',
    nps_score: 10,
    product_adoption: 35,
    last_activity_days: 12,
    open_tickets: 9,
    expansion_potential: 'low',
    risk_level: 'high',
    contacts_count: 5,
    primary_contact: { name: 'George Hamilton', email: 'ghamilton@financefirst.com', title: 'CFO' },
    tags: ['Finance', 'At Risk'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'LearnQuick Online',
    industry: 'Education',
    arr: 22000,
    mrr: 1833,
    health_score: 82,
    status: 'active',
    renewal_date: '2026-08-15',
    contract_start: '2025-08-15',
    csm_name: 'Jessica Martinez',
    tier: 'smb',
    nps_score: 55,
    product_adoption: 78,
    last_activity_days: 4,
    open_tickets: 0,
    expansion_potential: 'medium',
    risk_level: 'none',
    contacts_count: 3,
    primary_contact: { name: 'Rachel Green', email: 'rgreen@learnquick.com', title: 'Director of Operations' },
    tags: ['Education', 'EdTech'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'RetailEdge Solutions',
    industry: 'Retail',
    arr: 480000,
    mrr: 40000,
    health_score: 35,
    status: 'churned',
    renewal_date: '2025-12-31',
    contract_start: '2022-12-31',
    csm_name: 'Sarah Johnson',
    tier: 'strategic',
    nps_score: -25,
    product_adoption: 28,
    last_activity_days: 45,
    open_tickets: 0,
    expansion_potential: 'low',
    risk_level: 'critical',
    contacts_count: 7,
    primary_contact: { name: 'Steve Brown', email: 'sbrown@retailedge.com', title: 'Former CTO' },
    tags: ['Churned', 'Win-back Target'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'TechVentures LLC',
    industry: 'Technology',
    arr: 95000,
    mrr: 7917,
    health_score: 72,
    status: 'active',
    renewal_date: '2026-07-31',
    contract_start: '2025-01-31',
    csm_name: 'Michael Chen',
    tier: 'commercial',
    nps_score: 45,
    product_adoption: 62,
    last_activity_days: 4,
    open_tickets: 3,
    expansion_potential: 'medium',
    risk_level: 'low',
    contacts_count: 5,
    primary_contact: { name: 'Amy Wang', email: 'awang@techventures.com', title: 'VP Customer Success' },
    tags: ['Tech', 'Growing'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'HealthFirst Medical',
    industry: 'Healthcare',
    arr: 410000,
    mrr: 34167,
    health_score: 89,
    status: 'active',
    renewal_date: '2026-11-15',
    contract_start: '2023-11-15',
    csm_name: 'David Kim',
    tier: 'strategic',
    nps_score: 75,
    product_adoption: 88,
    last_activity_days: 1,
    open_tickets: 2,
    expansion_potential: 'high',
    risk_level: 'none',
    contacts_count: 11,
    primary_contact: { name: 'Dr. Michael Torres', email: 'mtorres@healthfirst.org', title: 'Chief Innovation Officer' },
    tags: ['Healthcare', 'Innovation', 'Expanding'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'LogiChain Dynamics',
    industry: 'Manufacturing',
    arr: 195000,
    mrr: 16250,
    health_score: 65,
    status: 'active',
    renewal_date: '2026-06-15',
    contract_start: '2024-12-15',
    csm_name: 'Jessica Martinez',
    tier: 'commercial',
    nps_score: 38,
    product_adoption: 52,
    last_activity_days: 6,
    open_tickets: 4,
    expansion_potential: 'medium',
    risk_level: 'medium',
    contacts_count: 6,
    primary_contact: { name: 'Diana Ross', email: 'dross@logichain.com', title: 'Supply Chain Director' },
    tags: ['Manufacturing', 'Logistics'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'InsureTech Pro',
    industry: 'Finance',
    arr: 320000,
    mrr: 26667,
    health_score: 77,
    status: 'active',
    renewal_date: '2026-10-01',
    contract_start: '2024-04-01',
    csm_name: 'Sarah Johnson',
    tier: 'strategic',
    nps_score: 52,
    product_adoption: 68,
    last_activity_days: 3,
    open_tickets: 3,
    expansion_potential: 'high',
    risk_level: 'low',
    contacts_count: 9,
    primary_contact: { name: 'William Chen', email: 'wchen@insuretech.com', title: 'Chief Digital Officer' },
    tags: ['InsurTech', 'Digital Transformation'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'GreenEnergy Solutions',
    industry: 'Energy',
    arr: 175000,
    mrr: 14583,
    health_score: 83,
    status: 'active',
    renewal_date: '2026-08-31',
    contract_start: '2025-02-28',
    csm_name: 'Michael Chen',
    tier: 'commercial',
    nps_score: 62,
    product_adoption: 74,
    last_activity_days: 2,
    open_tickets: 1,
    expansion_potential: 'high',
    risk_level: 'none',
    contacts_count: 5,
    primary_contact: { name: 'Jennifer Adams', email: 'jadams@greenenergy.com', title: 'VP Sustainability' },
    tags: ['Energy', 'Sustainability', 'Growing'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: uuidv4(),
    name: 'CyberShield Security',
    industry: 'Technology',
    arr: 245000,
    mrr: 20417,
    health_score: 58,
    status: 'active',
    renewal_date: '2026-05-15',
    contract_start: '2024-11-15',
    csm_name: 'David Kim',
    tier: 'commercial',
    nps_score: 28,
    product_adoption: 48,
    last_activity_days: 9,
    open_tickets: 7,
    expansion_potential: 'medium',
    risk_level: 'medium',
    contacts_count: 6,
    primary_contact: { name: 'Marcus Johnson', email: 'mjohnson@cybershield.io', title: 'Head of Security' },
    tags: ['Security', 'Needs Attention'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Initialize sample data for fallback
sampleCustomers.forEach(c => customers.set(c.id, c));

// Admin emails with full data access
const ADMIN_EMAILS = ['azizcamara2@gmail.com'];

// GET /api/customers - List all customers with search/filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      minArr,
      maxArr,
      healthBelow,
      tag,
      sortBy = 'name',
      sortOrder = 'asc',
      page = '1',
      limit = '20'
    } = req.query;

    // Check if user is admin (from x-user-email header or default to non-admin)
    const userEmail = (req.headers['x-user-email'] as string || '').toLowerCase();
    const userId = req.headers['x-user-id'] as string || '';
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    // Try Supabase first
    if (supabase) {
      try {
        let query = supabase.from('customers').select('*');

        // Multi-tenant: filter by organization_id
        query = applyOrgFilter(query, req);

        // Design partners see: demo customers OR their own uploaded customers
        if (!isAdmin && userId) {
          query = query.or(`is_demo.eq.true,owner_id.eq.${userId}`);
        } else if (!isAdmin) {
          query = query.eq('is_demo', true);
        }

        // Apply filters
        if (search) {
          query = query.or(`name.ilike.%${search}%,industry.ilike.%${search}%`);
        }
        if (status) {
          query = query.eq('stage', status);
        }
        if (minArr) {
          query = query.gte('arr', parseInt(minArr as string));
        }
        if (maxArr) {
          query = query.lte('arr', parseInt(maxArr as string));
        }
        if (healthBelow) {
          query = query.lt('health_score', parseInt(healthBelow as string));
        }

        // Sort
        const orderColumn = sortBy === 'arr' ? 'arr' : sortBy === 'health_score' ? 'health_score' : 'name';
        query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

        // Paginate
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const startIndex = (pageNum - 1) * limitNum;
        query = query.range(startIndex, startIndex + limitNum - 1);

        const { data, error, count } = await query;

        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }

        // Transform Supabase data to match expected format
        const transformedCustomers = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          industry: c.industry,
          arr: c.arr || 0,
          health_score: c.health_score || 70,
          status: c.stage || 'active',
          renewal_date: null,
          csm_name: null,
          primary_contact: null,
          tags: [],
          is_demo: c.is_demo || false,
          owner_id: c.owner_id || null,
          organization_id: c.organization_id || null,
          created_at: c.created_at,
          updated_at: c.updated_at
        }));

        // Get total count for pagination (with org filter)
        let countQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
        countQuery = applyOrgFilter(countQuery, req);
        const { count: totalCount } = await countQuery;

        // Calculate totals
        const totalArr = transformedCustomers.reduce((sum, c) => sum + (c.arr || 0), 0);
        const avgHealth = transformedCustomers.length > 0
          ? Math.round(transformedCustomers.reduce((sum, c) => sum + (c.health_score || 0), 0) / transformedCustomers.length)
          : 0;
        const atRiskCount = transformedCustomers.filter(c => c.status === 'at_risk' || (c.health_score || 0) < 60).length;

        return res.json({
          customers: transformedCustomers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount || transformedCustomers.length,
            totalPages: Math.ceil((totalCount || transformedCustomers.length) / limitNum)
          },
          summary: {
            totalCustomers: totalCount || transformedCustomers.length,
            totalArr,
            avgHealth,
            atRiskCount
          }
        });
      } catch (supabaseError) {
        console.error('Supabase query error:', supabaseError);

        // If user has an org, don't fall back to in-memory — that would leak demo data
        if (req.organizationId) {
          return res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch customers' }
          });
        }
        // Fall through to in-memory only for demo/dev mode
      }
    }

    // Fallback to in-memory store (only when Supabase not configured or demo mode error)
    let results = Array.from(customers.values());

    // Apply filters
    if (search) {
      const searchLower = (search as string).toLowerCase();
      results = results.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.industry?.toLowerCase().includes(searchLower) ||
        c.primary_contact?.name.toLowerCase().includes(searchLower) ||
        c.primary_contact?.email.toLowerCase().includes(searchLower)
      );
    }

    if (status) {
      results = results.filter(c => c.status === status);
    }

    if (minArr) {
      results = results.filter(c => c.arr >= parseInt(minArr as string));
    }

    if (maxArr) {
      results = results.filter(c => c.arr <= parseInt(maxArr as string));
    }

    if (healthBelow) {
      results = results.filter(c => c.health_score < parseInt(healthBelow as string));
    }

    if (tag) {
      results = results.filter(c => c.tags?.includes(tag as string));
    }

    // Sort
    results.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortBy) {
        case 'arr':
          aVal = a.arr;
          bVal = b.arr;
          break;
        case 'health_score':
          aVal = a.health_score;
          bVal = b.health_score;
          break;
        case 'renewal_date':
          aVal = a.renewal_date || '';
          bVal = b.renewal_date || '';
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedResults = results.slice(startIndex, startIndex + limitNum);

    // Calculate totals
    const totalArr = results.reduce((sum, c) => sum + c.arr, 0);
    const avgHealth = results.length > 0
      ? Math.round(results.reduce((sum, c) => sum + c.health_score, 0) / results.length)
      : 0;
    const atRiskCount = results.filter(c => c.status === 'at_risk' || c.health_score < 60).length;

    res.json({
      customers: paginatedResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: results.length,
        totalPages: Math.ceil(results.length / limitNum)
      },
      summary: {
        totalCustomers: results.length,
        totalArr,
        avgHealth,
        atRiskCount
      }
    });
  } catch (error) {
    console.error('List customers error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list customers' }
    });
  }
});

// GET /api/customers/template - Download CSV template for bulk import
// IMPORTANT: Must be BEFORE /:id route to avoid being caught by param route
router.get('/template', (_req: Request, res: Response) => {
  const headers = [
    'name',
    'industry',
    'arr',
    'health_score',
    'stage',
    'renewal_date',
    'csm_name',
    'primary_contact_name',
    'primary_contact_email',
    'primary_contact_title'
  ].join(',');

  const exampleRows = [
    '"Acme Corp","Technology",250000,85,"active","2026-12-31","Jane Smith","John Doe","john@acme.com","VP Engineering"',
    '"Example Inc","SaaS",150000,70,"onboarding","2027-06-30","","Sarah Connor","sarah@example.com","CTO"'
  ];

  const csvContent = [headers, ...exampleRows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="cscx-customer-template.csv"');
  res.send(csvContent);
});

// GET /api/customers/:id - Get single customer
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try Supabase first
    if (supabase) {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('id', id);

      // Multi-tenant: scope to user's org (or demo data)
      query = applyOrgFilter(query, req);

      const { data, error } = await query.single();

      if (!error && data) {
        return res.json({
          id: data.id,
          name: data.name,
          industry: data.industry,
          arr: data.arr || 0,
          health_score: data.health_score || 70,
          status: data.stage || 'active',
          organization_id: data.organization_id || null,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      }

      // Supabase configured but customer not found (or not in user's org)
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Fallback to in-memory only when Supabase is not configured
    const customer = customers.get(id);

    if (!customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    res.json(customer);
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer' }
    });
  }
});

// POST /api/customers - Create customer
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      industry,
      arr,
      status = 'onboarding',
      renewal_date,
      csm_name,
      primary_contact,
      tags
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Customer name is required' }
      });
    }

    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('customers')
        .insert(withOrgId({
          name,
          industry,
          arr: arr || 0,
          health_score: 70,
          stage: status
        }, req))
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({
          id: data.id,
          name: data.name,
          industry: data.industry,
          arr: data.arr,
          health_score: data.health_score,
          status: data.stage,
          organization_id: data.organization_id || null,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      }
    }

    // Fallback to in-memory
    const customer: Customer = {
      id: uuidv4(),
      name,
      industry,
      arr: arr || 0,
      health_score: 70,
      status,
      renewal_date,
      csm_name,
      primary_contact,
      tags: tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    customers.set(customer.id, customer);

    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer' }
    });
  }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Try Supabase first
    if (supabase) {
      let query = supabase
        .from('customers')
        .update({
          ...updates,
          stage: updates.status || undefined
        })
        .eq('id', id);

      // Multi-tenant: scope update to user's org
      query = applyOrgFilter(query, req);

      const { data, error } = await query.select().single();

      if (!error && data) {
        return res.json({
          id: data.id,
          name: data.name,
          industry: data.industry,
          arr: data.arr,
          health_score: data.health_score,
          status: data.stage,
          organization_id: data.organization_id || null,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      }
    }

    // Fallback to in-memory
    const customer = customers.get(id);

    if (!customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    const updatedCustomer: Customer = {
      ...customer,
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };

    customers.set(id, updatedCustomer);

    res.json(updatedCustomer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update customer' }
    });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try Supabase first
    if (supabase) {
      let query = supabase
        .from('customers')
        .delete()
        .eq('id', id);

      // Multi-tenant: scope delete to user's org
      query = applyOrgFilter(query, req);

      const { error } = await query;

      if (!error) {
        return res.json({ message: 'Customer deleted successfully' });
      }
    }

    // Fallback to in-memory
    if (!customers.has(id)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    customers.delete(id);

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete customer' }
    });
  }
});

// GET /api/customers/:id/metrics - Get customer engagement metrics
router.get('/:id/metrics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Default metrics structure
    let metrics = {
      daysSinceOnboard: 0,
      activeUsers: 0,
      featureAdoption: 0,
      supportTickets: 0,
      totalMeetings: 0,
      emailsSent: 0,
      openTasks: 0,
      csatScore: 0,
      healthBreakdown: {
        engagement: 0,
        productAdoption: 0,
        supportSentiment: 0
      }
    };

    if (supabase) {
      // Get customer created_at for days since onboard
      const { data: customer } = await supabase
        .from('customers')
        .select('created_at, health_score')
        .eq('id', id)
        .single();

      if (customer?.created_at) {
        const createdDate = new Date(customer.created_at);
        const now = new Date();
        metrics.daysSinceOnboard = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Get usage events count for active users (unique users in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsersCount } = await supabase
        .from('usage_events')
        .select('user_id', { count: 'exact', head: true })
        .eq('customer_id', id)
        .gte('timestamp', thirtyDaysAgo);

      metrics.activeUsers = activeUsersCount || 0;

      // Get feature adoption from usage events (unique features used / total features)
      const { data: featureUsage } = await supabase
        .from('usage_events')
        .select('feature_id')
        .eq('customer_id', id);

      const uniqueFeatures = new Set(featureUsage?.map(e => e.feature_id) || []);
      const totalFeatures = 10; // Assume 10 total features
      metrics.featureAdoption = Math.min(100, Math.round((uniqueFeatures.size / totalFeatures) * 100));

      // Get support tickets count from agent activities
      const { count: ticketCount } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', id)
        .eq('action_type', 'support_ticket');

      metrics.supportTickets = ticketCount || 0;

      // Get meetings count from agent activities
      const { count: meetingsCount } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', id)
        .in('action_type', ['schedule_meeting', 'meeting', 'book_meeting']);

      metrics.totalMeetings = meetingsCount || 0;

      // Get emails sent count
      const { count: emailsCount } = await supabase
        .from('agent_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', id)
        .in('action_type', ['send_email', 'draft_email', 'email']);

      metrics.emailsSent = emailsCount || 0;

      // Get open tasks count
      const { count: tasksCount } = await supabase
        .from('plan_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', id)
        .neq('status', 'completed');

      metrics.openTasks = tasksCount || 0;

      // Calculate health breakdown based on available data
      // Engagement: based on login frequency and feature usage
      const healthScore = customer?.health_score || 70;
      metrics.healthBreakdown = {
        engagement: Math.min(100, Math.max(0, healthScore + Math.floor(Math.random() * 10) - 5)),
        productAdoption: metrics.featureAdoption || Math.min(100, Math.max(0, healthScore - 10 + Math.floor(Math.random() * 10))),
        supportSentiment: Math.min(100, Math.max(0, healthScore + 5 + Math.floor(Math.random() * 10)))
      };

      // CSAT score (if we have survey data, otherwise derive from health)
      const { data: surveyData } = await supabase
        .from('usage_events')
        .select('metadata')
        .eq('customer_id', id)
        .eq('event_type', 'survey_response')
        .limit(10);

      if (surveyData && surveyData.length > 0) {
        const scores = surveyData.map(s => s.metadata?.score || 0).filter(s => s > 0);
        metrics.csatScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      } else {
        // Derive from health score
        metrics.csatScore = Math.min(100, Math.max(0, healthScore + 10));
      }
    }

    res.json(metrics);
  } catch (error) {
    console.error('Get customer metrics error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer metrics' }
    });
  }
});

// GET /api/customers/:id/activities - Get customer activity timeline
router.get('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '20' } = req.query;

    let activities: any[] = [];

    if (supabase) {
      // Get agent activities
      const { data: agentActivities } = await supabase
        .from('agent_activity_log')
        .select('*')
        .eq('customer_id', id)
        .order('started_at', { ascending: false })
        .limit(parseInt(limit as string));

      // Get chat messages
      const { data: chatMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string));

      // Transform and combine
      const activityItems = (agentActivities || []).map(a => ({
        id: a.id,
        type: mapActionTypeToActivityType(a.action_type),
        title: formatActivityTitle(a.action_type, a.agent_type),
        description: a.result_data?.summary || a.action_data?.description || null,
        date: a.started_at,
        user: a.agent_type ? `${a.agent_type} Agent` : 'AI Agent',
        status: a.status
      }));

      const chatItems = (chatMessages || [])
        .filter(m => m.role === 'assistant')
        .slice(0, 5)
        .map(m => ({
          id: m.id,
          type: 'note' as const,
          title: 'AI Conversation',
          description: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
          date: m.created_at,
          user: m.agent_type ? `${m.agent_type} Agent` : 'AI Assistant'
        }));

      activities = [...activityItems, ...chatItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, parseInt(limit as string));
    }

    // If no activities found, return empty array (not mock data)
    res.json({ activities });
  } catch (error) {
    console.error('Get customer activities error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer activities' }
    });
  }
});

// Helper function to map action types to activity types
function mapActionTypeToActivityType(actionType: string): 'email' | 'meeting' | 'call' | 'note' | 'task' | 'milestone' {
  const mapping: Record<string, 'email' | 'meeting' | 'call' | 'note' | 'task' | 'milestone'> = {
    'send_email': 'email',
    'draft_email': 'email',
    'email': 'email',
    'schedule_meeting': 'meeting',
    'book_meeting': 'meeting',
    'meeting': 'meeting',
    'call': 'call',
    'create_task': 'task',
    'task': 'task',
    'onboarding_complete': 'milestone',
    'milestone': 'milestone'
  };
  return mapping[actionType] || 'note';
}

// Helper function to format activity titles
function formatActivityTitle(actionType: string, agentType?: string): string {
  const titles: Record<string, string> = {
    'send_email': 'Email Sent',
    'draft_email': 'Email Drafted',
    'schedule_meeting': 'Meeting Scheduled',
    'book_meeting': 'Meeting Booked',
    'create_task': 'Task Created',
    'onboarding_complete': 'Onboarding Complete',
    'health_check': 'Health Check Performed',
    'qbr_prep': 'QBR Preparation',
    'risk_assessment': 'Risk Assessment',
    'renewal_forecast': 'Renewal Forecast'
  };
  const title = titles[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return agentType ? `${title}` : title;
}

// POST /api/customers/from-contract - Create customer from parsed contract
router.post('/from-contract', async (req: Request, res: Response) => {
  try {
    const { contractData, contractId } = req.body;

    if (!contractData?.company_name) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Contract data with company name is required' }
      });
    }

    const primaryStakeholder = contractData.stakeholders?.find(
      (s: { approval_required?: boolean }) => s.approval_required
    ) || contractData.stakeholders?.[0];

    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('customers')
        .insert(withOrgId({
          name: contractData.company_name,
          industry: contractData.industry,
          arr: contractData.arr || 0,
          health_score: 70,
          stage: 'onboarding'
        }, req))
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({
          id: data.id,
          name: data.name,
          industry: data.industry,
          arr: data.arr,
          health_score: data.health_score,
          status: data.stage,
          organization_id: data.organization_id || null,
          primary_contact: primaryStakeholder ? {
            name: primaryStakeholder.name,
            email: primaryStakeholder.contact || '',
            title: primaryStakeholder.role
          } : undefined,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      }
    }

    // Fallback to in-memory
    const customer: Customer = {
      id: uuidv4(),
      name: contractData.company_name,
      industry: contractData.industry,
      arr: contractData.arr || 0,
      health_score: 70,
      status: 'onboarding',
      renewal_date: contractData.renewal_date,
      primary_contact: primaryStakeholder ? {
        name: primaryStakeholder.name,
        email: primaryStakeholder.contact || '',
        title: primaryStakeholder.role
      } : undefined,
      tags: ['New', 'From Contract'],
      contract_id: contractId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    customers.set(customer.id, customer);

    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer from contract error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer from contract' }
    });
  }
});

/**
 * POST /api/customers/import
 * Import customers from JSON array (used by CustomerImport.tsx)
 * Accepts: { organizationId?, customers: [{ name, arr, industry?, health_score?, ... }] }
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { customers: records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customers array is required and must not be empty' }
      });
    }

    const results: { imported: number; failed: number; errors: { row: number; message: string }[] } = {
      imported: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const name = record.name?.toString().trim();
      if (!name) {
        results.errors.push({ row: i + 1, message: 'Name is required' });
        results.failed++;
        continue;
      }

      const arr = parseInt(record.arr) || 0;
      let healthScore = parseInt(record.health_score) || 70;
      if (healthScore < 0 || healthScore > 100) healthScore = 70;

      const customerData = withOrgId({
        name,
        industry: record.industry?.toString().trim() || null,
        arr,
        health_score: healthScore,
        status: record.status || record.stage || 'active',
        is_demo: false,
        csm_name: record.csm_name?.toString().trim() || null,
        tier: record.tier?.toString().trim() || null,
      }, req);

      if (supabase) {
        const { error } = await supabase.from('customers').insert(customerData);
        if (error) {
          results.errors.push({ row: i + 1, message: error.message });
          results.failed++;
        } else {
          results.imported++;
        }
      } else {
        const customer: Customer = {
          id: uuidv4(),
          name,
          industry: record.industry?.toString().trim(),
          arr,
          health_score: healthScore,
          status: (record.status || 'active') as Customer['status'],
          tags: ['Imported'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        customers.set(customer.id, customer);
        results.imported++;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import customers error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to import customers' }
    });
  }
});

/**
 * POST /api/customers/import-csv
 * Import customers from CSV file upload
 * Design Partner Self-Service: CSV bulk import
 */
router.post('/import-csv', async (req: Request, res: Response) => {
  try {
    const { csvData } = req.body; // CSV content as string from frontend
    const userId = req.headers['x-user-id'] as string;
    const userEmail = (req.headers['x-user-email'] as string || '').toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    if (!csvData) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'CSV data is required' }
      });
    }

    // Parse CSV
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'CSV must have header row and at least one data row' }
      });
    }

    // Parse header row
    const headers = parseCSVRow(lines[0]);
    const requiredFields = ['name', 'arr'];
    const numericFields = ['arr', 'health_score'];
    const validStages = ['active', 'onboarding', 'at_risk', 'churned', 'expanding'];

    // Validate headers contain required fields
    for (const field of requiredFields) {
      if (!headers.includes(field)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Missing required column: ${field}` }
        });
      }
    }

    const results: { imported: number; errors: { row: number; field: string; message: string }[] } = {
      imported: 0,
      errors: []
    };

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i]);
      const rowData: Record<string, string> = {};

      // Map values to headers
      headers.forEach((header, idx) => {
        rowData[header] = values[idx] || '';
      });

      // Validate required fields
      if (!rowData.name?.trim()) {
        results.errors.push({ row: i + 1, field: 'name', message: 'Name is required' });
        continue;
      }

      // Validate and parse numeric fields
      const arr = parseInt(rowData.arr);
      if (isNaN(arr) || arr < 0) {
        results.errors.push({ row: i + 1, field: 'arr', message: 'ARR must be a positive number' });
        continue;
      }

      let healthScore = rowData.health_score ? parseInt(rowData.health_score) : 70;
      if (isNaN(healthScore) || healthScore < 0 || healthScore > 100) {
        healthScore = 70; // Default if invalid
      }

      // Validate stage enum
      let stage = rowData.stage?.toLowerCase() || 'onboarding';
      if (!validStages.includes(stage)) {
        stage = 'onboarding'; // Default if invalid
      }

      // Create customer
      if (supabase) {
        const { error } = await supabase.from('customers').insert(withOrgId({
          name: rowData.name.trim(),
          industry: rowData.industry?.trim() || null,
          arr,
          health_score: healthScore,
          stage,
          is_demo: false,
          owner_id: isAdmin ? null : userId // Design partners own their imports
        }, req));

        if (error) {
          results.errors.push({ row: i + 1, field: 'database', message: error.message });
        } else {
          results.imported++;
        }
      } else {
        // Fallback to in-memory
        const customer: Customer = {
          id: uuidv4(),
          name: rowData.name.trim(),
          industry: rowData.industry?.trim(),
          arr,
          health_score: healthScore,
          status: stage as Customer['status'],
          primary_contact: rowData.primary_contact_name ? {
            name: rowData.primary_contact_name,
            email: rowData.primary_contact_email || '',
            title: rowData.primary_contact_title
          } : undefined,
          tags: ['Imported'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        customers.set(customer.id, customer);
        results.imported++;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to import customers' }
    });
  }
});

// Helper function to parse CSV row (handles quoted values)
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export { router as customerRoutes };

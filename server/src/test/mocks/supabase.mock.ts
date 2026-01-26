import { vi } from 'vitest';

// Mock customer data
export const mockCustomers = [
  {
    id: 'cust-001',
    name: 'Acme Corporation',
    industry: 'Technology',
    arr: 150000,
    health_score: 85,
    status: 'active',
    renewal_date: '2025-12-31',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z'
  },
  {
    id: 'cust-002',
    name: 'Globex Inc',
    industry: 'Manufacturing',
    arr: 75000,
    health_score: 60,
    status: 'at_risk',
    renewal_date: '2025-06-30',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-05-15T00:00:00Z'
  }
];

// Mock session data
export const mockSession = {
  id: 'session-001',
  customer_id: 'cust-001',
  agent_type: 'onboarding',
  created_at: '2024-06-01T00:00:00Z'
};

// Mock messages
export const mockMessages = [
  {
    id: 'msg-001',
    session_id: 'session-001',
    role: 'user',
    content: 'How is the onboarding going?',
    agent: null,
    created_at: '2024-06-01T10:00:00Z'
  },
  {
    id: 'msg-002',
    session_id: 'session-001',
    role: 'assistant',
    content: 'The onboarding is progressing well...',
    agent: 'onboarding',
    created_at: '2024-06-01T10:00:05Z'
  }
];

// Chainable mock builder
export const createSupabaseQueryMock = (data: unknown = null, error: unknown = null) => {
  const mock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn((resolve) => resolve({ data, error }))
  };
  return mock;
};

// Full Supabase client mock
export const createSupabaseMock = () => {
  const queryMock = createSupabaseQueryMock();

  return {
    from: vi.fn((table: string) => {
      // Return appropriate mock data based on table
      switch (table) {
        case 'customers':
          return createSupabaseQueryMock(mockCustomers);
        case 'sessions':
          return createSupabaseQueryMock(mockSession);
        case 'messages':
          return createSupabaseQueryMock(mockMessages);
        default:
          return queryMock;
      }
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  };
};

// Mock for SupabaseService class
export const createSupabaseServiceMock = () => ({
  // Session methods
  createSession: vi.fn().mockResolvedValue(mockSession),
  getSession: vi.fn().mockResolvedValue({ ...mockSession, messages: mockMessages }),

  // Message methods
  insertMessage: vi.fn().mockResolvedValue(mockMessages[0]),
  getMessages: vi.fn().mockResolvedValue(mockMessages),

  // Customer methods
  getCustomer: vi.fn().mockResolvedValue(mockCustomers[0]),
  getCustomerByName: vi.fn().mockResolvedValue(mockCustomers[0]),
  createCustomer: vi.fn().mockResolvedValue(mockCustomers[0]),

  // Approval methods
  createApproval: vi.fn().mockResolvedValue({ id: 'approval-001' }),
  updateApproval: vi.fn().mockResolvedValue(true),
  getPendingApprovals: vi.fn().mockResolvedValue([]),

  // Contract methods
  saveContract: vi.fn().mockResolvedValue({ id: 'contract-001' }),
  getContract: vi.fn().mockResolvedValue(null)
});

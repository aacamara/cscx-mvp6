/**
 * BillingWidget Component - PRD-199
 *
 * Displays Stripe billing data for a customer including:
 * - Subscription status indicator
 * - MRR display
 * - Next invoice date
 * - Payment health icon
 * - Invoice history
 * - Risk signals/alerts
 */

import React, { useState, useEffect, useCallback } from 'react';

interface Subscription {
  id: string;
  status: string;
  planName?: string;
  mrrCents: number;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  status: string;
  amountCents: number;
  dueDate?: string;
  paidAt?: string;
  attemptCount: number;
}

interface PaymentMethod {
  id: string;
  type: string;
  cardBrand?: string;
  cardLast4?: string;
  expMonth?: number;
  expYear?: number;
  status: string;
}

interface RiskSignal {
  type: string;
  severity: string;
  title: string;
  createdAt: string;
}

interface BillingData {
  stripeCustomerId: string;
  subscriptions: Subscription[];
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  mrrCents: number;
  arrCents: number;
  billingHealth: 'healthy' | 'at_risk' | 'critical';
  riskSignals: RiskSignal[];
}

interface BillingWidgetProps {
  customerId: string;
  compact?: boolean;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export const BillingWidget: React.FC<BillingWidgetProps> = ({ customerId, compact = false }) => {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvoices, setShowInvoices] = useState(false);

  const fetchBillingData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stripe/customer/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setBillingData(data);
        setError(null);
      } else if (response.status === 404) {
        setBillingData(null);
        setError(null);
      } else {
        throw new Error('Failed to fetch billing data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return { icon: '\u2705', color: 'text-green-400', bg: 'bg-green-500/20' };
      case 'at_risk':
        return { icon: '\u26a0\ufe0f', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
      case 'critical':
        return { icon: '\ud83d\udea8', color: 'text-red-400', bg: 'bg-red-500/20' };
      default:
        return { icon: '\u2753', color: 'text-gray-400', bg: 'bg-gray-500/20' };
    }
  };

  const getSubscriptionStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      past_due: 'bg-red-500/20 text-red-400 border-red-500/30',
      unpaid: 'bg-red-500/20 text-red-400 border-red-500/30',
      canceled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return styles[status] || styles.active;
  };

  const getInvoiceStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-500/20 text-green-400 border-green-500/30',
      open: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      void: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      uncollectible: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status] || styles.draft;
  };

  const getRiskSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[severity] || styles.medium;
  };

  const getCardBrandIcon = (brand?: string) => {
    const brands: Record<string, string> = {
      visa: '\ud83d\udcb3',
      mastercard: '\ud83d\udcb3',
      amex: '\ud83d\udcb3',
      discover: '\ud83d\udcb3',
    };
    return brands[brand?.toLowerCase() || ''] || '\ud83d\udcb3';
  };

  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">Billing</h3>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">Billing</h3>
        <div className="text-center py-4">
          <p className="text-cscx-gray-400 text-sm">No billing data available</p>
          <p className="text-cscx-gray-500 text-xs mt-1">Connect Stripe to view billing information</p>
        </div>
      </div>
    );
  }

  const healthStatus = getHealthIcon(billingData.billingHealth);
  const activeSubscription = billingData.subscriptions.find(s => s.status === 'active' || s.status === 'trialing');
  const failedInvoices = billingData.invoices.filter(i => i.status === 'open' && i.attemptCount > 0);
  const expiringCard = billingData.paymentMethods.find(pm => pm.status === 'expiring_soon');

  if (compact) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider">Billing</h3>
          <span className={`text-lg ${healthStatus.color}`}>{healthStatus.icon}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-cscx-gray-400">MRR</p>
            <p className="text-lg font-bold text-cscx-accent">{formatCurrency(billingData.mrrCents)}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400">Status</p>
            {activeSubscription ? (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSubscriptionStatusBadge(activeSubscription.status)}`}>
                {activeSubscription.status}
              </span>
            ) : (
              <span className="text-gray-400 text-sm">No active subscription</span>
            )}
          </div>
        </div>

        {billingData.riskSignals.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cscx-gray-800">
            <p className="text-xs text-red-400">{billingData.riskSignals.length} billing alert{billingData.riskSignals.length > 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider">Billing Status</h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${healthStatus.bg}`}>
          <span>{healthStatus.icon}</span>
          <span className={`text-sm font-medium capitalize ${healthStatus.color}`}>
            {billingData.billingHealth.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* MRR/ARR Display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cscx-gray-800 rounded-lg p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-cscx-accent">{formatCurrency(billingData.mrrCents)}</p>
          <p className="text-xs text-cscx-gray-500 mt-1">MRR</p>
        </div>
        <div className="bg-cscx-gray-800 rounded-lg p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Annual Revenue</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(billingData.arrCents)}</p>
          <p className="text-xs text-cscx-gray-500 mt-1">ARR</p>
        </div>
      </div>

      {/* Active Subscription */}
      {billingData.subscriptions.length > 0 && (
        <div>
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-3">Subscriptions</p>
          <div className="space-y-2">
            {billingData.subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 bg-cscx-gray-800 rounded-lg">
                <div>
                  <p className="text-white font-medium">{sub.planName || 'Subscription'}</p>
                  <p className="text-xs text-cscx-gray-400">
                    {formatCurrency(sub.mrrCents)}/mo
                    {sub.cancelAtPeriodEnd && ' - Cancels at period end'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getSubscriptionStatusBadge(sub.status)}`}>
                    {sub.status}
                  </span>
                  <p className="text-xs text-cscx-gray-500 mt-1">
                    Renews {formatDate(sub.currentPeriodEnd)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Signals/Alerts */}
      {billingData.riskSignals.length > 0 && (
        <div>
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-3">Billing Alerts</p>
          <div className="space-y-2">
            {billingData.riskSignals.map((signal, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  signal.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                  signal.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                  'bg-yellow-500/10 border-yellow-500/30'
                }`}
              >
                <span className="text-lg">
                  {signal.severity === 'critical' ? '\ud83d\udea8' : signal.severity === 'high' ? '\u26a0\ufe0f' : '\ud83d\udcac'}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${
                      signal.severity === 'critical' ? 'text-red-400' :
                      signal.severity === 'high' ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>
                      {signal.title}
                    </p>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${getRiskSeverityBadge(signal.severity)}`}>
                      {signal.severity}
                    </span>
                  </div>
                  <p className="text-xs text-cscx-gray-500 mt-1">
                    {formatDate(signal.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Methods */}
      {billingData.paymentMethods.length > 0 && (
        <div>
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-3">Payment Methods</p>
          <div className="space-y-2">
            {billingData.paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between p-3 bg-cscx-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getCardBrandIcon(pm.cardBrand)}</span>
                  <div>
                    <p className="text-white">
                      {pm.cardBrand ? `${pm.cardBrand.charAt(0).toUpperCase()}${pm.cardBrand.slice(1)}` : 'Card'} ending in {pm.cardLast4}
                    </p>
                    <p className="text-xs text-cscx-gray-400">
                      Expires {pm.expMonth}/{pm.expYear}
                    </p>
                  </div>
                </div>
                {pm.status !== 'active' && (
                  <span className={`px-2 py-1 text-xs rounded ${
                    pm.status === 'expired' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {pm.status === 'expired' ? 'Expired' : 'Expiring Soon'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice History Toggle */}
      <div>
        <button
          onClick={() => setShowInvoices(!showInvoices)}
          className="flex items-center gap-2 text-sm text-cscx-accent hover:text-red-400 transition-colors"
        >
          <span>{showInvoices ? '\u25bc' : '\u25b6'}</span>
          Recent Invoices ({billingData.invoices.length})
        </button>

        {showInvoices && (
          <div className="mt-3 space-y-2">
            {billingData.invoices.length === 0 ? (
              <p className="text-sm text-cscx-gray-400 py-2">No invoices yet</p>
            ) : (
              billingData.invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-cscx-gray-800 rounded-lg">
                  <div>
                    <p className="text-white">{formatCurrency(invoice.amountCents)}</p>
                    <p className="text-xs text-cscx-gray-400">
                      {invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : 'No due date'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getInvoiceStatusBadge(invoice.status)}`}>
                      {invoice.status}
                    </span>
                    {invoice.attemptCount > 0 && invoice.status === 'open' && (
                      <p className="text-xs text-red-400 mt-1">
                        {invoice.attemptCount} failed attempt{invoice.attemptCount > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Expiring Card Warning */}
      {expiringCard && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">\u26a0\ufe0f</span>
            <div>
              <p className="text-yellow-400 font-medium">Payment Card Expiring Soon</p>
              <p className="text-sm text-cscx-gray-400 mt-1">
                {expiringCard.cardBrand} ending in {expiringCard.cardLast4} expires {expiringCard.expMonth}/{expiringCard.expYear}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Failed Payments Warning */}
      {failedInvoices.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">\ud83d\udea8</span>
            <div>
              <p className="text-red-400 font-medium">Failed Payments</p>
              <p className="text-sm text-cscx-gray-400 mt-1">
                {failedInvoices.length} invoice{failedInvoices.length > 1 ? 's' : ''} with failed payment attempts
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingWidget;

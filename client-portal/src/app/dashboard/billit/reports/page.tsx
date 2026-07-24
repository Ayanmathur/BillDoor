'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, IndianRupee, TrendingUp, TrendingDown, Minus, 
  Calendar, FileSpreadsheet, Loader2 
} from 'lucide-react';
import { fetchRevenueReportAction } from './actions';
import { fetchExpenseSummaryAction } from '../expenses/actions';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

export default function ReportsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);

  const getDateFilters = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today': {
        const d = now.toISOString().split('T')[0];
        return { dateFrom: d, dateTo: d };
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return { dateFrom: weekAgo, dateTo: now.toISOString().split('T')[0] };
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        return { dateFrom: monthStart, dateTo: now.toISOString().split('T')[0] };
      }
      case 'year': {
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        return { dateFrom: yearStart, dateTo: now.toISOString().split('T')[0] };
      }
      case 'custom':
        return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
      default:
        return {};
    }
  }, [dateRange, customFrom, customTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { dateFrom, dateTo } = getDateFilters();
    try {
      const [revRes, expRes] = await Promise.all([
        fetchRevenueReportAction(dateFrom || '', dateTo || ''),
        // Fallback for if expenses module doesn't export properly yet, handle errors gracefully
        fetchExpenseSummaryAction(dateFrom || '', dateTo || '').catch(() => ({ totalExpenses: 0 })),
      ]);
      setRevenueData(revRes);
      setExpenseData(expRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getDateFilters]);

  useEffect(() => {
    if (dateRange !== 'custom' || (customFrom && customTo)) {
      loadData();
    }
  }, [dateRange, customFrom, customTo, loadData]);

  const totalRev = revenueData?.totalRevenue || 0;
  const totalExp = expenseData?.totalExpenses || 0;
  const estimatedNet = totalRev - totalExp;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/billit" className="text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-semibold">Reports</h1>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center bg-white p-4 rounded-xl border border-neutral-200">
        <div className="flex items-center">
          <Calendar className="w-4 h-4 text-neutral-500 mr-3" />
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year', 'custom'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                  dateRange === range
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'year' ? 'This Year' : range}
              </button>
            ))}
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
            />
            <span className="text-neutral-500 text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue Card */}
          <div className="bg-white p-6 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-sm font-medium">Total Revenue</span>
              <div className="bg-green-50 p-1.5 rounded-md text-green-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold flex items-center">
              <IndianRupee className="w-6 h-6 mr-1 text-neutral-400" />
              {totalRev.toFixed(2)}
            </div>
            <div className="text-sm text-neutral-500 flex justify-between pt-2 border-t border-neutral-100">
              <span>{revenueData?.billCount || 0} Bills</span>
              <span>Avg: ₹{(revenueData?.avgBillValue || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="bg-white p-6 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-sm font-medium">Total Expenses</span>
              <div className="bg-red-50 p-1.5 rounded-md text-red-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold flex items-center">
              <IndianRupee className="w-6 h-6 mr-1 text-neutral-400" />
              {totalExp.toFixed(2)}
            </div>
          </div>

          {/* Estimated Net */}
          <div className="bg-neutral-900 text-white p-6 rounded-xl border border-neutral-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-sm font-medium">Estimated Net</span>
              <div className="bg-white/10 p-1.5 rounded-md text-white">
                <Minus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold flex items-center">
              <IndianRupee className="w-6 h-6 mr-1 text-neutral-400" />
              {estimatedNet.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Links / Sub-pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        <Link 
          href="/dashboard/billit/reports/gst" 
          className="flex items-center justify-between bg-white p-5 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="bg-neutral-100 p-3 rounded-lg group-hover:bg-neutral-200 transition-colors">
              <FileSpreadsheet className="w-5 h-5 text-neutral-700" />
            </div>
            <div>
              <div className="font-medium">GST Summary</div>
              <div className="text-sm text-neutral-500">View tax breakdown by GST rates</div>
            </div>
          </div>
          <span className="text-neutral-400 group-hover:text-neutral-900 transition-colors mr-2">View →</span>
        </Link>
      </div>
    </div>
  );
}

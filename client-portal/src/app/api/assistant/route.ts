import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Simple in-memory rate limiting
const rateLimits = new Map<string, { count: number; timestamp: number }>();

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = user.id;

    // Rate Limit: 20 requests per minute per user
    const now = Date.now();
    const userRateLimit = rateLimits.get(clientId);

    if (userRateLimit) {
      if (now - userRateLimit.timestamp < 60000) {
        if (userRateLimit.count >= 20) {
          return NextResponse.json({ response: 'Rate limit exceeded. Please try again in a moment.' }, { status: 429 });
        }
        userRateLimit.count++;
      } else {
        rateLimits.set(clientId, { count: 1, timestamp: now });
      }
    } else {
      rateLimits.set(clientId, { count: 1, timestamp: now });
    }

    const body = await req.json();
    const query = (body.query || '').trim();

    if (!query) {
      return NextResponse.json({ response: 'Please enter a valid message.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Keyword intent matching for fast direct fallback if Gemini API key is unconfigured
    const lowerQuery = query.toLowerCase();

    // 1. REVENUE INTENT
    if (/revenue|sales|income|earnings|turnover/i.test(lowerQuery)) {
      const period = /month/i.test(lowerQuery) ? 'month' : /week/i.test(lowerQuery) ? 'week' : /year/i.test(lowerQuery) ? 'year' : 'today';
      let gte = new Date();
      gte.setHours(0, 0, 0, 0);
      if (period === 'week') gte.setDate(gte.getDate() - 7);
      if (period === 'month') gte.setMonth(gte.getMonth() - 1);
      if (period === 'year') gte.setFullYear(gte.getFullYear() - 1);

      const { data } = await supabase
        .from('bills')
        .select('grand_total')
        .eq('client_id', clientId)
        .gte('created_at', gte.toISOString());

      const bills = data || [];
      const total = bills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
      return NextResponse.json({
        response: `📊 **Revenue Summary (${period.toUpperCase()})**:\n• Total Revenue: **₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n• Total Bills Issued: **${bills.length}**\n\nNext step: [View Revenue Reports](/dashboard/billit/reports)`
      });
    }

    // 2. EXPENSE INTENT
    if (/expense|cost|spending|outflow|rent|salary|bills paid/i.test(lowerQuery)) {
      let gte = new Date();
      gte.setHours(0, 0, 0, 0);
      gte.setMonth(gte.getMonth() - 1);
      const dateStr = gte.toISOString().split('T')[0];

      const { data } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('client_id', clientId)
        .gte('expense_date', dateStr);

      const expenses = data || [];
      const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      return NextResponse.json({
        response: `💰 **Expense Summary (Last 30 Days)**:\n• Total Expenses: **₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}**\n• Total Logs: **${expenses.length}**\n\nNext step: [Log Operating Expenses](/dashboard/billit/expenses)`
      });
    }

    // 3. RECENT BILLS INTENT
    if (/bill|invoice|recent bill|last bill/i.test(lowerQuery)) {
      const { data } = await supabase
        .from('bills')
        .select('id, bill_number, grand_total, status, created_at, customer:customers(name, phone)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(5);

      const bills = data || [];
      if (bills.length === 0) {
        return NextResponse.json({
          response: `📄 **No bills found yet.**\n\nNext step: [Create Your First Bill](/dashboard/billit/create)`
        });
      }

      const list = bills.map((b: any) => `• Bill **${b.bill_number}** (${b.customer?.name || 'Cash Sales'}) — **₹${Number(b.grand_total).toFixed(2)}** [${b.status}]`).join('\n');
      return NextResponse.json({
        response: `📄 **Recent Sales & Bills**:\n${list}\n\nNext step: [Create New Bill](/dashboard/billit/create)`
      });
    }

    // 4. CUSTOMER INTENT
    if (/customer|client|phone|buyer|visiting/i.test(lowerQuery)) {
      const { data } = await supabase
        .from('customers')
        .select('name, phone, total_visits, total_spent')
        .eq('client_id', clientId)
        .order('last_visit_at', { ascending: false, nullsFirst: false })
        .limit(5);

      const customers = data || [];
      if (customers.length === 0) {
        return NextResponse.json({
          response: `👥 **No customer records found yet.** Customers are automatically created when you create bills or bookings.`
        });
      }

      const list = customers.map((c: any) => `• **${c.name}** (${c.phone}) — ${c.total_visits || 0} visits, ₹${Number(c.total_spent || 0).toFixed(2)} spent`).join('\n');
      return NextResponse.json({
        response: `👥 **Recent Customers**:\n${list}\n\nNext step: [View All Customers](/dashboard/billit/customers)`
      });
    }

    // 5. APPOINTMENT INTENT
    if (/appointment|booking|schedule|slot|resource|queue/i.test(lowerQuery)) {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select('id, service_name, customer_name, customer_phone, slot_start, status')
        .eq('client_id', clientId)
        .gte('slot_start', today)
        .order('slot_start', { ascending: true })
        .limit(5);

      const appointments = data || [];
      if (appointments.length === 0) {
        return NextResponse.json({
          response: `📅 **No upcoming appointments found for today.**\n\nNext step: [View Appointer Calendar](/dashboard/appointer)`
        });
      }

      const list = appointments.map((a: any) => `• **${a.service_name}** for ${a.customer_name} (${a.customer_phone}) at ${new Date(a.slot_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`).join('\n');
      return NextResponse.json({
        response: `📅 **Upcoming Appointments**:\n${list}\n\nNext step: [Manage Appointer Schedule](/dashboard/appointer)`
      });
    }

    // 6. HOW TO CREATE A BILL INTENT
    if (/create|new bill|how to bill|make invoice/i.test(lowerQuery)) {
      return NextResponse.json({
        response: `➕ **Creating a Digital Bill**:\n1. Enter customer phone number\n2. Select or search catalog items\n3. Apply GST or Discount if needed\n4. Click **Save** or **Send WhatsApp** (Alt+W)\n\nNext step: [Create Bill Now](/dashboard/billit/create)`
      });
    }

    // If Gemini API Key is available, use Gemini AI model for remaining general queries
    if (apiKey) {
      try {
        const systemInstruction = `You are BillDoor Assistant, an intelligent read-only AI guide for the BillDoor merchant platform.
Respond concisely (2-4 sentences) with clean markdown links:
- [Create Bill](/dashboard/billit/create)
- [Catalog Items](/dashboard/billit/catalog)
- [Expense Log](/dashboard/billit/expenses)
- [Reports & GST](/dashboard/billit/reports)
- [Appointer Bookings](/dashboard/appointer)
- [Google Reviews](/dashboard/reviews)
- [Orbitex Services](/dashboard/services)
- [Business Settings](/dashboard/settings)`;

        const payload = {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: query }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
        };

        let res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
        }

        if (res.ok) {
          const result = await res.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return NextResponse.json({ response: text });
          }
        }
      } catch (e) {
        console.error('Gemini call error:', e);
      }
    }

    // Default fallback guidance if query is general
    return NextResponse.json({
      response: `I'm here to help you manage your business! You can ask me to:\n• Check **Today's Revenue** or **Expenses**\n• Look up **Customers** or **Bills**\n• Check **Appointments** & **Bookings**\n\nNext step: [Explore Dashboard](/dashboard)`
    });

  } catch (error: any) {
    console.error('Assistant handler error:', error);
    return NextResponse.json({
      response: "I'm ready to assist you! Try asking about your revenue, customers, bills, or appointments."
    });
  }
}

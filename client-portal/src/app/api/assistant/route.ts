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
          return NextResponse.json({ response: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
        }
        userRateLimit.count++;
      } else {
        rateLimits.set(clientId, { count: 1, timestamp: now });
      }
    } else {
      rateLimits.set(clientId, { count: 1, timestamp: now });
    }

    const body = await req.json();
    const query = body.query;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ response: 'Please enter a valid message.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ response: 'AI assistant is not configured yet. Please contact admin to set GEMINI_API_KEY.' });
    }

    const systemInstruction = `You are BillDoor Assistant, a read-only AI business assistant for the BillDoor merchant platform.

YOUR SCOPE & CAPABILITIES:
You assist business owners ONLY with their specific client business data and platform features:
- 👥 Customers (get_customer): Search customer profiles, visits, spending, and last visit date.
- 📄 Bills & Invoices (get_bill): Look up bills by number or recent history with payment status and totals.
- 🏷️ Products & Catalog (search_catalog): Search products, unit prices, GST %, and stock alerts.
- 💰 Revenue Summary (get_revenue_summary): View revenue, bill count, and average bill amount.
- 📊 Expense Log (get_expense_summary): View operating expenses by category (rent, salary, utilities, etc.).
- 📅 Appointments (get_appointment): View appointment schedules and staff timelines.
- 🔗 Feature Navigation (get_feature_links): Direct links to platform pages (Create Bill, Expenses, GST Summary, QR Cards, Services, Settings).
- 🚀 Orbitex Services (check_upsell_opportunities): Suggest digital services with links to /dashboard/services.

RESPONSE CLASSIFICATION RULES:

1. ZERO RESULTS FOUND (Case 1):
   If a tool execution returns empty data (0 matches), state plainly what was searched and suggest trying exact details (e.g. phone number, full name, or bill number). Do NOT apologize with "error" language and do NOT output a full feature menu.

2. OUT OF SCOPE / UNMAPPED INTENT (Case 2):
   If the user asks an off-topic question or something outside your tool set (trivia, general knowledge, coding, weather), respond plainly without saying "error" or "sorry":
   "That's outside what I can look up right now — I can search your customers, bills, catalog items, revenue/expense summaries, and appointments. Want me to check one of those instead?"

3. FORMATTING & LINK DISCIPLINE:
   - Format currency in INR (₹).
   - Only include markdown links when directly relevant to the user's specific request (e.g. [Create Bill](/dashboard/billit/create)). Never output an unrequested list of generic links.`;

    const toolDeclarations = [
      {
        name: "get_customer",
        description: "Searches customers by phone or name, or lists recent customer profiles",
        parameters: {
          type: "OBJECT",
          properties: { search: { type: "STRING", description: "Optional name or phone number" } },
        }
      },
      {
        name: "get_bill",
        description: "Fetches bill details by bill number or recent bill history",
        parameters: {
          type: "OBJECT",
          properties: { bill_number: { type: "STRING", description: "Optional bill number" } },
        }
      },
      {
        name: "search_catalog",
        description: "Searches catalog products and services by name or category",
        parameters: {
          type: "OBJECT",
          properties: { search: { type: "STRING", description: "Optional product or category search query" } },
        }
      },
      {
        name: "get_revenue_summary",
        description: "Returns total revenue and bill count for a period",
        parameters: {
          type: "OBJECT",
          properties: { period: { type: "STRING", enum: ["today", "week", "month", "year"] } },
          required: ["period"]
        }
      },
      {
        name: "get_expense_summary",
        description: "Returns total expenses by category for a period",
        parameters: {
          type: "OBJECT",
          properties: { period: { type: "STRING", enum: ["today", "week", "month", "year"] } },
          required: ["period"]
        }
      },
      {
        name: "get_appointment",
        description: "Returns upcoming or past appointments",
        parameters: {
          type: "OBJECT",
          properties: { 
            date: { type: "STRING", description: "Optional ISO date string" },
            customer_name: { type: "STRING", description: "Optional customer name" }
          },
        }
      },
      {
        name: "get_feature_links",
        description: "Provides direct navigation links to BillDoor features and settings",
        parameters: {
          type: "OBJECT",
          properties: { feature: { type: "STRING", description: "Target feature (create_bill, expenses, reports, gst, catalog, appointer, reviews, qr_links, services, whatsapp, settings)" } },
        }
      },
      {
        name: "check_upsell_opportunities",
        description: "Suggests Orbitex services for business growth with redirect links",
        parameters: {
          type: "OBJECT",
          properties: {},
        }
      }
    ];

    let requestContents: any[] = [{ role: 'user', parts: [{ text: query }] }];

    const makeGeminiRequest = async (contents: any[]) => {
      const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        tools: [{ functionDeclarations: toolDeclarations }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        },
      };

      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        // Fallback to gemini-1.5-flash if 2.0-flash is unavailable or fails
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error status:', response.status, 'body:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      return response.json();
    };

    let result = await makeGeminiRequest(requestContents);
    let candidate = result.candidates?.[0];
    let part = candidate?.content?.parts?.[0];
    let finalText = "";

    if (part?.functionCall) {
      const { name, args } = part.functionCall;
      const safeArgs = args || {};
      let functionResponseData: any = { status: "no data found" };

      try {
        if (name === 'get_customer') {
          const search = String(safeArgs.search || '').trim();
          let query = supabase
            .from('customers')
            .select('name, phone, total_visits, total_spent, last_visit_at, created_at')
            .eq('client_id', clientId)
            .order('last_visit_at', { ascending: false, nullsFirst: false })
            .limit(5);

          if (search) {
            query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);
          }

          const { data, error } = await query;
          if (error) {
            console.error('get_customer query error:', error);
            functionResponseData = { error: error.message };
          } else {
            functionResponseData = { customers: data || [], searched: search };
          }
        } else if (name === 'get_bill') {
          const billNum = String(safeArgs.bill_number || '').trim();
          let query = supabase
            .from('bills')
            .select('id, bill_number, customer_name, customer_phone, grand_total, payment_status, created_at')
            .eq('client_id', clientId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5);

          if (billNum) {
            query = query.ilike('bill_number', `%${billNum}%`);
          }

          const { data, error } = await query;
          if (error) {
            console.error('get_bill query error:', error);
            functionResponseData = { error: error.message };
          } else {
            functionResponseData = { bills: data || [], searched_bill_number: billNum };
          }
        } else if (name === 'search_catalog') {
          const search = String(safeArgs.search || '').trim();
          let query = supabase
            .from('catalog_items')
            .select('name, price, gst_percent, category, buffer_stock, is_active')
            .eq('client_id', clientId)
            .order('name', { ascending: true })
            .limit(10);

          if (search) {
            query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
          }

          const { data, error } = await query;
          if (error) {
            console.error('search_catalog query error:', error);
            functionResponseData = { error: error.message };
          } else {
            functionResponseData = { catalog_items: data || [], searched: search };
          }
        } else if (name === 'get_revenue_summary') {
          let gte = new Date();
          gte.setHours(0, 0, 0, 0);
          if (safeArgs.period === 'week') gte.setDate(gte.getDate() - 7);
          if (safeArgs.period === 'month') gte.setMonth(gte.getMonth() - 1);
          if (safeArgs.period === 'year') gte.setFullYear(gte.getFullYear() - 1);

          const { data, error } = await supabase
            .from('bills')
            .select('grand_total')
            .eq('client_id', clientId)
            .is('deleted_at', null)
            .gte('created_at', gte.toISOString());

          if (error) {
            console.error('get_revenue_summary query error:', error);
            functionResponseData = { error: error.message };
          } else {
            const total = (data || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
            functionResponseData = { total_revenue: total, count: (data || []).length, period: safeArgs.period || 'today' };
          }
        } else if (name === 'get_expense_summary') {
          let gte = new Date();
          gte.setHours(0, 0, 0, 0);
          if (safeArgs.period === 'week') gte.setDate(gte.getDate() - 7);
          if (safeArgs.period === 'month') gte.setMonth(gte.getMonth() - 1);
          if (safeArgs.period === 'year') gte.setFullYear(gte.getFullYear() - 1);

          const dateStr = gte.toISOString().split('T')[0];

          const { data, error } = await supabase
            .from('expenses')
            .select('amount, category')
            .eq('client_id', clientId)
            .is('deleted_at', null)
            .gte('expense_date', dateStr);

          if (error) {
            console.error('get_expense_summary query error:', error);
            functionResponseData = { error: error.message };
          } else {
            const categories: Record<string, number> = {};
            let totalExpense = 0;
            (data || []).forEach(e => {
              const amt = Number(e.amount || 0);
              categories[e.category] = (categories[e.category] || 0) + amt;
              totalExpense += amt;
            });
            functionResponseData = { total_expense: totalExpense, categories, period: safeArgs.period || 'today' };
          }
        } else if (name === 'get_appointment') {
          let q = supabase.from('appointments').select('*').eq('client_id', clientId);
          if (safeArgs.date) {
            let d = new Date(safeArgs.date);
            d.setHours(0, 0, 0, 0);
            let end = new Date(d);
            end.setDate(end.getDate() + 1);
            q = q.gte('start_time', d.toISOString()).lt('start_time', end.toISOString());
          }
          if (safeArgs.customer_name) {
            q = q.ilike('customer_name', `%${safeArgs.customer_name}%`);
          }
          const { data, error } = await q.order('start_time', { ascending: true }).limit(10);
          if (error) {
            console.error('get_appointment query error:', error);
            functionResponseData = { error: error.message };
          } else {
            functionResponseData = { appointments: data || [] };
          }
        } else if (name === 'get_feature_links') {
          const feature = String(safeArgs.feature || '').toLowerCase().trim();
          const links: Record<string, { label: string; url: string; desc: string }> = {
            'create_bill': { label: 'Create Bill', url: '/dashboard/billit/create', desc: 'Create and send a new digital bill' },
            'bills': { label: 'Bills History', url: '/dashboard/billit/bills', desc: 'View past bills, drafts, and sent status' },
            'catalog': { label: 'Catalog Items', url: '/dashboard/billit/catalog', desc: 'Manage your products, services, prices & GST' },
            'expenses': { label: 'Expense Log', url: '/dashboard/billit/expenses', desc: 'Track and log business operating expenses' },
            'reports': { label: 'Revenue & Reports', url: '/dashboard/billit/reports', desc: 'View revenue totals, expenses & net profit estimates' },
            'gst': { label: 'GST Summary', url: '/dashboard/billit/reports/gst-summary', desc: 'Rate-wise GST breakdown & XLSX report export' },
            'appointer': { label: 'Appointments & Staff', url: '/dashboard/appointer', desc: 'Resource timelines, queue & appointment booking' },
            'reviews': { label: 'Google Reviews', url: '/dashboard/reviews', desc: 'Google review collection, private feedback & stats' },
            'qr_links': { label: 'Digital Business Card & QR', url: '/dashboard/settings/qr-links', desc: 'QR cards, digital business card & menu links' },
            'services': { label: 'Orbitex Services', url: '/dashboard/services', desc: 'Request website design, SEO, ads, branding & support' },
            'whatsapp': { label: 'WhatsApp Automation', url: '/dashboard/whatsapp', desc: 'WhatsApp bill templates, broadcasts & automation settings' },
            'settings': { label: 'Business Settings', url: '/dashboard/settings', desc: 'Manage GSTIN, business profile, loyalty & socials' },
          };

          if (feature && links[feature]) {
            functionResponseData = { target: links[feature] };
          } else {
            functionResponseData = { available_features: Object.values(links) };
          }
        } else if (name === 'check_upsell_opportunities') {
          functionResponseData = {
            suggestion: "Upgrade your online presence with Orbitex Services! Visit [Orbitex Services](/dashboard/services) to request Custom Websites, SEO Optimization, Digital Marketing, Brand Identity, QR Menu Design, or Social Media Management."
          };
        }
      } catch (err: any) {
        console.error('Tool execution error:', err);
        functionResponseData = { error: err.message || 'Tool execution failed' };
      }

      // Format response back to Gemini model
      requestContents.push(candidate.content);
      requestContents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: name,
            response: functionResponseData
          }
        }]
      });

      try {
        result = await makeGeminiRequest(requestContents);
        candidate = result.candidates?.[0];
        part = candidate?.content?.parts?.[0];
      } catch (err: any) {
        console.error('Gemini 2nd turn error:', err);
        if (functionResponseData.customers) {
          const list = functionResponseData.customers;
          if (list.length === 0) {
            finalText = `I couldn't find a customer matching '${functionResponseData.searched || ''}'. Try searching with their exact phone number or full name.`;
          } else {
            finalText = `Found ${list.length} customer(s):\n` + list.map((c: any) => `• **${c.name}** (${c.phone}) — ${c.total_visits || 0} visits, ₹${c.total_spent || 0} spent`).join('\n');
          }
        } else if (functionResponseData.bills) {
          const list = functionResponseData.bills;
          if (list.length === 0) {
            finalText = `I couldn't find any bill matching '${functionResponseData.searched_bill_number || ''}'.`;
          } else {
            finalText = `Found ${list.length} bill(s):\n` + list.map((b: any) => `• Bill **${b.bill_number}** for ${b.customer_name || 'Walk-in'} — ₹${b.grand_total} (${b.payment_status})`).join('\n');
          }
        } else {
          finalText = `Found result: ${JSON.stringify(functionResponseData)}`;
        }
      }
    }

    if (!finalText) {
      finalText = part?.text?.trim() || "That's outside what I can look up right now — I can search your customers, bills, catalog items, revenue/expense summaries, and appointments. Want me to check one of those instead?";
    }

    // Safely log query to assistant_queries (fail silently if table doesn't exist yet)
    try {
      await supabase.from('assistant_queries').insert([{
        client_id: clientId,
        query: query,
        response: finalText,
      }]);
    } catch {
      // Ignored
    }

    return NextResponse.json({ response: finalText });

  } catch (error: any) {
    console.error('Assistant handler error:', error);
    return NextResponse.json({
      response: "Something went wrong on my end trying to fetch that. Try again in a moment — if it keeps happening, this is worth flagging to Orbitex support."
    });
  }
}

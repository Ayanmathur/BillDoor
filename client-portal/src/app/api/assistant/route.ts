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

    const systemInstruction = "You are BillDoor Assistant, a helpful read-only business assistant for the BillDoor merchant platform. You assist business owners with looking up customer info, bill details, revenue summaries, expenses, and appointments. You can ONLY read data using the provided tools — never attempt to create, modify, or delete data. Keep answers concise, polite, and format currency in INR (Rs).";

    const toolDeclarations = [
      {
        name: "get_customer",
        description: "Searches customers by phone or partial name",
        parameters: {
          type: "OBJECT",
          properties: { search: { type: "STRING" } },
          required: ["search"]
        }
      },
      {
        name: "get_bill",
        description: "Fetches bill details by bill number",
        parameters: {
          type: "OBJECT",
          properties: { bill_number: { type: "STRING" } },
          required: ["bill_number"]
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
        description: "Returns total expenses by category",
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
        name: "check_upsell_opportunities",
        description: "Checks review trend, module usage, service request history to suggest Orbitex services.",
        parameters: {
          type: "OBJECT",
          properties: {},
        }
      }
    ];

    let requestContents: any[] = [{ role: 'user', parts: [{ text: query }] }];

    const makeGeminiRequest = async (contents: any[]) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            tools: [{ functionDeclarations: toolDeclarations }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000,
            },
          }),
        }
      );

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
            functionResponseData = { customers: data || [] };
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
            functionResponseData = { bills: data || [] };
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
        } else if (name === 'check_upsell_opportunities') {
          functionResponseData = { suggestion: "Consider checking Orbitex Services tab to upgrade your online visibility or custom branding!" };
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
        // Fallback text if second turn fails
        finalText = `Found result for ${name}: ${JSON.stringify(functionResponseData)}`;
      }
    }

    if (!finalText) {
      finalText = part?.text?.trim() || "I am your read-only BillDoor Assistant. Ask me about your bills, revenue, expenses, or customers!";
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
      response: "Sorry, I encountered an error looking up that information. Please try rephrasing your question or specifying details like the customer's name or phone number."
    });
  }
}

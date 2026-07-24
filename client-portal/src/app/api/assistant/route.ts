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

    const { query } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ response: 'AI assistant is not configured yet. Please contact admin.' });
    }

    const systemInstruction = "You are BillDoor Assistant, a helpful read-only business assistant. You help business owners look up customer information, bill details, revenue summaries, expenses, and appointments. You can only READ data, never create/modify/delete anything. Keep responses concise and link to the relevant pages when possible. If asked about something outside your capabilities, politely redirect. Format currency in INR (Rs). Never reveal internal implementation details.";

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
        description: "Checks review trend, module usage, service request history to suggest Orbitex services. Max 1 per conversation."
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
              temperature: 0.1,
            },
          }),
        }
      );
      if (!response.ok) {
        console.error('Gemini API error:', response.status);
        throw new Error('Gemini API error');
      }
      return response.json();
    };

    let result = await makeGeminiRequest(requestContents);
    let candidate = result.candidates?.[0];
    let part = candidate?.content?.parts?.[0];
    let finalText = "";

    if (part?.functionCall) {
      const { name, args } = part.functionCall;
      let functionResponseData: any = { error: "Unknown tool" };

      // Helpers for DB tools
      if (name === 'get_customer') {
        const search = args.search;
        const { data } = await supabase
          .from('customers')
          .select('name, phone, total_visits, total_spent, last_visit')
          .eq('client_id', clientId)
          .or(`phone.ilike.%${search}%,name.ilike.%${search}%`)
          .limit(5);
        functionResponseData = { customers: data || [] };
      } else if (name === 'get_bill') {
        const { data } = await supabase
          .from('bills')
          .select('*')
          .eq('client_id', clientId)
          .eq('bill_number', args.bill_number)
          .single();
        functionResponseData = { bill: data || null };
      } else if (name === 'get_revenue_summary') {
        let gte = new Date();
        gte.setHours(0,0,0,0);
        if (args.period === 'week') gte.setDate(gte.getDate() - 7);
        if (args.period === 'month') gte.setMonth(gte.getMonth() - 1);
        if (args.period === 'year') gte.setFullYear(gte.getFullYear() - 1);
        
        const { data } = await supabase
          .from('bills')
          .select('grand_total')
          .eq('client_id', clientId)
          .gte('created_at', gte.toISOString());
        
        const total = (data || []).reduce((sum, b) => sum + Number(b.grand_total || 0), 0);
        functionResponseData = { total_revenue: total, count: (data || []).length };
      } else if (name === 'get_expense_summary') {
        let gte = new Date();
        gte.setHours(0,0,0,0);
        if (args.period === 'week') gte.setDate(gte.getDate() - 7);
        if (args.period === 'month') gte.setMonth(gte.getMonth() - 1);
        if (args.period === 'year') gte.setFullYear(gte.getFullYear() - 1);

        const { data } = await supabase
          .from('expenses')
          .select('amount, category')
          .eq('client_id', clientId)
          .gte('created_at', gte.toISOString());
        
        const categories: Record<string, number> = {};
        (data || []).forEach(e => {
          categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
        });
        functionResponseData = { expenses_by_category: categories };
      } else if (name === 'get_appointment') {
        let q = supabase.from('appointments').select('*').eq('client_id', clientId);
        if (args?.date) {
           let d = new Date(args.date);
           d.setHours(0,0,0,0);
           let end = new Date(d);
           end.setDate(end.getDate() + 1);
           q = q.gte('start_time', d.toISOString()).lt('start_time', end.toISOString());
        }
        if (args?.customer_name) {
           q = q.ilike('customer_name', `%${args.customer_name}%`);
        }
        const { data } = await q.limit(10);
        functionResponseData = { appointments: data || [] };
      } else if (name === 'check_upsell_opportunities') {
        // Mocked B4 upsell layer as per instructions
        functionResponseData = { suggestion: "Consider setting up a custom domain with Orbitex Services to boost your brand visibility!" };
      }

      // Add the model's function call to history
      requestContents.push(candidate.content);
      
      // Add the function response
      requestContents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: name,
            response: functionResponseData
          }
        }]
      });

      // Call Gemini again for final generation
      result = await makeGeminiRequest(requestContents);
      candidate = result.candidates?.[0];
      part = candidate?.content?.parts?.[0];
    }

    finalText = part?.text?.trim() || "I couldn't generate a response. Please try again.";

    // Log the query and response
    await supabase.from('assistant_queries').insert([{
      client_id: clientId,
      query: query,
      response: finalText,
    }]);

    return NextResponse.json({ response: finalText });

  } catch (error: any) {
    console.error('Assistant error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

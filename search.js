import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// 1. INIT SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 2. INIT OPENAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    // 3. USE GPT TO PARSE INTENT
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that extracts product search intent from Indonesian tech shopper queries. Return a JSON with product_type, use_case (array), budget (number), and style (optional).'
        },
        {
          role: 'user',
          content: query
        }
      ]
    });

    const parsed = JSON.parse(gptResponse.choices[0].message.content);
    const { product_type, use_case, budget } = parsed;

    // 4. QUERY SUPABASE BASED ON GPT OUTPUT
    let supaQuery = supabase
      .from('products')
      .select('*')
      .contains('tags', [product_type])
      .lte('price', budget);

    // Optional: filter by use_case if exists
    if (use_case && use_case.length > 0) {
      supaQuery = supaQuery.contains('use_case', use_case);
    }

    const { data: products, error } = await supaQuery;
    if (error) throw error;

    return res.status(200).json({ results: products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to process query' });
  }
}

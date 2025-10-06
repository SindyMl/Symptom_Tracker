import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symptoms } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing symptoms:', symptoms);

    const systemPrompt = `You are a medical AI assistant specialized in symptom analysis. 
Analyze the provided symptoms and provide risk assessments for potential conditions.

IMPORTANT: You are NOT providing medical diagnoses. You are providing educational risk assessments only.
Always include a disclaimer that users should consult healthcare professionals.

Based on the symptoms, provide:
1. Top 3 possible conditions with probability scores (0-100)
2. Overall risk level (low, medium, high)
3. Brief explanation for each condition
4. Recommended next steps

Return your response in JSON format with this structure:
{
  "conditions": [
    {"name": "condition name", "probability": 75, "explanation": "brief explanation"}
  ],
  "riskLevel": "medium",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "disclaimer": "This is not a medical diagnosis..."
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze these symptoms: ${symptoms.join(', ')}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI response:', aiResponse);
    
    // Parse the JSON response
    let analysis;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback response
      analysis = {
        conditions: [
          {
            name: "Multiple Symptoms",
            probability: 60,
            explanation: "Based on the symptoms provided, we recommend consulting a healthcare professional for proper evaluation."
          }
        ],
        riskLevel: "medium",
        recommendations: [
          "Consult a healthcare professional",
          "Monitor your symptoms",
          "Stay hydrated and rest"
        ],
        disclaimer: "This is not a medical diagnosis. Please consult a healthcare professional for proper evaluation."
      };
    }

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-symptoms:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
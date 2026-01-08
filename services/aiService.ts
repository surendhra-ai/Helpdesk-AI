import { GoogleGenAI, Type } from "@google/genai";
import { LLMSettings, AIRecommendation, Ticket, AgentMetrics } from "../types";

// Fallback/System Key for Gemini features (Live/Audio)
const systemAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const checkHealth = async (settings: LLMSettings): Promise<boolean> => {
  try {
    if (settings.provider === 'gemini') {
      await systemAI.models.generateContent({
        model: 'gemini-2.5-flash-lite-preview',
        contents: 'ping'
      });
      return true;
    } else {
      const response = await fetch(`${settings.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        })
      });
      return response.ok;
    }
  } catch (e) {
    console.error("Health Check Failed", e);
    return false;
  }
};

export const generateChatResponse = async (
  message: string,
  systemInstruction: string,
  settings: LLMSettings
): Promise<string> => {
  try {
    if (settings.provider === 'gemini') {
      const response = await systemAI.models.generateContent({
        model: settings.modelName || 'gemini-3-flash-preview',
        contents: message,
        config: { systemInstruction }
      });
      return response.text || "No response generated.";
    } else {
      // OpenAI / Compatible
      const response = await fetch(`${settings.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: message }
          ]
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No response content.";
    }
  } catch (error) {
    console.error("AI Service Error:", error);
    return `Error: ${error instanceof Error ? error.message : "Failed to connect to AI Provider"}`;
  }
};

export const generateInsights = async (
  tickets: Ticket[],
  agents: AgentMetrics[],
  timeRangeLabel: string,
  settings: LLMSettings
): Promise<AIRecommendation> => {
  
  // Data Preparation (Same as before)
  const closedTickets = tickets.filter(t => t.status === 'Closed');
  const ticketSummary = {
    total: tickets.length,
    closedCount: closedTickets.length,
    byType: tickets.reduce((acc, t) => { acc[t.ticketType] = (acc[t.ticketType] || 0) + 1; return acc; }, {} as Record<string, number>),
    avgRating: (tickets.reduce((acc, t) => acc + t.rating, 0) / (closedTickets.length || 1)).toFixed(2),
  };

  const agentSummary = agents.slice(0, 10).map(a => ({
    id: a.email.split('@')[0],
    load: a.totalTickets,
    performance: a.avgRating.toFixed(2),
    speed: a.avgResolutionHours.toFixed(1)
  }));

  const prompt = `
    Analyze the following Helpdesk data for period: ${timeRangeLabel}.
    Stats: ${JSON.stringify(ticketSummary)}
    Agents: ${JSON.stringify(agentSummary)}
    
    Act as an IT Manager. Provide a JSON response with:
    1. summary: Executive summary.
    2. periodContext: "Insights for ${timeRangeLabel}"
    3. resourceAllocation: Advice on staffing.
    4. ticketReductionStrategy: How to reduce volume.
    5. teamAnalysis: Array of { teamName, insight, recommendation } based on Ticket Types.
    6. agentPerformance: { topPerformer, needsAttention, suggestion }.

    Return ONLY JSON.
  `;

  try {
    if (settings.provider === 'gemini') {
      const response = await systemAI.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              periodContext: { type: Type.STRING },
              resourceAllocation: { type: Type.STRING },
              ticketReductionStrategy: { type: Type.STRING },
              teamAnalysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    teamName: { type: Type.STRING },
                    insight: { type: Type.STRING },
                    recommendation: { type: Type.STRING }
                  }
                }
              },
              agentPerformance: {
                type: Type.OBJECT,
                properties: {
                  topPerformer: { type: Type.STRING },
                  needsAttention: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                }
              }
            }
          }
        }
      });
      return JSON.parse(response.text || "{}") as AIRecommendation;
    } else {
      // OpenAI Compatible JSON Mode
      const response = await fetch(`${settings.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            { role: 'system', content: "You are a data analyst. Output valid JSON only." },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("No content from provider");
      return JSON.parse(content) as AIRecommendation;
    }
  } catch (error) {
    console.error("Insight Generation Failed:", error);
    throw error;
  }
};

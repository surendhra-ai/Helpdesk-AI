import { GoogleGenAI, Type } from "@google/genai";
import { AgentMetrics, Ticket, AIRecommendation, TimeRange } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const INSIGHTS_MODEL = 'gemini-3-flash-preview';
const FAST_MODEL = 'gemini-flash-lite-latest';
const TRANSCRIPTION_MODEL = 'gemini-3-flash-preview';

// --- Fast Chat Response (Flash Lite) ---
export const getFastChatResponse = async (
  message: string,
  dataContext: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: message,
      config: {
        systemInstruction: `You are a helpful IT Helpdesk Data Assistant. 
        You have access to the following current dashboard metrics:
        ${dataContext}
        
        Answer the user's question concisely based on this data. 
        If the answer isn't in the data, say so. 
        Keep responses under 50 words unless asked for detail.`,
      }
    });
    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Fast Chat Error:", error);
    return "Sorry, I'm having trouble connecting to the AI.";
  }
};

// --- Audio Transcription ---
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: base64Audio } }, // MediaRecorder default is usually webm
          { text: "Transcribe this audio strictly. Do not add commentary." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw new Error("Failed to transcribe audio.");
  }
};

// --- Deep Insights (Existing) ---
export const getAIInsights = async (
  tickets: Ticket[],
  agents: AgentMetrics[],
  timeRangeLabel: string
): Promise<AIRecommendation> => {
  
  // 1. Calculate detailed metrics for better AI Context
  const closedTickets = tickets.filter(t => t.status === 'Closed');
  
  // Resolution Time Analysis
  const resolutionTimes = closedTickets.map(t => t.resolutionTimeHours);
  const avgResolutionTime = resolutionTimes.length > 0 
    ? (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(2) 
    : "0";
    
  const resolutionDistribution = {
    fast_under_4h: closedTickets.filter(t => t.resolutionTimeHours < 4).length,
    medium_4_to_24h: closedTickets.filter(t => t.resolutionTimeHours >= 4 && t.resolutionTimeHours < 24).length,
    slow_over_24h: closedTickets.filter(t => t.resolutionTimeHours >= 24).length
  };

  // CSAT Analysis
  const ratedTickets = closedTickets.filter(t => t.rating > 0);
  const ratings = ratedTickets.map(t => t.rating);
  const csatDistribution = {
    positive_4_5: ratings.filter(r => r >= 4).length,
    neutral_3: ratings.filter(r => r === 3).length,
    negative_1_2: ratings.filter(r => r < 3).length
  };

  // Aggregate data for the prompt
  const ticketSummary = {
    total: tickets.length,
    closedCount: closedTickets.length,
    avgResolutionTimeHours: avgResolutionTime,
    resolutionTimeBreakdown: resolutionDistribution,
    csatBreakdown: csatDistribution,
    byType: tickets.reduce((acc, t) => { acc[t.ticketType] = (acc[t.ticketType] || 0) + 1; return acc; }, {} as Record<string, number>),
    byPriority: tickets.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {} as Record<string, number>),
    avgRating: (tickets.reduce((acc, t) => acc + t.rating, 0) / (closedTickets.length || 1)).toFixed(2),
  };

  // Group by "Team" (TicketType) to provide team-level insights including speed and quality
  const teamStats: Record<string, { total: number, resolved: number, avgRating: number, totalTime: number }> = {};
  tickets.forEach(t => {
    if (!teamStats[t.ticketType]) {
      teamStats[t.ticketType] = { total: 0, resolved: 0, avgRating: 0, totalTime: 0 };
    }
    const team = teamStats[t.ticketType];
    team.total += 1;
    if (t.status === 'Closed') {
      team.resolved += 1;
      team.avgRating += t.rating;
      team.totalTime += t.resolutionTimeHours;
    }
  });
  
  // Format team stats for prompt
  const teamSummaryFormatted = Object.entries(teamStats).map(([type, stats]) => ({
    team: type,
    load: stats.total,
    avgResolutionHours: stats.resolved > 0 ? (stats.totalTime / stats.resolved).toFixed(1) : "N/A",
    rating: stats.resolved > 0 ? (stats.avgRating / stats.resolved).toFixed(2) : "N/A"
  }));

  const agentSummary = agents.map(a => ({
    id: a.email.split('@')[0], // Privacy: just use name part
    load: a.totalTickets,
    performance: a.avgRating.toFixed(2),
    speed: a.avgResolutionHours.toFixed(1) + ' hrs'
  }));

  const prompt = `
    Analyze the following Helpdesk performance data for the period: ${timeRangeLabel}.
    
    Overall Stats: ${JSON.stringify(ticketSummary)}
    
    Team/Module Stats (includes Resolution Time and Rating): 
    ${JSON.stringify(teamSummaryFormatted)}
    
    Agent Stats: ${JSON.stringify(agentSummary)}

    Your goal is to act as an IT Service Management Expert.
    Pay close attention to resolution time bottlenecks (tickets > 24 hours) and customer satisfaction trends (CSAT).
    
    Provide a JSON response with:
    1. A high-level executive summary of performance for this period (${timeRangeLabel}), specifically mentioning if resolution speed and quality are meeting expectations based on the breakdown provided.
    2. Specific insights per Team (Ticket Type), correlating workload with resolution speed.
    3. Recommendations on resource allocation (who is overloaded, who needs training, do we need more staff?).
    4. Concrete strategies to minimize ticket volume based on the ticket types provided.
    5. Identify top performer and someone who needs attention.
  `;

  try {
    const response = await ai.models.generateContent({
      model: INSIGHTS_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Executive summary of performance including speed and quality trends." },
            periodContext: { type: Type.STRING, description: `Context label e.g., 'Insights for ${timeRangeLabel}'` },
            resourceAllocation: { type: Type.STRING, description: "Advice on staffing and workload balancing." },
            ticketReductionStrategy: { type: Type.STRING, description: "How to reduce incoming tickets." },
            teamAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  teamName: { type: Type.STRING },
                  insight: { type: Type.STRING, description: "Performance observation regarding speed/quality" },
                  recommendation: { type: Type.STRING, description: "Actionable advice for this team" }
                }
              }
            },
            agentPerformance: {
              type: Type.OBJECT,
              properties: {
                topPerformer: { type: Type.STRING },
                needsAttention: { type: Type.STRING },
                suggestion: { type: Type.STRING, description: "Specific advice for the agent needing attention." }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIRecommendation;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails
    return {
      summary: "Unable to generate insights at this time. Please check your API key.",
      periodContext: "Error",
      resourceAllocation: "Analyze agent load manually.",
      ticketReductionStrategy: "Review high volume categories.",
      teamAnalysis: [],
      agentPerformance: {
        topPerformer: "N/A",
        needsAttention: "N/A",
        suggestion: "N/A"
      }
    };
  }
};
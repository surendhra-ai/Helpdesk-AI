import { RawTicket, Ticket, AgentMetrics, TimeRange } from './types';
import { Blob } from '@google/genai';

// --- Audio Helpers for Live API ---

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function pcmToGeminiBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Convert Float32 (-1.0 to 1.0) to Int16
    int16[i] = data[i] * 32768;
  }
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- End Audio Helpers ---

// Helper to parse dates with multiple formats
const parseCustomDate = (input: any): Date => {
  if (!input || input === '-') return new Date(0); // Fallback to 1970
  
  // If it's already a date object (from Excel parser)
  if (input instanceof Date) {
      if (isNaN(input.getTime())) return new Date(0);
      return input;
  }

  const dateStr = String(input);
  if (dateStr.trim() === '' || dateStr.toLowerCase() === 'null') return new Date(0);

  // Try standard parsing first (handles ISO, MM/DD/YYYY, etc.)
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  // Manual parsers
  try {
    // DD-MM-YYYY or DD.MM.YYYY
    const cleanDateStr = dateStr.replace(/\./g, '-').replace(/\//g, '-');
    const [d, t] = cleanDateStr.split(' ');
    
    // Check if d is DD-MM-YYYY
    const parts = d.split('-');
    if (parts.length === 3) {
        // Simple heuristic: if first part > 12, it's definitely day (DD-MM-YYYY)
        // If 3rd part is year (4 digits)
        let day, month, year;
        
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
        } else {
            // Assume DD-MM-YYYY
            day = parseInt(parts[0]);
            month = parseInt(parts[1]);
            year = parseInt(parts[2]);
        }

        if (t) {
            const [hours, minutes, seconds] = t.split(':');
            return new Date(year, month - 1, day, parseInt(hours || '0'), parseInt(minutes || '0'), parseInt(seconds || '0'));
        } else {
            return new Date(year, month - 1, day);
        }
    }
    
    return new Date(0);
  } catch (e) {
    return new Date(0); 
  }
};

export const parseRawData = (data: RawTicket[]): Ticket[] => {
  return data.map((row) => {
    // Parse assignees with improved robustness
    let assignees: string[] = [];
    const rawAssign = row.Assign;

    if (rawAssign) {
        if (Array.isArray(rawAssign)) {
             assignees = rawAssign.map(String);
        } else {
             const str = String(rawAssign).trim();
             // Handle JSON string format
             if (str.startsWith('[') && str.endsWith(']')) {
                  try { 
                      // Replace single quotes with double quotes for valid JSON
                      assignees = JSON.parse(str.replace(/'/g, '"')); 
                  } catch(e) { 
                      assignees = [str]; 
                  }
             } else if (str.includes(',')) {
                  // Handle CSV string format
                  assignees = str.split(',').map(s => s.trim());
             } else {
                  assignees = [str];
             }
        }
    }

    // Ensure assignees is a flat array of strings and remove empty values
    assignees = assignees.flat().map(a => String(a || '')).filter(a => a.trim() !== '');
    
    // Fallback: If no assignee, try to use Owner
    if (assignees.length === 0 && row.Owner) {
        assignees = [String(row.Owner)];
    }

    // Pass string values safely
    let statusStr = row.Status ? String(row.Status).trim() : 'Open';
    // Normalize status for charts
    const lowerStatus = statusStr.toLowerCase();
    if (lowerStatus === 'resolved' || lowerStatus === 'completed' || lowerStatus === 'verified') {
        statusStr = 'Closed';
    }

    const created = parseCustomDate(row.Creation);
    // Only try to parse resolution date if ticket is closed and date string exists
    const resolved = (statusStr === 'Closed' && row.ResolutionBy) ? parseCustomDate(row.ResolutionBy) : null;
    
    // Calculate resolution time in hours
    let hours = 0;
    // Check created > 1970 to avoid bad math with invalid dates
    if (resolved && created.getTime() > 0 && resolved.getTime() > 0) {
      const diffMs = resolved.getTime() - created.getTime();
      hours = diffMs / (1000 * 60 * 60);
    }
    
    // Ensure ticket type has a value for the Pie Chart
    const tType = row.TicketType ? String(row.TicketType).trim() : 'Unspecified';

    return {
      id: row.Sr ? String(row.Sr) : Math.random().toString(36).substr(2, 9),
      subject: row.Subject ? String(row.Subject) : 'No Subject',
      status: statusStr,
      assignees: assignees,
      customer: row.Customer ? String(row.Customer) : 'Unknown',
      priority: (row.Priority || 'Medium') as any,
      ticketType: tType || 'Unspecified',
      owner: row.Owner ? String(row.Owner) : '',
      rating: row.Rating ? parseFloat(String(row.Rating)) || 0 : 0,
      createdAt: created,
      resolvedAt: resolved,
      resolutionTimeHours: Math.max(0, parseFloat(hours.toFixed(2))),
    };
  });
};

export const filterTickets = (tickets: Ticket[], range: TimeRange): Ticket[] => {
  const now = new Date();
  
  switch (range) {
    case 'last-7-days': {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return tickets.filter(t => t.createdAt >= sevenDaysAgo);
    }
    case 'last-30-days': {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return tickets.filter(t => t.createdAt >= thirtyDaysAgo);
    }
    case 'this-month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return tickets.filter(t => t.createdAt >= startOfMonth);
    }
    case 'last-month': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return tickets.filter(t => t.createdAt >= startOfLastMonth && t.createdAt <= endOfLastMonth);
    }
    case 'all':
    default:
      return tickets;
  }
};

export const getPreviousPeriodTickets = (tickets: Ticket[], range: TimeRange): Ticket[] => {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (range) {
    case 'last-7-days':
      end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return tickets.filter(t => t.createdAt >= start && t.createdAt < end);
    
    case 'last-30-days':
      end = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      return tickets.filter(t => t.createdAt >= start && t.createdAt < end);

    case 'this-month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return tickets.filter(t => t.createdAt >= start && t.createdAt <= end);

    case 'last-month':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      return tickets.filter(t => t.createdAt >= start && t.createdAt <= end);

    case 'all':
    default:
      return []; 
  }
};

export const calculateAgentMetrics = (tickets: Ticket[]): AgentMetrics[] => {
  const map = new Map<string, { total: number; ratingSum: number; timeSum: number; resolvedCount: number; active: number }>();

  tickets.forEach(t => {
    if (!t.assignees || !Array.isArray(t.assignees)) return;
    
    t.assignees.forEach(agent => {
      if (!agent) return;
      // Simple email extraction or name cleanup
      const cleanAgent = String(agent).trim();
      if (!cleanAgent) return;

      if (!map.has(cleanAgent)) {
        map.set(cleanAgent, { total: 0, ratingSum: 0, timeSum: 0, resolvedCount: 0, active: 0 });
      }
      
      const stats = map.get(cleanAgent)!;
      stats.total += 1;
      
      if (t.status === 'Closed') {
        stats.ratingSum += t.rating;
        stats.timeSum += t.resolutionTimeHours;
        stats.resolvedCount += 1;
      } else {
        stats.active += 1;
      }
    });
  });

  const metrics: AgentMetrics[] = [];
  map.forEach((value, key) => {
    if (key) {
      metrics.push({
        email: key,
        totalTickets: value.total,
        avgRating: value.resolvedCount > 0 ? value.ratingSum / value.resolvedCount : 0,
        avgResolutionHours: value.resolvedCount > 0 ? value.timeSum / value.resolvedCount : 0,
        activeTickets: value.active
      });
    }
  });

  return metrics.sort((a, b) => b.totalTickets - a.totalTickets);
};

export const generateMockData = (): Ticket[] => {
  const agents = ['darshitha.d@utilitarianlabs.com', 'navya.a@tridasa.in', 'santhosh.m@tridasa.in', 'mounika.t@tridasa.in'];
  const types = ['SFDC', 'SmartApp', 'IT Operations', 'Unspecified'];
  const priorities = ['Low', 'Medium', 'High'];
  
  const tickets: Ticket[] = [];
  const now = new Date();

  for (let i = 1; i <= 100; i++) { 
    const isClosed = Math.random() > 0.3;
    const created = new Date(now.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000);
    const resolved = isClosed ? new Date(created.getTime() + Math.random() * 48 * 60 * 60 * 1000) : null;
    const hours = resolved ? (resolved.getTime() - created.getTime()) / (3600000) : 0;

    tickets.push({
      id: i.toString(),
      subject: `Issue regarding ${types[Math.floor(Math.random() * types.length)]} module`,
      status: isClosed ? 'Closed' : 'Open',
      assignees: [agents[Math.floor(Math.random() * agents.length)]],
      customer: `user${i}@client.com`,
      priority: priorities[Math.floor(Math.random() * priorities.length)] as any,
      ticketType: types[Math.floor(Math.random() * types.length)],
      owner: 'System',
      rating: isClosed ? Math.floor(Math.random() * 2) + 3 : 0, 
      createdAt: created,
      resolvedAt: resolved,
      resolutionTimeHours: parseFloat(hours.toFixed(2))
    });
  }
  return tickets;
};
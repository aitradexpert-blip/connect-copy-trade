// Deriv Economic Calendar Service
// Fetches economic events that may impact trading

import { getSharedDerivWS, DerivWS } from './derivWebSocket';

export interface EconomicEvent {
  currency: string;
  event_name: string;
  impact: number; // 1 = low, 2 = medium, 3 = high
  release_date: number; // Epoch timestamp
  actual?: {
    display_value: string;
  };
  forecast?: {
    display_value: string;
  };
  previous?: {
    display_value: string;
  };
}

export interface EconomicCalendarResponse {
  economic_calendar: {
    events: EconomicEvent[];
  };
}

/**
 * Get economic calendar events for a date range
 */
export async function getEconomicCalendar(
  startDate: Date,
  endDate: Date,
  ws?: DerivWS
): Promise<EconomicEvent[]> {
  const client = ws || getSharedDerivWS();
  
  try {
    await client.connect();
    
    const response = await client.send({
      economic_calendar: 1,
      start_date: Math.floor(startDate.getTime() / 1000),
      end_date: Math.floor(endDate.getTime() / 1000),
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.economic_calendar?.events || [];
  } catch (error) {
    console.error('[DerivCalendar] Get calendar failed:', error);
    throw error;
  }
}

/**
 * Get today's economic events
 */
export async function getTodaysEvents(ws?: DerivWS): Promise<EconomicEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return getEconomicCalendar(today, tomorrow, ws);
}

/**
 * Get upcoming high-impact events for the next 7 days
 */
export async function getUpcomingHighImpactEvents(
  ws?: DerivWS
): Promise<EconomicEvent[]> {
  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const allEvents = await getEconomicCalendar(now, weekFromNow, ws);
  
  return allEvents.filter(event => event.impact === 3);
}

/**
 * Get events filtered by currency
 */
export async function getEventsByCurrency(
  currency: string,
  startDate: Date,
  endDate: Date,
  ws?: DerivWS
): Promise<EconomicEvent[]> {
  const allEvents = await getEconomicCalendar(startDate, endDate, ws);
  
  return allEvents.filter(event => 
    event.currency.toUpperCase() === currency.toUpperCase()
  );
}

/**
 * Format impact level to string
 */
export function getImpactLabel(impact: number): 'Low' | 'Medium' | 'High' {
  switch (impact) {
    case 1: return 'Low';
    case 2: return 'Medium';
    case 3: return 'High';
    default: return 'Low';
  }
}

/**
 * Get impact color class
 */
export function getImpactColor(impact: number): string {
  switch (impact) {
    case 1: return 'text-muted-foreground';
    case 2: return 'text-yellow-500';
    case 3: return 'text-loss';
    default: return 'text-muted-foreground';
  }
}

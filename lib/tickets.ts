import { SupportTicket } from "./types";

let currentTickets: SupportTicket[] = [];
let ticketCounter = 1001;

export function createSupportTicket(
  issueSummary: string,
  orderId?: string,
  priority: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM"
): { ticket_id: string; eta: string; status: string } {
  const ticketId = `TKT-${ticketCounter++}`;
  const newTicket: SupportTicket = {
    ticket_id: ticketId,
    issue_summary: issueSummary,
    order_id: orderId,
    priority,
    created_at: new Date().toISOString(),
    eta: "within 24 hours",
    status: "OPEN",
  };

  currentTickets.push(newTicket);

  return {
    ticket_id: ticketId,
    eta: "within 24 hours",
    status: "OPEN",
  };
}

export function getAllTickets(): SupportTicket[] {
  return [...currentTickets];
}

export function resetTickets(): void {
  currentTickets = [];
  ticketCounter = 1001;
}

import { CURRENCY_SYMBOLS } from '../types';
import type { Currency, ReminderTone } from '../types';

export function formatCurrency(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym} ${amount.toFixed(2)}`;
}

interface TemplateTokens {
  name: string;
  bill: string;
  amount: string;
  when: string;
  days?: number;
  link: string;
}

export function renderTemplate(tone: ReminderTone, tokens: TemplateTokens): string {
  const templates: Record<ReminderTone, string> = {
    friendly: `Hey {name}! Just a heads up — your share of "{bill}" ({amount}) is due {when}. Easy to settle from the link below. Cheers! 🙌\n{link}`,
    firm: `Hi {name}, your share of "{bill}" ({amount}) is due {when}. Please settle at your earliest convenience: {link}`,
    final: `{name} — final reminder. {amount} for "{bill}" is overdue by {days} days. Please pay today: {link}`,
  };
  return templates[tone]
    .replace(/{name}/g, tokens.name)
    .replace(/{bill}/g, tokens.bill)
    .replace(/{amount}/g, tokens.amount)
    .replace(/{when}/g, tokens.when)
    .replace(/{days}/g, String(tokens.days ?? 0))
    .replace(/{link}/g, tokens.link);
}

export const REMINDER_PREVIEWS: Record<ReminderTone, string> = {
  friendly: `Hey {name}! Just a heads up — your share of "{bill}" ({amount}) is due {when}. Easy to settle from the link below. Cheers! 🙌\n{link}`,
  firm: `Hi {name}, your share of "{bill}" ({amount}) is due {when}. Please settle at your earliest convenience: {link}`,
  final: `{name} — final reminder. {amount} for "{bill}" is overdue by {days} days. Please pay today: {link}`,
};

export function buildWhen(daysToDue: number): string {
  if (daysToDue === 0) return 'today';
  if (daysToDue > 0) return `in ${daysToDue} day${daysToDue === 1 ? '' : 's'}`;
  const abs = Math.abs(daysToDue);
  return `${abs} day${abs === 1 ? '' : 's'} ago`;
}

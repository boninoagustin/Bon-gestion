import { CalendarEvent, EventType } from '../types';

interface StyleRules {
  fermentationDays: number;
  maturationDays: number;
}

const defaultRules: StyleRules = {
  fermentationDays: 7,
  maturationDays: 14,
};

const styleRulesMap: Record<string, StyleRules> = {
  'IPA': { fermentationDays: 7, maturationDays: 10 },
  'Stout': { fermentationDays: 10, maturationDays: 21 },
  'Lager': { fermentationDays: 14, maturationDays: 30 },
  'Pilsner': { fermentationDays: 14, maturationDays: 30 },
  'Ale': { fermentationDays: 7, maturationDays: 14 },
  'APA': { fermentationDays: 7, maturationDays: 10 },
};

export const getRulesForStyle = (style: string): StyleRules => {
  // Try to find an exact match or partial match
  const normalizedStyle = style.toLowerCase();
  for (const [key, rules] of Object.entries(styleRulesMap)) {
    if (normalizedStyle.includes(key.toLowerCase())) {
      return rules;
    }
  }
  return defaultRules;
};

export const generateBatchEvents = (
  batchId: string,
  recipeName: string,
  style: string,
  brewDate: string
): CalendarEvent[] => {
  const rules = getRulesForStyle(style);
  const events: CalendarEvent[] = [];

  const baseDate = new Date(brewDate);
  if (isNaN(baseDate.getTime())) return events;

  const addDays = (date: Date, days: number): string => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // 1. Brew Day (Already happening today or past)
  events.push({
    id: crypto.randomUUID(),
    batchId,
    title: `Cocción: ${recipeName}`,
    start: brewDate,
    type: EventType.BREW,
    completed: true,
  });

  // 2. Fermentation End (Transfer to Maturation / Cold Crash)
  const fermEndDate = addDays(baseDate, rules.fermentationDays);
  events.push({
    id: crypto.randomUUID(),
    batchId,
    title: `Fin Fermentación / Frío: ${recipeName}`,
    start: fermEndDate,
    type: EventType.FERMENTATION_END,
    completed: false,
  });

  // 3. Maturation End / Packaging
  const packagingDate = addDays(new Date(fermEndDate), rules.maturationDays);
  events.push({
    id: crypto.randomUUID(),
    batchId,
    title: `Envasado: ${recipeName}`,
    start: packagingDate,
    type: EventType.PACKAGING,
    completed: false,
  });

  return events;
};

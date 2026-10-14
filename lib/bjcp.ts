export interface BJCPStyleLimits {
  name: string;
  og: { min: number; max: number };
  fg: { min: number; max: number };
  abv: { min: number; max: number };
  ibu: { min: number; max: number };
  srm: { min: number; max: number };
}

export const BJCP_STYLES: Record<string, BJCPStyleLimits> = {
  "American IPA": { name: "American IPA (21A)", og: { min: 1.056, max: 1.070 }, fg: { min: 1.008, max: 1.014 }, abv: { min: 5.5, max: 7.5 }, ibu: { min: 40, max: 70 }, srm: { min: 6, max: 14 } },
  "American Pale Ale": { name: "American Pale Ale (18B)", og: { min: 1.045, max: 1.060 }, fg: { min: 1.010, max: 1.015 }, abv: { min: 4.5, max: 6.2 }, ibu: { min: 30, max: 50 }, srm: { min: 5, max: 10 } },
  "Blonde Ale": { name: "Blonde Ale / Golden (18A)", og: { min: 1.038, max: 1.054 }, fg: { min: 1.008, max: 1.013 }, abv: { min: 3.8, max: 5.5 }, ibu: { min: 15, max: 28 }, srm: { min: 3, max: 6 } },
  "Irish Red Ale": { name: "Irish Red Ale (15A)", og: { min: 1.036, max: 1.046 }, fg: { min: 1.010, max: 1.014 }, abv: { min: 3.8, max: 5.0 }, ibu: { min: 18, max: 28 }, srm: { min: 9, max: 14 } },
  "Hazy IPA": { name: "Hazy IPA / NEIPA (21C)", og: { min: 1.060, max: 1.085 }, fg: { min: 1.010, max: 1.015 }, abv: { min: 6.0, max: 9.0 }, ibu: { min: 25, max: 60 }, srm: { min: 3, max: 7 } },
  "Irish Stout": { name: "Irish Stout (15B)", og: { min: 1.036, max: 1.044 }, fg: { min: 1.007, max: 1.011 }, abv: { min: 4.0, max: 4.5 }, ibu: { min: 25, max: 45 }, srm: { min: 25, max: 40 } },
  "German Pils": { name: "German Pils (5D)", og: { min: 1.044, max: 1.050 }, fg: { min: 1.008, max: 1.013 }, abv: { min: 4.4, max: 5.2 }, ibu: { min: 22, max: 40 }, srm: { min: 2, max: 5 } },
  "Weissbier": { name: "Weissbier (10A)", og: { min: 1.044, max: 1.052 }, fg: { min: 1.010, max: 1.014 }, abv: { min: 4.3, max: 5.6 }, ibu: { min: 8, max: 15 }, srm: { min: 2, max: 6 } },
  "Belgian Dubbel": { name: "Belgian Dubbel (26B)", og: { min: 1.062, max: 1.075 }, fg: { min: 1.008, max: 1.018 }, abv: { min: 6.0, max: 7.6 }, ibu: { min: 15, max: 25 }, srm: { min: 10, max: 17 } },
  "Kölsch": { name: "Kölsch (5B)", og: { min: 1.044, max: 1.050 }, fg: { min: 1.007, max: 1.011 }, abv: { min: 4.4, max: 5.2 }, ibu: { min: 18, max: 30 }, srm: { min: 3.5, max: 5 } },
  "English IPA": { name: "English IPA (12C)", og: { min: 1.050, max: 1.075 }, fg: { min: 1.010, max: 1.018 }, abv: { min: 5.0, max: 7.5 }, ibu: { min: 40, max: 60 }, srm: { min: 6, max: 14 } },
  "Sweet Stout": { name: "Sweet Stout (16A)", og: { min: 1.044, max: 1.060 }, fg: { min: 1.012, max: 1.024 }, abv: { min: 4.0, max: 6.0 }, ibu: { min: 20, max: 40 }, srm: { min: 30, max: 40 } },
  "American Porter": { name: "American Porter (20A)", og: { min: 1.050, max: 1.070 }, fg: { min: 1.012, max: 1.018 }, abv: { min: 4.8, max: 6.5 }, ibu: { min: 25, max: 50 }, srm: { min: 22, max: 40 } },
  "English Porter": { name: "English Porter (13C)", og: { min: 1.040, max: 1.052 }, fg: { min: 1.008, max: 1.014 }, abv: { min: 4.0, max: 5.4 }, ibu: { min: 18, max: 35 }, srm: { min: 20, max: 30 } },
  "American Amber Ale": { name: "American Amber Ale (19A)", og: { min: 1.045, max: 1.060 }, fg: { min: 1.010, max: 1.015 }, abv: { min: 4.5, max: 6.2 }, ibu: { min: 25, max: 40 }, srm: { min: 10, max: 17 } },
  "Session IPA": { name: "Session IPA (21B)", og: { min: 1.038, max: 1.052 }, fg: { min: 1.008, max: 1.014 }, abv: { min: 3.0, max: 5.0 }, ibu: { min: 40, max: 55 }, srm: { min: 3, max: 6 } },
  "Witbier": { name: "Witbier (24A)", og: { min: 1.044, max: 1.052 }, fg: { min: 1.008, max: 1.012 }, abv: { min: 4.5, max: 5.5 }, ibu: { min: 8, max: 20 }, srm: { min: 2, max: 4 } },
  "Saison": { name: "Saison (25B)", og: { min: 1.048, max: 1.065 }, fg: { min: 1.002, max: 1.008 }, abv: { min: 5.0, max: 7.0 }, ibu: { min: 20, max: 35 }, srm: { min: 5, max: 14 } },
  "Czech Premium Pale Lager": { name: "Czech Premium Pale Lager (3B)", og: { min: 1.044, max: 1.060 }, fg: { min: 1.013, max: 1.017 }, abv: { min: 4.2, max: 5.8 }, ibu: { min: 30, max: 45 }, srm: { min: 3.5, max: 6 } },
  "Strong Bitter": { name: "Strong Bitter / ESB (11C)", og: { min: 1.048, max: 1.060 }, fg: { min: 1.010, max: 1.016 }, abv: { min: 4.6, max: 6.2 }, ibu: { min: 30, max: 50 }, srm: { min: 8, max: 18 } }
};

export interface BJCPValidationResult {
  inRange: boolean;
  status: 'ideal' | 'warn-low' | 'warn-high' | 'none';
  message: string;
}

export function validateParameter(
  value: number | undefined,
  range: { min: number; max: number } | undefined,
  paramLabel: string,
  formatter: (v: number) => string = (v) => v.toString()
): BJCPValidationResult {
  if (value === undefined || range === undefined) {
    return { inRange: true, status: 'none', message: '' };
  }

  if (value < range.min) {
    return {
      inRange: false,
      status: 'warn-low',
      message: `${paramLabel} por debajo del estilo: ${formatter(value)} < ${formatter(range.min)}`
    };
  }

  if (value > range.max) {
    return {
      inRange: false,
      status: 'warn-high',
      message: `${paramLabel} por encima del estilo: ${formatter(value)} > ${formatter(range.max)}`
    };
  }

  return {
    inRange: true,
    status: 'ideal',
    message: `${paramLabel} en rango ideal`
  };
}

export function calculateABV(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

import { describe, it, expect } from 'vitest';
import { executeTool, READ_TOOLS, toolExecutors, aiTools } from '../tools';
import { tryOfflineCalculation } from '../calcTools';
import { normalizeTranscript, toSpeechText, looksIncompleteUtterance } from '../voiceText';
import {
  extractCalculatorLinks,
  stripCalculatorTags,
  openCalculatorFromAi,
  peekPendingCalculator,
  clearPendingCalculator,
  CALCULATOR_LABELS
} from '../calculatorBridge';

describe('Brewing AI Calculator Suite & Engineering Dialogue', () => {

  describe('Tool Registry & Declarations (READ_TOOLS & toolExecutors)', () => {
    it('registers all mandatory brewmath calculator tools in READ_TOOLS, aiTools[0].functionDeclarations, and toolExecutors', () => {
      const requiredTools = [
        'calculate_kettle_volume',
       'calculate_strike_water',
       'calculate_sparge_water',
       'calculate_carbonation',
       'calculate_refractometer_correction',
       'calculate_hydrometer_temp_correction',
       'calculate_pitch_rate_and_starter',
       'calculate_acid_addition',
       'calculate_dilution_and_boiloff',
       'calculate_abv',
       'calculate_ibu',
       'calculate_priming',
       'calculate_srm',
       'calculate_recipe_metrics',
      ];

      const readToolNames = READ_TOOLS.map((t) => t.name);
      const declaredNames = aiTools[0].functionDeclarations.map((t) => t.name);

      for (const name of requiredTools) {
        expect(readToolNames).toContain(name);
        expect(declaredNames).toContain(name);
        expect(typeof toolExecutors[name]).toBe('function');
      }
    });
  });

  describe('Scenario 1: Kettle Volume calculation with dimensions', () => {
    it('executes calculate_kettle_volume and yields ~55.8 L for 35 cm diameter and 58 cm height', () => {
      const result = executeTool('calculate_kettle_volume', {
        diameterCm: 35,
        liquidHeightCm: 58,
      });

      expect(result.error).toBeUndefined();
      expect(result.volumeL).toBeCloseTo(55.8, 1);
      expect(result.summary).toContain('55,8 L');
      expect(result.calculatorLinks).toBeDefined();
      expect(result.calculatorLinks![0]).toEqual({
        type: 'KETTLE',
        params: { diameterCm: 35, liquidHeightCm: 58 },
      });
    });

    it('offline engine parses natural language "calcula el volumen de olla en 58 centimetro de alto por 35 de diametro"', () => {
      const utterance = 'calcula el volumen de olla en 58 centimetro de alto por 35 de diametro';
      const offline = tryOfflineCalculation(utterance);

      expect(offline).not.toBeNull();
      expect(offline).toContain('55,8 L');
      expect(offline).toContain('Calculado con motor local offline');
      expect(offline).toContain('[ABRIR_CALCULADORA:');
    });

    it('voice TTS generates clean, spoken phrasing with decimals pronounced naturally', () => {
      const markdown = 'Tenés **55.8 L** en la olla con 35 cm de diámetro y 58 cm de altura.\n[ABRIR_CALCULADORA: {"type":"KETTLE","params":{"diameterCm":35,"liquidHeightCm":58}}]';
      const spoken = toSpeechText(markdown);

      expect(spoken).not.toContain('**');
      expect(spoken).not.toContain('ABRIR_CALCULADORA');
      expect(spoken).toContain('55 coma 8');
      expect(spoken).toContain('litros');
      expect(spoken).toContain('centímetros');
    });
  });

  describe('Scenario 2: Slot-Filling dialogue when missing mandatory parameters', () => {
    it('requires missing diameter and height when user asks "quiero saber cuántos litros tengo en la olla"', () => {
      const result = executeTool('calculate_kettle_volume', {});

      expect(result.error).toBeDefined();
      expect(result.needsUserInput).toBe(true);
      expect(result.missingParameters).toContain('diámetro interior de la olla (cm)');
      expect(result.missingParameters).toContain('altura del líquido (cm)');
      expect(result.askUser).toMatch(/diámetro interior de la olla \(cm\) y altura del líquido \(cm\)/i);
    });

    it('requires missing liquidHeightCm when user only provided diameterCm', () => {
      const result = executeTool('calculate_kettle_volume', { diameterCm: 35 });

      expect(result.error).toBeDefined();
      expect(result.needsUserInput).toBe(true);
      expect(result.missingParameters).toEqual(['altura del líquido (cm)']);
      expect(result.askUser).toMatch(/altura del líquido/i);
    });

    it('offline engine detects incomplete kettle inquiry and guides user with slot-filling prompt', () => {
      const offline = tryOfflineCalculation('quiero saber cuántos litros tengo en la olla');

      expect(offline).not.toBeNull();
      expect(offline).toMatch(/diámetro interior en cm/i);
      expect(offline).toMatch(/altura del líquido en cm/i);
    });
  });

  describe('Scenario 3: Spoken density normalization and ABV calculation', () => {
    it('normalizes spoken words "mil cincuenta" and "mil diez" to 1.050 and 1.010', () => {
      const spoken = 'densidad inicial mil cincuenta y final mil diez, qué alcohol tengo';
      const normalized = normalizeTranscript(spoken);

      expect(normalized).toMatch(/1\.050/);
      expect(normalized).toMatch(/1\.010/);
    });

    it('calculates ABV for OG 1.050 and FG 1.010 with accurate attenuation', () => {
      const result = executeTool('calculate_abv', {
        og: 1.050,
        fg: 1.010,
      });

      expect(result.error).toBeUndefined();
      expect(result.abv).toBeCloseTo(5.25, 1);
      expect(result.apparentAttenuation).toBeCloseTo(80, 0);
      expect(result.calculatorLinks![0]).toEqual({
        type: 'ABV',
        params: { og: 1.05, fg: 1.01 },
      });
    });

    it('offline calculation resolves normalized spoken density query', () => {
      const spoken = 'densidad inicial mil cincuenta y final mil diez, qué alcohol tengo';
      const offline = tryOfflineCalculation(spoken);

      expect(offline).not.toBeNull();
      expect(offline).toContain('5,25 %');
      expect(offline).toContain('80 %');
      expect(offline).toContain('Calculado con motor local offline');
    });

    it('TTS formats gravities ("uno cero cincuenta y dos") and percentages into spoken Spanish without markdown', () => {
      const rawText = 'Con OG 1.052 y FG 1.010 tenés un ABV de 5.2%.';
      const spoken = toSpeechText(rawText);

      expect(spoken).toContain('uno cero cincuenta y dos');
      expect(spoken).toContain('uno cero diez');
      expect(spoken).toContain('5 coma 2 por ciento');
      expect(spoken).not.toContain('OG');
      expect(spoken).toContain('densidad inicial');
    });
  });

  describe('Voice STT Jargon & Utterance Completion Heuristics', () => {
    it('normalizes phonetic brewing jargon to proper terminology', () => {
      expect(normalizeTranscript('vamos a hacer güirpul')).toContain('whirlpool');
      expect(normalizeTranscript('medí con refractometro')).toContain('refractómetro');
      expect(normalizeTranscript('hervor por sesenta minutos')).toContain('60');
    });

    it('detects incomplete utterances to delay voice assistant submission', () => {
      expect(looksIncompleteUtterance('quiero calcular el volumen de la olla pero')).toBe(true);
      expect(looksIncompleteUtterance('la densidad inicial es de')).toBe(true);
      expect(looksIncompleteUtterance('calcula el volumen de la olla.')).toBe(false);
    });
  });

  describe('Calculator Bridge & Deep Linking', () => {
    it('extracts strict JSON and relaxed JS deep link tags and returns clean markdown text', () => {
      const text = 'Resultado: **55.8 L**.\n[ABRIR_CALCULADORA: { type: \'kettle\', params: { diameter: 35, height: 58 } }]\n¡Fijate en la olla!';
      const { cleanText, links } = extractCalculatorLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('KETTLE');
      expect(links[0].params.diameterCm).toBe(35);
      expect(links[0].params.liquidHeightCm).toBe(58);
      expect(cleanText).not.toContain('[ABRIR_CALCULADORA:');
      expect(cleanText).toContain('Resultado: **55.8 L**.');
      expect(stripCalculatorTags(text)).toBe(cleanText);
    });

    it('stores pending deep link on openCalculatorFromAi and dispatches events', () => {
      clearPendingCalculator();
      expect(peekPendingCalculator()).toBeNull();

      openCalculatorFromAi({
        type: 'CARB',
        params: { temperatureC: 4, volumesCo2: 2.5 },
      });

      const pending = peekPendingCalculator();
      expect(pending).not.toBeNull();
      expect(pending!.type).toBe('CARB');
      expect(pending!.params.temperatureC).toBe(4);
      expect(pending!.params.targetCO2Volumes).toBe(2.5);

      clearPendingCalculator('CARB');
      expect(peekPendingCalculator()).toBeNull();
    });

    it('provides friendly Spanish human labels for all calculators', () => {
      expect(CALCULATOR_LABELS.KETTLE).toBe('Volumen de Olla');
      expect(CALCULATOR_LABELS.CARB).toBe('Carbonatación Forzada');
      expect(CALCULATOR_LABELS.ABV).toBe('Alcohol (ABV)');
    });
  });

  describe('Additional Brewing Math Tools', () => {
    it('calculates forced carbonation pressure correctly', () => {
      const result = executeTool('calculate_carbonation', {
        temperatureC: 4,
        volumesCo2: 2.4,
      });

      expect(result.error).toBeUndefined();
      expect(result.psi as number).toBeGreaterThan(10);
      expect(result.psi as number).toBeLessThan(12);
      expect(result.bar as number).toBeCloseTo(0.77, 1);
    });

    it('calculates strike water temperature and volume', () => {
      const result = executeTool('calculate_strike_water', {
        grainWeightKg: 5,
        targetMashTempC: 66,
        grainTempC: 20,
        waterToGrainRatio: 3,
      });

      expect(result.error).toBeUndefined();
      expect(result.mashWaterL).toBe(15);
      expect(result.strikeTempC as number).toBeGreaterThan(70);
      expect(result.strikeTempC as number).toBeLessThan(75);
    });

    it('calculates refractometer post-fermentation correction', () => {
      const result = executeTool('calculate_refractometer_correction', {
        originalBrix: 13,
        finalBrix: 6.5,
      });

      expect(result.error).toBeUndefined();
      expect(result.correctedFg as number).toBeCloseTo(1.010, 2);
      expect(result.abv as number).toBeGreaterThan(4.5);
    });

    it('calculates sparge water volume', () => {
      const result = executeTool('calculate_sparge_water', {
        preBoilVolumeL: 50,
        grainWeightKg: 10,
        waterToGrainRatio: 3,
      });

      expect(result.error).toBeUndefined();
      expect(result.mashWaterL).toBe(30);
      expect(result.spargeWaterL as number).toBeGreaterThan(25);
      expect(result.calculatorLinks![0].type).toBe('SPARGE');
    });

    it('calculates hydrometer temperature correction', () => {
      const result = executeTool('calculate_hydrometer_temp_correction', {
        measuredGravity: 1.050,
        measuredTempC: 50,
        calibrationTempC: 20,
      });

      expect(result.error).toBeUndefined();
      expect(result.correctedGravity as number).toBeGreaterThan(1.050);
      expect(result.calculatorLinks![0].type).toBe('DENSITY');
    });

    it('calculates pitch rate and starter recommendations', () => {
      const result = executeTool('calculate_pitch_rate_and_starter', {
        wortVolumeL: 200,
        wortGravity: 1.055,
        pitchStyle: 'ALE',
      });

      expect(result.error).toBeUndefined();
      expect(result.cellsNeededBillions as number).toBeGreaterThan(100);
      expect(result.dryYeastGrams as number).toBeGreaterThan(50);
      expect(result.calculatorLinks![0].type).toBe('PITCH');
    });

    it('calculates acid addition to reach target mash pH', () => {
      const result = executeTool('calculate_acid_addition', {
        waterVolumeL: 100,
        alkalinityPpm: 120,
        targetPh: 5.4,
        acidType: 'LACTIC',
      });

      expect(result.error).toBeUndefined();
      expect(result.acidDoseMl as number).toBeGreaterThan(0);
      expect(result.calculatorLinks![0].type).toBe('ACID');
    });

    it('calculates dilution water needed to adjust gravity', () => {
      const result = executeTool('calculate_dilution_and_boiloff', {
        currentGravity: 1.060,
        currentVolumeL: 200,
        targetGravity: 1.050,
      });

      expect(result.error).toBeUndefined();
      expect(result.mode).toBe('DILUTION');
      expect(result.waterToAddL as number).toBeCloseTo(40, 0);
      expect(result.calculatorLinks![0].type).toBe('DILUTION');
    });

    it('calculates priming sugar for bottle conditioning', () => {
      const result = executeTool('calculate_priming', {
        volumeLiters: 100,
        temperatureC: 20,
        targetVolumes: 2.5,
      });

      expect(result.error).toBeUndefined();
      expect(result.sugarGrams as number).toBeGreaterThan(500);
      expect(result.calculatorLinks![0].type).toBe('PRIMING');
    });
  });
});

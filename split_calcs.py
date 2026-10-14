import re
import os

with open('components/Calculators.tsx', 'r') as f:
    text = f.read()

def get_block(start_marker, end_marker=None, until_empty_line=False):
    idx = text.find(start_marker)
    if idx == -1: return ""
    
    if end_marker:
        end_idx = text.find(end_marker, idx)
        return text[idx:end_idx].strip()
    
    if until_empty_line:
        end_idx = text.find('\n\n', idx)
        return text[idx:end_idx].strip()
    return ""

def create_calc(name, state_markers, func_markers, render_marker):
    # Find states
    states = []
    for s in state_markers:
        # get all lines matching `const [s, ...`
        pattern = r"^\s*const \[" + s + r",.*?;\n"
        match = re.search(pattern, text, re.MULTILINE)
        if match:
            states.append(match.group(0).strip())

    funcs = []
    for f in func_markers:
        # find const f = () => { ... }
        # this is tricky with regex, we can find the start and then match braces
        idx = text.find(f"const {f} =")
        if idx != -1:
            brace_count = 0
            started = False
            end_idx = idx
            for i in range(idx, len(text)):
                if text[i] == '{':
                    started = True
                    brace_count += 1
                elif text[i] == '}':
                    brace_count -= 1
                if started and brace_count == 0:
                    end_idx = i + 1
                    # check for trailing semicolon or newline
                    while end_idx < len(text) and text[end_idx] in [';', '\n', ' ']:
                        end_idx += 1
                    funcs.append(text[idx:end_idx].strip())
                    break

    render_block = ""
    idx = text.find(f"case '{render_marker}':")
    if idx != -1:
        # find the return ( ... );
        idx_ret = text.find("return (", idx)
        if idx_ret != -1:
            brace_count = 0
            paren_count = 0
            started = False
            end_idx = idx_ret
            for i in range(idx_ret, len(text)):
                if text[i] == '(':
                    started = True
                    paren_count += 1
                elif text[i] == ')':
                    paren_count -= 1
                if started and paren_count == 0:
                    end_idx = i + 1
                    while end_idx < len(text) and text[end_idx] in [';', '\n', ' ']:
                        end_idx += 1
                    render_block = text[idx_ret:end_idx].strip()
                    break

    # also need the const declarations before return if any
    pre_render = ""
    if idx != -1 and idx_ret != -1:
        pre = text[idx + len(f"case '{render_marker}':"):idx_ret].strip()
        if pre:
            pre_render = pre

    component_code = f"""import React, {{ useState }} from 'react';
import {{ SectionCard, InputGroup, ResultCard, WATER_PROFILES }} from './Shared';
import {{ Info, Flame, Trash2, PlusCircle, Check }} from 'lucide-react';
import {{ DebouncedInput }} from '../ui/DebouncedInput';

export const {name} = () => {{
  {chr(10).join(states)}

  {chr(10).join(funcs)}

  {pre_render}
  {render_block}
}};
"""
    with open(f'components/calculators/{name}.tsx', 'w') as f:
        f.write(component_code)
    print(f"Created {name}")

create_calc("PitchCalculator", ["pitchOg", "batchVol", "yeastType", "cellCount"], ["calculatePitch"], "PITCH")
create_calc("EfficiencyCalculator", ["effVolume", "effGravity", "effGrainKg"], ["calculateEfficiency"], "EFFICIENCY")
create_calc("StrikeCalculator", ["grainWeight", "mashRatio", "targetMashTemp", "grainTemp"], ["calculateStrikeTemp"], "STRIKE")
create_calc("DilutionCalculator", ["currentGravDil", "currentVolDil", "targetGravDil"], ["calculateDilution"], "DILUTION")
create_calc("KettleCalculator", ["kettleDiameter", "liquidHeight"], ["calculateKettleVol"], "KETTLE")
create_calc("EquipmentCalculator", ["eqVol", "eqCurrentTemp", "eqTargetTemp", "eqTime"], [], "EQUIPMENT")
create_calc("DensityCalculator", ["measuredGravity", "measuredTemp", "calibrationTemp"], ["calculateCorrectedGravity"], "DENSITY")
create_calc("AcidCalculator", ["acidVol", "acidAlkalinity", "acidTargetPh", "acidType"], ["calculateAcid"], "ACID")
create_calc("CarbCalculator", ["carbMode", "carbTimeLeft", "isTimerRunning", "carbTemp", "carbVol"], ["calculateCarbPressure", "formatTime"], "CARB")
create_calc("RefractometerCalculator", ["refracOGBrix", "refracFGBrix", "refracWCF"], ["calculateRefractometer"], "REFRACTOMETER")
create_calc("PrimingCalculator", ["primingVol", "primingTemp", "primingTargetCO2", "primingSugarType"], ["calculatePriming"], "PRIMING")
create_calc("DryHopCalculator", ["dhVol", "dhRate"], ["calculateDryHop"], "DRY_HOP")
create_calc("ColdCrashCalculator", ["ccStartTemp", "ccTargetTemp", "ccRate"], ["calculateColdCrash"], "COLD_CRASH")
create_calc("CaloriesCalculator", ["og", "fg"], ["calculateCalories"], "CALORIES")


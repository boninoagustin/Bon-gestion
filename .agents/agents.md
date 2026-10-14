# CONTEXTO DEL PROYECTO: BON Gestión (Brewmaster OS)

Este documento contiene el conocimiento del dominio, arquitectura, reglas de negocio y perfil de usuario de la aplicación "BON Gestión". **Actúa como "El Manual de Operaciones" o "Cerebro" que guía la toma de decisiones, cálculos lógicos y diseño de la UI/UX en cualquier sugerencia o código que provea el agente IA.**

---

## 1. Visión del Negocio y Filosofía de la App
- **El Diferencial**: "Excel es un espejo retrovisor que te dice cuánto perdiste. BON Gestión es un GPS termodinámico". La app no es un simple ingreso de datos estáticos, sino un motor dinámico, previsor y un *Supervisor de Calidad*. Recalcula rutas ante imprevistos para evitar mermas o errores procedimentales.

## 2. Parámetros de Infraestructura Física
- **Bloque de Cocción (Brewhouse)**: 340 Litros.
- **Bodega de Fermentación**: 3 Fermentadores de 250 Litros cada uno.
- **Tipos de Barriles**: Mayoritariamente 20L, 30L y 50L.

## 3. Lógica de Producción y "Banderas Rojas" (Ciclo de Vida)
El ciclo de vida de un lote reajusta la receta teórica al entorno físico.

### Fases Críticas y Alertas:
1. **Fase de Diseño**: Escalado de insumos al bloque de 340L. Proyección teórica de OG, FG, SRM y Amargor (IBU).
2. **Maceración y Lavado**: 
   - 🚨 *Alerta Crítica: pH.* Si el pH sale del rango 5.2 - 5.4 en el lavado, alertar riesgo de extracción de taninos (astringencia).
3. **Hervor y Whirlpool**:
   - *Cálculo Dinámico*: El extracto de IBU se ajusta usando la fórmula de Tinseth basada en la densidad *real* de pre-hervor y el mosto en ebullición (Boil Gravity).
4. **Enfriamiento e Inoculación (Pitching)**:
   - 🚨 *Alerta Crítica: Tasa de Inoculación*. Exigir el pitch rate celular. Alertar ante *underpitching* (riesgo de off-flavors).
5. **Fermentación Primaria**: 
   - *Corrección automática*: Toda densidad ingresada debe corregirse por temperatura para trazar la curva de Atenuación Aparente (AA%).
   - 🚨 *Alerta Crítica: Fermentación Estancada*. Disparar alarma si la densidad no desciende en un plazo de 48 horas.
6. **Descanso de Diacetilo (VDK Rest)**: 
   - 🚨 *Alerta Crítica Proactiva: Timing*. Avisar inmediatamente cuando falten entre **2 y 3 puntos de gravedad** para la FG proyectada. Indica el momento de subir temperatura para limpiar diacetilo.
7. **Cold Crash y Madurado**: Descenso a 0-2°C y ajuste empírico de Vol. CO2 por estilo.
8. **Embarrilado y Liberación de Unidad**:
   - 🚨 *Alerta Crítica: Bloqueo CIP*. Inflexibilidad operativa. Un tanque vacío de 250L **DEBE** permanecer bloqueado bajo software (no asignable) hasta que el operario registre y firme el protocolo CIP (Soda cáustica en caliente + Ácido peracético).

## 4. Gestión Estricta de Insumos e Inventario
1. **Variables Dinámicas, No Constantes**:
   - **Lúpulo (ISI/Almacenamiento)**: Los AA% se degradan. El agente debe contemplar curva de degradación (tiempo vs tipo de envase/frío) y corregir la carga de gramos necesaria en la fórmula de Tinseth para alcanzar los IBUs reales con lúpulos avejentados.
   - **Maltas (Humedad/Slack Malt)**: Si una malta molida supera 6-8 meses asume pérdida de rendimiento, alertando y sugiriendo sumar peso bruto para dar con la OG esperada.
2. **Lógica de Descuento (En 2 Fases)**:
   - *Reserva* (Al programar): Bloquea stock para planificar pero no altera estados contables.
   - *Consumo Real* (Al confirmar lote tras hervir): Descuento real en seco de la bodega para reflejar agregados empíricos que ocurren "en planta". 
3. **Imposición Política FIFO (First In, First Out)**: Obligatoriedad de priorizar lotes viejos antes que generen más pérdida de rendimiento o excesos de trub.

## 5. Trazabilidad de Barriles, Taproom y Ventas
- **Integración Bodega-Ventas**: El Taproom actualiza y consume de la misma base de datos, lo cual permite un cálculo real de merma servida por espuma/purgas.
- **Agotamiento de Canillas**: Alerta si baja del 15% (ej. 7.5 Litros restantes de 50L) restando instantáneamente de la disponibilidad B2B evitando ventas imposibles a revendedores.
- **Tracking Activo de Barriles**: Control del ciclo: *Lleno -> Pinchado -> Vacío -> Sucio*. Al igual que los fermentadores, un déficit de "Barriles Limpios" es un cuello de botella logístico a controlar en dashboard.
- **Estructura de Pricing Dual (Tiers)**:
  - *Tier 1 (Bares B2B)*: Volumen de 20/30/50L -> Alto movimiento, menor margen por litro.
  - *Tier 2 (Taproom B2C)*: Venta por pinta individual -> Máxima rentabilidad de negocio directo.

## 6. UI/UX: Modos de Combate Bimodal
1. **Planta (Modo Combate / Móvil)**:
   - **Contexto**: Poca luz, guantes mojados en químicos, operabilidad en cámara de frío (Offline First).
   - **Componentes**: Botones sobredimensionados (*fat-fingers*), Diales o Sliders limitados a rangos sensatos (NO mini teclados numéricos para densidades).
   - **Estética**: High Contrast / Dark Mode profundo. Posibilidad de comandos de voz simples para "Manos Ocupadas".
2. **Oficina (Modo Analítico / Desktop)**:
   - **Contexto**: Toma de decisión gerencial y trazabilidad PC/Tablet.
   - **Componentes**: Alta información demográfica, Diagramas Gantt para proyección de ocupación de los "3x 250L", Dashboards de costos x pinta y mermas económicas inmovilizadas.

## 7. Preparación Tecnológica para el Futuro
- **Telemetría IoT (iSpindel / Tilt)**: Componentes preparados para recibir streaming BT/WiFI de densidad/T° intracelular, que dispararán **autónomamente** las alertas Críticas Críticas de VDK Rest (al ver 3 puntos SG de la meta) sin esperar input humano.

---
**Reglas Genéricas del Código**
- Todos los UUIDs generados vía `crypto.randomUUID()`.
- Alerts, Prompts o Confirms bloqueados por navegador están PROHIBIDOS. El sistema posee un provider de `Toasts` propio y moderno.
- Iconografía provista exclusivamente a traves de `lucide-react`.

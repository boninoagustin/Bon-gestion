import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useBreweryStore } from '../context/store';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Droplet, X, Trash2, CheckCircle2, Circle, Plus, DollarSign, Filter, ListMinus, Sparkles, Wrench, Truck, Clock } from 'lucide-react';
import { BatchStatus, CalendarEvent, EventType, Expense } from '../types';
import { useToast } from './Toast';
import { DebouncedInput } from './ui/DebouncedInput';

export const ProductionCalendar: React.FC = React.memo(() => {
  const batches = useBreweryStore(s => s.batches);
  const settings = useBreweryStore(s => s.settings);
  const fermenters = useBreweryStore(s => s.fermenters);
  const calendarEvents = useBreweryStore(s => s.calendarEvents);
  const expenses = useBreweryStore(s => s.expenses);
  const addCalendarEvent = useBreweryStore(s => s.addCalendarEvent);
  const updateCalendarEvent = useBreweryStore(s => s.updateCalendarEvent);
  const deleteCalendarEvent = useBreweryStore(s => s.deleteCalendarEvent);
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [shiftDays, setShiftDays] = useState(0);
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<EventType>(EventType.CUSTOM);

  // Expense View State
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);

  // Filter State
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PRODUCTION' | 'EXPENSES' | 'OTHER'>('ALL');

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const startDayOfWeek = monthStart.getDay(); // 0 = Sunday

  const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Helpers for filtering
  const isProductionEvent = (type: EventType) => [EventType.BREW, EventType.FERMENTATION_END, EventType.MATURATION_START, EventType.PACKAGING].includes(type);
  const isOtherEvent = (type: EventType) => !isProductionEvent(type);

  // Get events for a specific day
  const getEventsForDay = (day: number) => {
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
      return calendarEvents.filter(e => {
          if (e.start !== dateStr) return false;
          if (activeFilter === 'EXPENSES') return false;
          if (activeFilter === 'PRODUCTION' && !isProductionEvent(e.type)) return false;
          if (activeFilter === 'OTHER' && !isOtherEvent(e.type)) return false;
          return true;
      });
  };

  // Get purchases for a specific day
  const getPurchasesForDay = (day: number) => {
      if (activeFilter === 'PRODUCTION' || activeFilter === 'OTHER') return [];
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
      return expenses.filter(e => e.category === 'INVENTORY' && e.date === dateStr);
  };

  // Upcoming Events (Next 7 days)
  const getUpcomingItems = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeekDate = new Date();
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

      let upcomingEvents = calendarEvents.filter(e => e.start >= todayStr && e.start <= nextWeekStr && !e.completed);
      let upcomingPurchases = expenses.filter(e => e.category === 'INVENTORY' && e.date >= todayStr && e.date <= nextWeekStr);

      const combined = [
          ...upcomingEvents.map(e => ({ type: 'event', date: e.start, item: e })),
          ...upcomingPurchases.map(e => ({ type: 'expense', date: e.date, item: e }))
      ];

      return combined.sort((a, b) => a.date.localeCompare(b.date));
  };
  const upcomingItems = getUpcomingItems();

  const activeBatches = batches.filter(b => 
      b.status === BatchStatus.FERMENTING || b.status === BatchStatus.CONDITIONING
  );

  const getEventStyle = (type: EventType, completed: boolean) => {
      if (completed) return 'bg-slate-200 text-slate-500 line-through opacity-70 dark:bg-slate-800 dark:text-slate-500';
      switch(type) {
          case EventType.BREW: return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
          case EventType.FERMENTATION_END: return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
          case EventType.MATURATION_START: return 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
          case EventType.PACKAGING: return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
          case EventType.MAINTENANCE: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
          case EventType.DELIVERY: return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
          case EventType.CLEANING: return 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800';
          default: return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
      }
  };

  const getEventIcon = (type: EventType) => {
      switch(type) {
          case EventType.BREW: return '🔥';
          case EventType.FERMENTATION_END: return '🧪';
          case EventType.MATURATION_START: return '❄️';
          case EventType.PACKAGING: return '📦';
          case EventType.MAINTENANCE: return <Wrench size={12} className="inline mr-1" />;
          case EventType.DELIVERY: return <Truck size={12} className="inline mr-1" />;
          case EventType.CLEANING: return <Sparkles size={12} className="inline mr-1" />;
          default: return '📅';
      }
  };

  const getEventTypeName = (type: EventType) => {
      switch(type) {
          case EventType.MAINTENANCE: return 'Mantenimiento';
          case EventType.DELIVERY: return 'Entrega/Distribución';
          case EventType.CLEANING: return 'Limpieza Profunda';
          case EventType.CUSTOM: return 'Otro/General';
          default: return type;
      }
  };

  const handleEventClick = (event: CalendarEvent) => {
      setSelectedEvent(event);
      setEditDate(event.start);
      setIsNewEvent(false);
      setIsModalOpen(true);
  };

  const handleDayClick = (day: number) => {
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
      setEditDate(dateStr);
      setNewEventTitle('');
      setNewEventType(EventType.CUSTOM);
      setIsNewEvent(true);
      setSelectedEvent(null);
      setIsModalOpen(true);
  };

  const saveEventChange = () => {
      if (isNewEvent) {
          if(!newEventTitle) return showToast({ message: 'Ingresá un título', type: 'warning' });
          const newEvent: CalendarEvent = {
              id: crypto.randomUUID(),
              title: newEventTitle,
              start: editDate,
              end: undefined,
              type: newEventType,
              completed: false,
              notes: undefined
          };
          addCalendarEvent(newEvent);
          showToast({ message: 'Evento guardado', type: 'success' });
      } else if (selectedEvent) {
          updateCalendarEvent(selectedEvent.id, { start: editDate });
          
          if (shiftDays !== 0 && selectedEvent.batchId) {
              const batchEvents = calendarEvents.filter(e => e.batchId === selectedEvent.batchId && e.id !== selectedEvent.id && e.start >= selectedEvent.start && !e.completed);
              batchEvents.forEach(e => {
                  const d = new Date(e.start);
                  d.setDate(d.getDate() + shiftDays);
                  updateCalendarEvent(e.id, { start: d.toISOString().split('T')[0] });
              });
              showToast({ message: `Fecha actualizada y ${batchEvents.length} eventos futuros reprogramados`, type: 'success' });
          } else {
              showToast({ message: 'Fecha actualizada', type: 'success' });
          }
      }
      closeModal();
  };

  const toggleComplete = () => {
      if (selectedEvent) {
          updateCalendarEvent(selectedEvent.id, { completed: !selectedEvent.completed });
          setSelectedEvent({ ...selectedEvent, completed: !selectedEvent.completed });
      }
  };

  const handleDelete = () => {
      if (selectedEvent) {
          deleteCalendarEvent(selectedEvent.id);
          closeModal();
          showToast({ message: 'Evento eliminado', type: 'info' });
      }
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setSelectedEvent(null);
      setShiftDays(0);
  };

  return (
    <div className="space-y-6 pb-20 relative">
      
      {/* EXPENSE VIEW MODAL */}
      {viewExpense && createPortal(
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-zinc-700/80">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
                      <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2"><DollarSign size={18}/> Detalle de Compra</h3>
                      <button onClick={() => setViewExpense(null)}><X size={24} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                          <p className="text-lg font-medium text-slate-800 dark:text-slate-200">{viewExpense.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                              <p className="text-slate-700 dark:text-slate-300">{viewExpense.date}</p>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
                              <p className="text-xl font-mono font-bold text-red-600 dark:text-red-400">${viewExpense.amount}</p>
                          </div>
                      </div>
                      <div className="pt-2 text-xs text-slate-400 italic text-center">
                          Registrado automáticamente desde Inventario
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* EVENT MODAL */}
      {isModalOpen && createPortal(
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-zinc-700/80">
                  <div className="p-4 border-b border-slate-200 dark:border-zinc-700/80 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
                      <h3 className="font-bold text-slate-800 dark:text-white capitalize">{isNewEvent ? 'Nuevo Evento' : 'Detalle de Evento'}</h3>
                      <button onClick={closeModal}><X size={24} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      {isNewEvent ? (
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                                  <DebouncedInput type="text" value={newEventTitle || ''} onDebouncedChange={val => setNewEventTitle(val.toString())} className="w-full p-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-copper outline-none transition-all" placeholder="Ej: Recibir Maltas" autoFocus />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Evento</label>
                                  <select 
                                      value={newEventType} 
                                      onChange={(e) => setNewEventType(e.target.value as EventType)}
                                      className="w-full p-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-copper outline-none transition-all"
                                  >
                                      <option value={EventType.CUSTOM}>{getEventTypeName(EventType.CUSTOM)}</option>
                                      <option value={EventType.MAINTENANCE}>{getEventTypeName(EventType.MAINTENANCE)}</option>
                                      <option value={EventType.CLEANING}>{getEventTypeName(EventType.CLEANING)}</option>
                                      <option value={EventType.DELIVERY}>{getEventTypeName(EventType.DELIVERY)}</option>
                                  </select>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center mb-4">
                              <div className="text-4xl mb-2 flex justify-center opacity-90">{selectedEvent && getEventIcon(selectedEvent.type)}</div>
                              <h4 className="font-bold text-xl text-slate-800 dark:text-white">{selectedEvent?.title}</h4>
                              <p className="text-sm font-medium text-copper mt-1">
                                  {selectedEvent && !isProductionEvent(selectedEvent.type) ? getEventTypeName(selectedEvent.type) : 'Evento Automático de Lote'}
                              </p>
                              {selectedEvent?.batchId && (
                                  <div className="mt-2 text-xs bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg text-slate-600 dark:text-slate-300 inline-block border border-slate-200 dark:border-slate-600">
                                      Asociado a Lote Generado
                                  </div>
                              )}
                          </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                          <DebouncedInput type="date" value={editDate || ''} onDebouncedChange={val => {
                              const oldDate = new Date(selectedEvent?.start || editDate);
                              const newD = new Date(val.toString());
                              if (!isNaN(oldDate.getTime()) && !isNaN(newD.getTime())) {
                                  setShiftDays(Math.round((newD.getTime() - oldDate.getTime()) / (1000 * 3600 * 24)));
                              }
                              setEditDate(val.toString());
                          }} className="w-full p-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-copper outline-none transition-all" />
                      </div>

                      {!isNewEvent && selectedEvent?.batchId && shiftDays !== 0 && (
                          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800">
                              <p className="text-xs text-orange-700 dark:text-orange-400 font-bold">
                                  {shiftDays > 0 ? `+${shiftDays}` : shiftDays} días de diferencia.
                              </p>
                              <p className="text-[10px] text-orange-600 dark:text-orange-300 mt-1">
                                  Al guardar, los eventos futuros de este lote también se desplazarán automáticamente esta misma cantidad de días.
                              </p>
                          </div>
                      )}

                      {!isNewEvent && (
                          <button onClick={toggleComplete} className={`w-full py-2 rounded-lg font-bold border flex items-center justify-center gap-2 transition-colors ${selectedEvent?.completed ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600' : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50 hover:bg-green-100 dark:hover:bg-green-900/40'}`}>
                              {selectedEvent?.completed ? <><Circle size={16}/> Marcar Pendiente</> : <><CheckCircle2 size={16}/> Marcar Completado</>}
                          </button>
                      )}

                      <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                          {!isNewEvent && <button onClick={handleDelete} className="p-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors"><Trash2 size={20} /></button>}
                          <button onClick={saveEventChange} className="flex-1 bg-slate-dark text-white rounded-lg font-bold hover:bg-slate-800 py-3 shadow-md transition-transform active:scale-95">Guardar Cambios</button>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarIcon className="text-copper" /> Agenda de Producción
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* Filters */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-zinc-800/80 p-1 shadow-sm">
                <button 
                  onClick={() => setActiveFilter('ALL')} 
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${activeFilter === 'ALL' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >Todas</button>
                <button 
                  onClick={() => setActiveFilter('PRODUCTION')} 
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 ${activeFilter === 'PRODUCTION' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                ><Droplet size={14}/> Producción</button>
                <button 
                  onClick={() => setActiveFilter('EXPENSES')} 
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 ${activeFilter === 'EXPENSES' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                ><DollarSign size={14}/> Compras</button>
                <button 
                  onClick={() => setActiveFilter('OTHER')} 
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 ${activeFilter === 'OTHER' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                ><ListMinus size={14}/> Otros</button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-zinc-800/80 p-1 shadow-sm">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-colors"><ChevronLeft size={20} className="text-slate-600 dark:text-slate-400"/></button>
                <span className="text-sm font-bold text-slate-800 w-32 text-center capitalize">{monthName}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"><ChevronRight size={20} className="text-slate-600 dark:text-slate-400"/></button>
            </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
          
          {/* Main Calendar View */}
          <div className="flex-grow space-y-6">
              
              {/* Calendar Grid */}
              <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 overflow-hidden transition-colors">
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50 text-xs font-bold text-slate-500 uppercase text-center py-2">
                      <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
                  </div>
                  <div className="grid grid-cols-7 auto-rows-fr">
                      {/* Empty cells for start offset */}
                      {Array.from({ length: startDayOfWeek }).map((_, i) => (
                          <div key={`empty-${i}`} className="min-h-[7rem] md:min-h-[8rem] border-b border-r border-slate-100 dark:border-zinc-800/50 bg-slate-50/50 dark:bg-zinc-900/20"></div>
                      ))}
                      
                      {/* Days */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const dayEvents = getEventsForDay(day);
                          const dayPurchases = getPurchasesForDay(day);
                          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                          return (
                              <div 
                                key={day} 
                                className={`min-h-[7rem] md:min-h-[8rem] border-b border-r border-slate-100 dark:border-zinc-800/50 p-1.5 relative group cursor-pointer transition-colors ${isToday ? 'bg-amber-50/30 dark:bg-copper/5 ring-1 ring-inset ring-copper/20 dark:ring-copper/30' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/30'}`}
                                onClick={() => handleDayClick(day)}
                              >
                                  <div className="flex justify-between items-start mb-1">
                                      <span className={`text-xs font-bold p-1 rounded-full w-7 h-7 flex items-center justify-center ${isToday ? 'bg-copper text-white shadow-md ring-2 ring-copper/30 ring-offset-1 dark:ring-offset-slate-800 animate-pulse-soft' : 'text-slate-500 dark:text-slate-400'}`}>{day}</span>
                                      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-all" aria-label="Añadir evento">
                                          <Plus size={14} className="text-slate-400" />
                                      </button>
                                  </div>
                                  
                                  <div className="space-y-1.5 overflow-y-auto max-h-24 md:max-h-28 scrollbar-hide">
                                      {/* Production & Custom Events */}
                                      {dayEvents.map(e => (
                                          <div 
                                            key={e.id} 
                                            onClick={(ev) => { ev.stopPropagation(); handleEventClick(e); }}
                                            className={`text-[10px] md:text-xs px-2 py-1 rounded shadow-sm border truncate cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-1.5 ${getEventStyle(e.type, e.completed)}`} 
                                            title={e.title}
                                          >
                                              <span className="shrink-0">{getEventIcon(e.type)}</span>
                                              <span className="truncate font-medium">{e.title}</span>
                                          </div>
                                      ))}
                                      
                                      {/* Purchase Expenses */}
                                      {dayPurchases.map(exp => (
                                          <div 
                                            key={exp.id} 
                                            onClick={(ev) => { ev.stopPropagation(); setViewExpense(exp); }}
                                            className="text-[10px] md:text-xs px-2 py-1 rounded shadow-sm border truncate cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50" 
                                            title={exp.description}
                                          >
                                              <DollarSign size={12} className="shrink-0 opacity-70"/>
                                              <span className="truncate font-medium">{exp.description}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* Fermenter Status Panel */}
              <div className="bg-slate-800 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl p-6 text-white shadow-lg border border-slate-700 dark:border-zinc-800/80">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Droplet className="text-copper"/> Ocupación de Fermentadores</h3>
                  <div className="space-y-3">
                      {activeBatches.length === 0 ? (
                          <div className="bg-slate-700/30 dark:bg-zinc-800/30 border border-slate-600/50 dark:border-zinc-700/50 border-dashed rounded-xl p-6 text-center text-slate-400">
                            <Droplet size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">Todos los fermentadores están libres.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {activeBatches.map((b, idx) => (
                                  <div key={b.id} className="bg-slate-700/50 dark:bg-zinc-800/50 p-4 rounded-xl border border-slate-600 dark:border-zinc-700 card-hover">
                                      <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-white leading-tight">{b.recipeName}</p>
                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-600 text-slate-300 border border-slate-500">
                                            {b.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-400 mb-3">Lote: {b.lotCode}</p>
                                      
                                      <div className="flex justify-between items-end border-t border-slate-600/50 pt-2">
                                          <div className="text-left">
                                              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fecha Cocción</p>
                                              <p className="text-xs font-medium text-slate-300">{b.brewDate}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      {(() => {
                          const totalCap = fermenters.length > 0 ? fermenters.length : (settings.fermenterCapacity || 3);
                          const occupiedCount = fermenters.length > 0 ? fermenters.filter(f => f.status === 'OCCUPIED').length : activeBatches.length;
                          const isFull = occupiedCount >= totalCap;
                          return (
                              <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between items-center text-xs text-slate-400">
                                  <span>Capacidad Total: {totalCap} Fermentadores</span>
                                  <span className={`px-3 py-1 rounded-full font-bold ${isFull ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
                                      {occupiedCount} Ocupados
                                  </span>
                              </div>
                          );
                      })()}
                  </div>
              </div>

          </div>

          {/* Right Sidebar: Upcoming Events Timeline */}
          <div className="w-full xl:w-80 shrink-0 space-y-4">
               <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 p-5">
                   <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                       <Clock className="text-copper" size={20} /> Próximos 7 Días
                   </h3>
                   
                   <div className="space-y-4">
                       {upcomingItems.length === 0 ? (
                           <div className="text-center py-6">
                               <CalendarIcon size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                               <p className="text-sm text-slate-500 dark:text-slate-400">No hay eventos programados para los próximos días.</p>
                           </div>
                       ) : (
                           <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-zinc-700 before:to-transparent">
                               {upcomingItems.map((entry, idx) => {
                                   const isExpense = entry.type === 'expense';
                                   const item = entry.item;
                                   const dateObj = new Date(entry.date);
                                   const dayStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                                   
                                   const today = new Date().toISOString().split('T')[0];
                                   const diffDays = Math.ceil((new Date(entry.date).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24));
                                   let slaTag = '';
                                   let slaColor = '';
                                   if (!isExpense && !(item as CalendarEvent).completed) {
                                       if (diffDays < 0) { slaTag = 'Vencida'; slaColor = 'bg-red-500 text-white'; }
                                       else if (diffDays === 0) { slaTag = 'Hoy'; slaColor = 'bg-orange-500 text-white'; }
                                       else if (diffDays <= 2) { slaTag = 'En 48h'; slaColor = 'bg-yellow-500 text-white'; }
                                   }

                                   return (
                                       <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4">
                                           {/* Icon Marker */}
                                           <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-slate-200 dark:bg-zinc-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 
                                           ${!isExpense ? (item as CalendarEvent).completed ? 'opacity-50' : '' : ''}`}>
                                                {!isExpense ? (
                                                    <span className="text-[10px]">{getEventIcon((item as CalendarEvent).type)}</span>
                                                ) : (
                                                    <DollarSign size={10} className="text-red-600" />
                                                )}
                                           </div>
                                           {/* Content Card */}
                                           <div className={`w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded shadow-sm border bg-white dark:bg-slate-800
                                               ${!isExpense 
                                                ? getEventStyle((item as CalendarEvent).type, (item as CalendarEvent).completed) 
                                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/30'}`}>
                                               <div className="flex justify-between items-start mb-1">
                                                   <span className="font-bold text-xs uppercase opacity-70 tracking-wider">{dayStr}</span>
                                                   {slaTag && (
                                                       <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${slaColor}`}>
                                                           {slaTag}
                                                       </span>
                                                   )}
                                               </div>
                                               <p className="font-medium text-sm leading-tight text-balance">
                                                   {!isExpense ? (item as CalendarEvent).title : (item as Expense).description}
                                               </p>
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>
                       )}
                   </div>
               </div>
          </div>
      </div>
    </div>
  );
});

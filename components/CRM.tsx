import React, { useState, useRef } from 'react';
import { useBreweryStore } from '../context/store';
import { Plus, Search, Phone, MapPin, Trash2, Pencil, Users, User, CreditCard, AlertTriangle } from 'lucide-react';
import { Customer } from '../types';
import { useToast } from './Toast';
import { EmptyState } from './EmptyState';
import { DebouncedInput } from './ui/DebouncedInput';
import { CustomerModal } from './CustomerModal';
import { PaymentModal } from './PaymentModal';
import { getCustomerInsights } from '../lib/crm';
import { useVirtualizer } from '@tanstack/react-virtual';

export const CRM: React.FC = React.memo(() => {
  const customers = useBreweryStore(s => s.customers);
  const sales = useBreweryStore(s => s.sales);
  const payments = useBreweryStore(s => s.payments);
  const addCustomer = useBreweryStore(s => s.addCustomer);
  const deleteCustomer = useBreweryStore(s => s.deleteCustomer);
  const { showToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'ALL' | 'DEBTORS' | 'HIGH_RISK'>('ALL');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = customers.filter(c => {
    const searchMatch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contact && c.contact.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!searchMatch) return false;
    const insights = getCustomerInsights(c, sales, payments);
    if (customerFilter === 'DEBTORS') return c.debt > 0;
    if (customerFilter === 'HIGH_RISK') return insights.riskScore >= 60;
    return true;
  });

  const rowVirtualizer = useVirtualizer({
    count: filteredCustomers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  const openAddCustomer = () => {
      setSelectedCustomer(null);
      setIsCustomerModalOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
      setSelectedCustomer(c);
      setIsCustomerModalOpen(true);
  };

  const openPaymentModal = (c: Customer) => {
      setSelectedCustomer(c);
      setIsPaymentModalOpen(true);
  };

  const handleDelete = (id: string) => {
      const customer = customers.find(c => c.id === id);
      deleteCustomer(id);
      showToast({ 
        message: `${customer?.name || 'Cliente'} eliminado`, 
        type: 'undo', 
        onUndo: () => { if (customer) addCustomer(customer); }
      });
  };

  const totalReceivables = customers.reduce((acc, c) => acc + c.debt, 0);
  const debtorsCount = customers.filter(c => c.debt > 0).length;
  const highRiskCount = customers.filter(c => getCustomerInsights(c, sales, payments).riskScore >= 60).length;

  return (
    <div className="space-y-6 pb-20 relative">
      
      {isCustomerModalOpen && (
        <CustomerModal
            customerToEdit={selectedCustomer}
            onClose={() => setIsCustomerModalOpen(false)}
        />
      )}

      {isPaymentModalOpen && selectedCustomer && (
        <PaymentModal
            customer={selectedCustomer}
            onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900/40 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-3">
            <Users className="text-copper" size={28} /> 
            CRM & Clientes
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Gestión de cuentas corrientes y deudas.</p>
        </div>
        <button onClick={openAddCustomer} className="bg-copper hover:bg-copper-dark text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-copper/20 flex items-center gap-2 transition-all active:scale-95 w-full md:w-auto justify-center">
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="md:col-span-2 relative">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={20} />
           <DebouncedInput 
             type="text" 
             placeholder="Buscar cliente por nombre..." 
             value={searchTerm} 
             onDebouncedChange={val => setSearchTerm(val.toString())} 
             className="w-full pl-12 pr-4 py-3.5 border border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-sm bg-white dark:bg-zinc-900/60 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-copper/50 outline-none transition-all backdrop-blur-md" 
           />
         </div>
         <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700/80 shadow-sm flex flex-col justify-center items-center md:items-end backdrop-blur-md">
           <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Total por Cobrar</span>
           <span className="text-2xl font-bold font-mono text-red-500 dark:text-red-400">${totalReceivables.toFixed(0)}</span>
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => setCustomerFilter('ALL')} className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${customerFilter === 'ALL' ? 'bg-slate-900 text-white dark:bg-zinc-800 border-slate-900 dark:border-zinc-700 shadow-md' : 'bg-white text-slate-500 border-slate-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700/80 backdrop-blur-sm'}`}>Todos ({customers.length})</button>
        <button onClick={() => setCustomerFilter('DEBTORS')} className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${customerFilter === 'DEBTORS' ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20' : 'bg-white text-slate-500 border-slate-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/50 backdrop-blur-sm'}`}>Con deuda ({debtorsCount})</button>
        <button onClick={() => setCustomerFilter('HIGH_RISK')} className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${customerFilter === 'HIGH_RISK' ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20' : 'bg-white text-slate-500 border-slate-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900/50 backdrop-blur-sm'}`}>Alto riesgo ({highRiskCount})</button>
      </div>

      <div>
         {filteredCustomers.length === 0 ? (<EmptyState type="customers" actionLabel={searchTerm ? undefined : 'Nuevo Cliente'} onAction={searchTerm ? undefined : openAddCustomer} />) : (
             <div 
               ref={parentRef}
               className="max-h-[calc(100vh-350px)] overflow-y-auto rounded-xl scrollbar-hide"
             >
               <div
                 style={{
                   height: `${rowVirtualizer.getTotalSize()}px`,
                   width: '100%',
                   position: 'relative',
                 }}
               >
                 {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                   const customer = filteredCustomers[virtualRow.index];
                   return (
                     <div
                       key={virtualRow.key}
                       data-index={virtualRow.index}
                       ref={rowVirtualizer.measureElement}
                       style={{
                         position: 'absolute',
                         top: 0,
                         left: 0,
                         width: '100%',
                         transform: `translateY(${virtualRow.start}px)`,
                       }}
                       className="pb-4"
                     >                       <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 overflow-hidden group hover:shadow-md transition-shadow">
                          {(() => {
                            const insights = getCustomerInsights(customer, sales, payments);
                            const riskColor = insights.riskScore >= 60 ? 'text-red-500' : insights.riskScore >= 35 ? 'text-amber-500' : 'text-emerald-500';
                            return (
                              <>
                           <div className="p-5 flex justify-between items-start border-b border-slate-100 dark:border-zinc-800/50">
                               <div className="flex items-start gap-4">
                                 <div className="bg-slate-100 dark:bg-zinc-800/80 p-3 rounded-xl text-slate-600 dark:text-zinc-300 shadow-inner">
                                   <User size={28} />
                                 </div>
                                 <div>
                                   <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-xl">{customer.name}</h3>
                                   <div className="space-y-1 mt-1.5">
                                     {customer.contact && <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5"><Phone size={12}/> {customer.contact}</p>}
                                     {customer.address && <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5"><MapPin size={12}/> {customer.address}</p>}
                                   </div>
                                 </div>
                               </div>
                               <div className="text-right">
                                 <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider mb-0.5">Deuda</p>
                                 <p className={`text-2xl font-bold font-mono tracking-tight ${customer.debt > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>${customer.debt.toFixed(0)}</p>
                                 <p className={`text-xs font-bold mt-1 ${riskColor}`}>Riesgo: {insights.riskScore}/100</p>
                               </div>
                           </div>
                           <div className="px-5 py-3 bg-slate-50/80 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800/50 text-sm flex items-center justify-between">
                              <span className="text-slate-500 dark:text-zinc-400">{customer.debt > 0 ? <>Antigüedad deuda: <strong className="text-slate-700 dark:text-zinc-200">{insights.debtAgeDays} días</strong></> : <strong className="text-emerald-600 dark:text-emerald-500">Al día</strong>}</span>
                              {insights.riskScore >= 60 && <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1.5 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md"><AlertTriangle size={14}/> Cobranza prioritaria</span>}
                           </div>
                           <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-zinc-800/20 flex justify-between items-center gap-3">
                               <div className="flex gap-2">
                                 <button onClick={() => openEditCustomer(customer)} className="p-2 text-slate-400 dark:text-zinc-500 hover:text-copper dark:hover:text-copper hover:bg-copper/10 rounded-xl transition-colors" title="Editar Datos"><Pencil size={18}/></button>
                                 <button onClick={() => handleDelete(customer.id)} className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors" title="Eliminar"><Trash2 size={18}/></button>
                               </div>
                               <button onClick={() => openPaymentModal(customer)} className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-zinc-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"><CreditCard size={16} /> Registrar Pago</button>
                           </div>
                           <div className="px-5 py-3 bg-white dark:bg-zinc-900/40 border-t border-slate-100 dark:border-zinc-800/80">
                               <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Últimos Movimientos</p>
                               <div className="space-y-2">
                                   {(() => {
                                     const history = insights.timeline;
                                     if (history.length === 0) return <p className="text-sm text-slate-400 dark:text-zinc-600 italic">Sin movimientos</p>;
                                     return history.map((item) => (
                                       <div key={item.id} className="flex justify-between text-sm border-b border-slate-50 dark:border-zinc-800/30 pb-1.5 last:border-0 last:pb-0">
                                           <span className="text-slate-600 dark:text-zinc-400"><span className="text-xs text-slate-400 dark:text-zinc-500 font-mono mr-2">{item.date}</span> {item._type === 'SALE' ? (item.description || 'Venta') : (item.notes || 'Pago')}</span>
                                           <span className={`font-mono font-bold ${item._type === 'SALE' ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{item._type === 'SALE' ? '-' : '+'}${item.amount}</span>
                                       </div>
                                    ));
                                   })()}
                               </div>
                           </div>
                              </>
                            );
                          })()}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
         )}
      </div>
    </div>
  );
});
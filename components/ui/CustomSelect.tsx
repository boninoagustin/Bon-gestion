import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = 'w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
  containerClassName = 'w-full relative z-50',

  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const index = options.findIndex(opt => opt.value === value);
      setFocusedIndex(index >= 0 ? index : 0);
    }
  }, [isOpen, value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${containerClassName}`} ref={containerRef}>
      <div 
        className={`flex items-center justify-between cursor-pointer focus:outline-none focus:border-copper ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setIsOpen(true);
            }
            return;
          }
          if (e.key === 'Escape') {
            setIsOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => (prev < options.length - 1 ? prev + 1 : prev));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < options.length) {
              onChange(options[focusedIndex].value);
              setIsOpen(false);
            }
          }
        }}
      >
        <div className="flex items-center flex-1 overflow-hidden">
          {icon && (
            <div className="mr-2 text-slate-400 dark:text-slate-500 pointer-events-none shrink-0">
              {icon}
            </div>
          )}
          <span className={`block truncate ${!selectedOption ? 'text-slate-500' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2 pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto">
          {options.map((option, index) => (
            <div
              key={option.value}
              className={`p-3 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${value === option.value ? 'bg-copper/10 text-copper font-bold' : 'text-slate-700 dark:text-slate-200'} ${focusedIndex === index && value !== option.value ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
          {options.length === 0 && (
            <div className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Sin opciones
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  className = 'w-full min-h-[44px] border border-slate-200 dark:border-[#2c3138] rounded-xl p-3 text-sm bg-slate-50 dark:bg-[#121417] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#d97706]/60',
  containerClassName = 'w-full relative z-50',
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const index = options.findIndex((opt) => opt.value === value);
      setFocusedIndex(index >= 0 ? index : 0);
    }
  }, [isOpen, value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${containerClassName}`} ref={containerRef}>
      <div
        className={`flex items-center justify-between cursor-pointer transition-colors ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!isOpen) {
            if (
              e.key === 'Enter' ||
              e.key === ' ' ||
              e.key === 'ArrowDown' ||
              e.key === 'ArrowUp'
            ) {
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
            setFocusedIndex((prev) =>
              prev < options.length - 1 ? prev + 1 : prev
            );
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
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
            <div className="mr-2.5 text-slate-400 dark:text-slate-400 pointer-events-none shrink-0">
              {icon}
            </div>
          )}
          <span
            className={`block truncate ${
              !selectedOption
                ? 'text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-white font-medium'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 ml-2 pointer-events-none transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#f59e0b]' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-[110] w-full mt-1.5 bg-white dark:bg-[#1a1d21] border border-slate-200 dark:border-[#2c3138] rounded-xl shadow-2xl max-h-60 overflow-auto divide-y divide-slate-100 dark:divide-[#2c3138]/60">
          {options.map((option, index) => (
            <div
              key={option.value}
              className={`min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm flex items-center cursor-pointer transition-colors ${
                value === option.value
                  ? 'bg-[#d97706]/15 text-[#f59e0b] font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#22262b]'
              } ${
                focusedIndex === index && value !== option.value
                  ? 'bg-slate-100 dark:bg-[#22262b]'
                  : ''
              }`}
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
            <div className="p-3.5 text-xs text-slate-500 dark:text-slate-400 text-center">
              Sin opciones disponibles
            </div>
          )}
        </div>
      )}
    </div>
  );
};

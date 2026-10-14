import React, { useState, useEffect, useRef } from 'react';

interface DebouncedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string | number;
  debounceMs?: number;
  onDebouncedChange: (value: string) => void;
  onEnter?: (value: string) => void;
}

export const DebouncedInput = React.forwardRef<HTMLInputElement, DebouncedInputProps>(({
  value,
  onDebouncedChange,
  debounceMs = 300,
  onEnter,
  ...props
}, ref) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  const callbackRef = useRef(onDebouncedChange);

  useEffect(() => {
    callbackRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  useEffect(() => {
    if (localValue === value?.toString()) return;

    // Avoid overwriting local input when user types decimal separators or trailing zeros
    // e.g. localValue = "1.0", value = 1. They are numerically equal, so don't format.
    const parsedLocal = parseFloat(localValue.replace(',', '.'));
    const parsedValue = typeof value === 'number' ? value : parseFloat(value?.toString().replace(',', '.') || '');
    
    if (!isNaN(parsedLocal) && !isNaN(parsedValue) && parsedLocal === parsedValue) {
      return;
    }

    // Don't force a '0' if the user cleared the input
    if (localValue === '' && (value === 0 || value === '')) {
      return;
    }

    setLocalValue(value?.toString() || '');
  }, [value]);

  useEffect(() => {
    if (localValue === (value?.toString() || '')) return;

    const timeoutId = setTimeout(() => {
      callbackRef.current(localValue);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [localValue, value, debounceMs]);

  return (
    <input
      ref={ref}
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => {
        if (localValue !== (value?.toString() || '')) callbackRef.current(localValue);
        if (props.onBlur) props.onBlur(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (localValue !== (value?.toString() || '')) callbackRef.current(localValue);
          if (onEnter) {
            e.preventDefault();
            onEnter(localValue);
          }
        }
        if (props.onKeyDown) props.onKeyDown(e);
      }}
    />
  );
});

interface DebouncedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string | number;
  debounceMs?: number;
  onDebouncedChange: (value: string) => void;
  onEnter?: (value: string) => void;
}

export const DebouncedTextarea = React.forwardRef<HTMLTextAreaElement, DebouncedTextareaProps>(({
  value,
  onDebouncedChange,
  debounceMs = 300,
  onEnter,
  ...props
}, ref) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  const callbackRef = useRef(onDebouncedChange);

  useEffect(() => {
    callbackRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  useEffect(() => {
    if (localValue === value?.toString()) return;

    const parsedLocal = parseFloat(localValue.replace(',', '.'));
    const parsedValue = typeof value === 'number' ? value : parseFloat(value?.toString().replace(',', '.') || '');
    
    if (!isNaN(parsedLocal) && !isNaN(parsedValue) && parsedLocal === parsedValue) {
      return;
    }

    if (localValue === '' && (value === 0 || value === '')) {
      return;
    }

    setLocalValue(value?.toString() || '');
  }, [value]);

  useEffect(() => {
    if (localValue === (value?.toString() || '')) return;

    const timeoutId = setTimeout(() => {
      callbackRef.current(localValue);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [localValue, value, debounceMs]);

  return (
    <textarea
      ref={ref}
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => {
        if (localValue !== (value?.toString() || '')) callbackRef.current(localValue);
        if (props.onBlur) props.onBlur(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (localValue !== (value?.toString() || '')) callbackRef.current(localValue);
          if (onEnter) {
            e.preventDefault();
            onEnter(localValue);
          }
        }
        if (props.onKeyDown) props.onKeyDown(e);
      }}
    />
  );
});

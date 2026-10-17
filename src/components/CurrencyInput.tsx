import React, { useState, useCallback, useEffect } from 'react';
import { formatCurrencyInput, currencyInputToNumber, numberToCurrencyInput } from '@/utils/currency';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  className = '',
  disabled = false,
}) => {
  const [displayValue, setDisplayValue] = useState(() => 
    value > 0 ? numberToCurrencyInput(value) : ''
  );

  useEffect(() => {
    setDisplayValue(value > 0 ? numberToCurrencyInput(value) : '');
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const formatted = formatCurrencyInput(rawValue);
    setDisplayValue(formatted);
    onChange(currencyInputToNumber(formatted));
  }, [onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Valor"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full pl-12 pr-4 py-4 rounded-xl
          bg-input border border-border
          text-foreground font-mono text-lg
          placeholder:text-muted-foreground
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${className}
        `}
      />
    </div>
  );
};

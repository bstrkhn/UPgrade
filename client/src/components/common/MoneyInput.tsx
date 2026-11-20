import { finalizeMoneyInput, formatRupiah, sanitizeMoneyInput } from '../../utils/currency';

interface MoneyInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (cleanValue: string) => void;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  placeholder = '0',
  helperText,
  errorText,
  required = false,
  disabled = false,
  autoFocus = false,
}: MoneyInputProps) {
  const preview = value.length > 0 && value !== '0' ? formatRupiah(finalizeMoneyInput(value)) : null;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-slate-500">
          Rp
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(sanitizeMoneyInput(event.target.value))}
          onBlur={() => {
            const finalized = finalizeMoneyInput(value);
            if (finalized !== value) {
              onChange(finalized);
            }
          }}
          className={`money w-full rounded-xl border bg-white py-2.5 pr-3.5 pl-10 text-sm font-semibold text-slate-900 transition outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
            errorText
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
              : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-100'
          }`}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        {errorText ? (
          <span className="font-medium text-rose-600">{errorText}</span>
        ) : helperText ? (
          <span className="text-slate-500">{helperText}</span>
        ) : (
          <span />
        )}
        {preview && <span className="money font-medium text-slate-500">{preview}</span>}
      </div>
    </div>
  );
}

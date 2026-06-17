// Accessible form wrapper with ARIA labels
// Ensures screen readers can understand form validation and errors

'use client';

import { ReactNode } from 'react';

interface AccessibleInputProps {
  id: string;
  label: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaDescribedBy?: string;
}

export function AccessibleInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  placeholder,
  disabled = false,
  ariaDescribedBy,
}: AccessibleInputProps) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = [
    ariaDescribedBy,
    error ? errorId : null,
  ].filter(Boolean).join(' ');

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span
            aria-label="required"
            className="ml-1 text-red-600"
            title="This field is required"
          >
            *
          </span>
        )}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={`w-full rounded-lg border px-4 py-2 font-medium transition-colors ${
          error
            ? 'border-red-500 bg-red-50 text-slate-900 focus:ring-red-500'
            : 'border-slate-200 bg-white text-slate-900 focus:ring-sky-500'
        } focus:border-transparent focus:outline-none focus:ring-2`}
      />

      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-1 text-sm font-medium text-red-600"
        >
          ❌ {error}
        </div>
      )}
    </div>
  );
}

interface AccessibleSelectProps {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function AccessibleSelect({
  id,
  label,
  options,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: AccessibleSelectProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span
            aria-label="required"
            className="ml-1 text-red-600"
            title="This field is required"
          >
            *
          </span>
        )}
      </label>

      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border px-4 py-2 font-medium transition-colors ${
          error
            ? 'border-red-500 bg-red-50 text-slate-900 focus:ring-red-500'
            : 'border-slate-200 bg-white text-slate-900 focus:ring-sky-500'
        } focus:border-transparent focus:outline-none focus:ring-2`}
      >
        <option value="">-- Select --</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-1 text-sm font-medium text-red-600"
        >
          ❌ {error}
        </div>
      )}
    </div>
  );
}

interface AccessibleCheckboxProps {
  id: string;
  label: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  description?: string;
  disabled?: boolean;
}

export function AccessibleCheckbox({
  id,
  label,
  checked = false,
  onChange,
  description,
  disabled = false,
}: AccessibleCheckboxProps) {
  const descriptionId = `${id}-description`;

  return (
    <div className="flex items-start space-x-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-2 focus:ring-sky-500"
      />

      <div>
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-900"
        >
          {label}
        </label>
        {description && (
          <p
            id={descriptionId}
            className="mt-1 text-sm text-slate-600"
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

interface AccessibleFormErrorProps {
  title: string;
  message: string;
  errors: string[];
}

export function AccessibleFormError({
  title,
  message,
  errors,
}: AccessibleFormErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border-2 border-red-500 bg-red-50 p-4"
    >
      <h3 className="font-semibold text-red-900">{title}</h3>
      <p className="mt-1 text-sm text-red-700">{message}</p>

      {errors.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {errors.map((error, index) => (
            <li key={index} className="text-sm text-red-700">
              {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AccessibleFormProps {
  title: string;
  description?: string;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  submitLabel?: string;
  isLoading?: boolean;
}

export function AccessibleForm({
  title,
  description,
  onSubmit,
  children,
  submitLabel = 'Submit',
  isLoading = false,
}: AccessibleFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-2 text-slate-600">{description}</p>
        )}
      </div>

      {children}

      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className="w-full rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing...' : submitLabel}
      </button>
    </form>
  );
}

import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className = '', ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const showError = Boolean(error);
  const showHint = !showError && Boolean(hint);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label ? (
        <label htmlFor={inputId} className="label-terminal">
          <span className="text-retro-cyan mr-1">{'>'}</span>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={`input-terminal ${className}`}
        aria-invalid={showError}
        aria-describedby={
          showError ? `${inputId}-err` : showHint ? `${inputId}-hint` : undefined
        }
        {...rest}
      />
      {showError ? (
        <span
          id={`${inputId}-err`}
          className="font-mono text-xs text-retro-magenta"
        >
          ! {error}
        </span>
      ) : showHint ? (
        <span
          id={`${inputId}-hint`}
          className="font-mono text-xs text-retro-muted"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
});

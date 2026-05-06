import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, hint, error, id, className = '', ...rest }, ref) {
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
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          className={`input-terminal resize-y min-h-[4.5rem] ${className}`}
          aria-invalid={showError}
          {...rest}
        />
        {showError ? (
          <span className="font-mono text-xs text-retro-magenta">! {error}</span>
        ) : showHint ? (
          <span className="font-mono text-xs text-retro-muted">{hint}</span>
        ) : null}
      </div>
    );
  },
);

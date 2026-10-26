export function FieldLabel({ htmlFor, children, required, optional }) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
      {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      {optional && <span className="ml-1 font-normal text-fg-subtle">(opcional)</span>}
    </label>
  );
}

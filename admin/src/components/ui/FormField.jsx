/**
 * FormField.jsx — the one form-field system for the admin panel: label +
 * input/select + inline error message, consistent spacing every time.
 */
const FormField = ({ label, error, children, htmlFor }) => (
    <div className="adm-field">
        {label && <label className="adm-field-label" htmlFor={htmlFor}>{label}</label>}
        {children}
        {error && <span className="adm-field-error" role="alert">{error}</span>}
    </div>
);

export const Input = ({ error, className = "", ...rest }) => (
    <input className={`adm-field-input ${error ? "error" : ""} ${className}`} {...rest} />
);

export const Select = ({ error, className = "", children, ...rest }) => (
    <select className={`adm-field-select ${error ? "error" : ""} ${className}`} {...rest}>
        {children}
    </select>
);

export default FormField;

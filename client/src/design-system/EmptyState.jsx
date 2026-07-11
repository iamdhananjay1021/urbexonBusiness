import { FiInbox, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { cn } from "./utils/cn";

/**
 * Signal Design System — EmptyState / ErrorState / SuccessState
 * Consistent pattern: icon in a tinted circle + title + description + optional
 * action, per the approved brand illustration spec (simple line-icon style,
 * not busy stock illustrations — Feather icons ARE that line-art style already).
 */
const StateBase = ({ icon: Icon, iconBg, iconColor, title, description, action, className }) => ( // eslint-disable-line no-unused-vars -- Icon is rendered as <Icon/> below; false positive without eslint-plugin-react's jsx-uses-vars
  <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
    <div className={cn("flex items-center justify-center h-16 w-16 rounded-full mb-4", iconBg)}>
      <Icon className={cn("h-7 w-7", iconColor)} aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-primary font-display mb-1">{title}</h3>
    {description && <p className="text-sm text-secondary max-w-sm mb-5">{description}</p>}
    {action}
  </div>
);

export const EmptyState = ({ title = "Nothing here yet", description, action, icon = FiInbox, className }) => (
  <StateBase
    icon={icon}
    iconBg="bg-[var(--color-graphite-100)]"
    iconColor="text-muted"
    title={title}
    description={description}
    action={action}
    className={className}
  />
);

export const ErrorState = ({
  title = "Something went wrong",
  description = "Please try again, or contact support if the problem continues.",
  action,
  className,
}) => (
  <StateBase
    icon={FiAlertTriangle}
    iconBg="bg-error-tint"
    iconColor="text-[var(--color-error-500)]"
    title={title}
    description={description}
    action={action}
    className={className}
  />
);

export const SuccessState = ({ title = "Success", description, action, className }) => (
  <StateBase
    icon={FiCheckCircle}
    iconBg="bg-success-tint"
    iconColor="text-[var(--color-success-500)]"
    title={title}
    description={description}
    action={action}
    className={className}
  />
);

export default EmptyState;

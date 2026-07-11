import Card, { CardFooter } from "./Card";
import StatusBadge from "./StatusBadge";
import Button from "./Button";
import { cn } from "./utils/cn";

/**
 * Signal Design System — OrderCard
 * Fields match the real Order schema (invoiceNumber, items[], totalAmount,
 * orderStatus, createdAt, orderMode) and the verified status state-machine
 * values from orderController.js. Presentational only — actions passed in
 * as handlers so existing order logic/permissions stay untouched.
 */
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

const OrderCard = ({ order, onClick, actions, className = "" }) => {
  const { invoiceNumber, items = [], totalAmount, orderStatus, createdAt, orderMode } = order;
  const previewItems = items.slice(0, 3);
  const moreCount = items.length - previewItems.length;

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-primary">#{invoiceNumber}</p>
          <p className="text-xs text-secondary mt-0.5">{fmtDate(createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {orderMode === "URBEXON_HOUR" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-on-hour bg-hour-tint px-2 py-0.5 rounded-full">
              Hour
            </span>
          )}
          <StatusBadge status={orderStatus} />
        </div>
      </div>

      <div className="flex -space-x-2 mb-3">
        {previewItems.map((item, i) => (
          <img
            key={i}
            src={item.image || "/placeholder.png"}
            alt={item.name}
            className="h-11 w-11 rounded-[var(--radius-sm)] object-cover border-2 border-surface bg-canvas"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png";
            }}
          />
        ))}
        {moreCount > 0 && (
          <span className="h-11 w-11 rounded-[var(--radius-sm)] border-2 border-surface bg-canvas flex items-center justify-center text-xs font-medium text-secondary">
            +{moreCount}
          </span>
        )}
      </div>

      <CardFooter className={cn(!actions && "border-t-0 mt-2 pt-0")}>
        <span className="text-sm text-secondary">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
        <span className="text-base font-semibold text-primary">₹{Number(totalAmount || 0).toLocaleString("en-IN")}</span>
      </CardFooter>

      {actions && <div className="flex gap-2 mt-3">{actions}</div>}
      {onClick && (
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onClick}>
          View details
        </Button>
      )}
    </Card>
  );
};

export default OrderCard;

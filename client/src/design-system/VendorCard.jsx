import { FiMapPin, FiStar } from "react-icons/fi";
import Card from "./Card";
import Avatar from "./Avatar";
import StatusBadge from "./StatusBadge";
import { cn } from "./utils/cn";

/**
 * Signal Design System — VendorCard
 * Fields match the real Vendor schema from the backend audit (shopName,
 * shopLogo, shopCategory, rating, address.city, status). Presentational only.
 */
const VendorCard = ({ vendor, onClick, showStatus = false, className = "" }) => {
  const { shopName, shopLogo, shopCategory, rating, address, status } = vendor;

  return (
    <Card interactive onClick={onClick} className={cn("flex items-center gap-3.5", className)}>
      <Avatar src={shopLogo} name={shopName} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-primary truncate">{shopName}</p>
          {showStatus && status && <StatusBadge status={status} />}
        </div>
        {shopCategory && <p className="text-xs text-secondary mt-0.5">{shopCategory}</p>}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
          {rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <FiStar className="h-3 w-3 fill-[var(--color-warning-500)] text-[var(--color-warning-500)]" aria-hidden="true" />
              {rating.toFixed(1)}
            </span>
          )}
          {address?.city && (
            <span className="inline-flex items-center gap-1">
              <FiMapPin className="h-3 w-3" aria-hidden="true" />
              {address.city}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default VendorCard;

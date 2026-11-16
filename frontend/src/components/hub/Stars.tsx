import { Star } from "lucide-react";

/** Read-only star row for an average rating, or a picker when onPick is given. */
export function Stars({
  value,
  onPick,
  size = 16,
}: {
  value: number;
  onPick?: (rating: number) => void;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onPick ? "radiogroup" : "img"} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const filled = value >= rating - 0.25;
        const star = (
          <Star
            size={size}
            className={filled ? "fill-orange-400 text-orange-400" : "text-slate-600"}
          />
        );

        return onPick ? (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={Math.round(value) === rating}
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
            onClick={() => onPick(rating)}
            className="p-0.5 transition hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={rating}>{star}</span>
        );
      })}
    </span>
  );
}

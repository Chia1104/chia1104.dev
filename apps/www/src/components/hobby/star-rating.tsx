const STARS = 5;
/** A stored rating runs from 1 to 10, so each point is half a star. */
const POINTS_PER_STAR = 2;

/** A rating out of 10 as five stars. `label` is the same rating in words. */
export const StarRating = ({
  rating,
  label,
}: {
  rating: number;
  label: string;
}) => (
  <span
    role="img"
    aria-label={label}
    className="text-accent flex items-center gap-0.5">
    {Array.from({ length: STARS }, (_, index) => {
      const points = rating - index * POINTS_PER_STAR;
      if (points >= POINTS_PER_STAR) {
        return <span key={index} aria-hidden className="i-mdi-star size-5" />;
      }
      if (points > 0) {
        return (
          <span
            key={index}
            aria-hidden
            className="i-mdi-star-half-full size-5"
          />
        );
      }
      return (
        <span key={index} aria-hidden className="i-mdi-star-outline size-5" />
      );
    })}
  </span>
);

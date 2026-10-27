// Illustration for image-based questions (e.g. shapes, clocks, grids from
// the Primary Maths bank). Rendered inline under the question text.
export function QuestionImage({
  src,
  alt,
  maxHeight = 208,
  className,
}: {
  src: string;
  alt?: string;
  maxHeight?: number;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      style={{ maxHeight }}
      className={
        "mx-auto block h-auto w-auto max-w-full rounded-2xl border border-border/60 bg-white object-contain " +
        (className ?? "")
      }
    />
  );
}

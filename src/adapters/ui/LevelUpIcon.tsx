/**
 * "Move up" / level-up — implies returning to the parent in a hierarchy.
 */
type Props = { className?: string };

export function LevelUpIcon({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M12 5v10M6 9l6-4 6 4" />
      <path d="M5 20h14" strokeLinecap="square" />
    </svg>
  );
}

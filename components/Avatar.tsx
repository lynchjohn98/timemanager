type Props = {
  name?: string | null;
  src?: string | null;
  size?: number;
};

function initials(name?: string | null) {
  if (!name) return "";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Avatar({ name, src, size = 40 }: Props) {
  const style = { width: size, height: size };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Profile picture"}
        style={style}
        className="rounded-full border border-moa-line object-cover"
      />
    );
  }

  return (
    <div
      style={{ ...style, fontSize: size * 0.38 }}
      className="flex items-center justify-center rounded-full border border-moa-text/60 font-medium tracking-wider"
    >
      {initials(name) || (
        // Simple person icon when there's no name
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-1/2 w-1/2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )}
    </div>
  );
}

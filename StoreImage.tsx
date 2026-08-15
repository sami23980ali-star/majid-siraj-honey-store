import { useEffect, useState, type ImgHTMLAttributes } from "react";

/**
 * Brand-toned placeholder for an image that will not load. Inlined as a data URI
 * rather than a file in /public on purpose: the whole point is to survive the
 * case where fetching an image fails, so the fallback itself must never make a
 * request.
 */
const FALLBACK_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice">
    <rect width="160" height="160" fill="#f7ead3"/>
    <g stroke="#e6cd94" stroke-width="1" opacity=".65">
      <path d="M0 40h160M0 80h160M0 120h160M40 0v160M80 0v160M120 0v160"/>
    </g>
    <circle cx="80" cy="82" r="45" fill="#fdf6e6" stroke="#e0c07a" stroke-width="2"/>
    <path d="M80 44c14 18 22 30 22 41a22 22 0 0 1-44 0c0-11 8-23 22-41z" fill="#dcaa4d"/>
    <path d="M71 80c-1 9 3 15 10 18" fill="none" stroke="#fff6e2" stroke-width="4" stroke-linecap="round" opacity=".85"/>
  </svg>`,
)}`;

type StoreImageProps = ImgHTMLAttributes<HTMLImageElement> & { src: string | undefined | null };

/**
 * An <img> that degrades to the placeholder instead of a broken frame.
 *
 * Product imagery is admin-editable and lives behind the storage proxy, so a
 * renamed object, a storage outage, or a mistyped URL in the product editor are
 * all reachable states in production. Without this the storefront showed the
 * browser's broken-image glyph inside an otherwise finished card.
 */
export function StoreImage({ src, alt, onError, ...rest }: StoreImageProps) {
  const [failed, setFailed] = useState(false);
  // A new src deserves a fresh attempt — otherwise switching gallery images after
  // one failure would keep showing the placeholder for every later image.
  useEffect(() => setFailed(false), [src]);
  return (
    <img
      {...rest}
      src={failed || !src ? FALLBACK_IMAGE : src}
      alt={alt}
      onError={event => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

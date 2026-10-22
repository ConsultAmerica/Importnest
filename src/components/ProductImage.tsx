"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  BRAND_FALLBACK_IMAGE,
  getProductDisplayImage,
  productImageAlt,
  productThumbClass,
  subtypeFallbackImage,
  type ProductImageSource,
} from "@/lib/product-images";

export type ProductImageProps = {
  src?: string | null;
  alt?: string;
  category?: string | null;
  subtype?: string | null;
  title?: string | null;
  subtitle?: string | null;
  className?: string;
  frameClassName?: string;
  size?: "card" | "compact" | "result" | "summary" | "fill";
  sizes?: string;
  priority?: boolean;
  product?: ProductImageSource;
};

/**
 * Fallback chain for product cards.
 * Intentionally skips /images/categories/* collages — those reuse one photo
 * across an entire department and caused the “all kitchen cards look the same”
 * bug when next/image fired a spurious onError.
 */
function buildFallbackChain(opts: {
  src?: string | null;
  category?: string | null;
  subtype?: string | null;
  title?: string | null;
  subtitle?: string | null;
  product?: ProductImageSource;
}): string[] {
  const chain: string[] = [];
  const push = (value?: string | null) => {
    const v = value?.trim();
    if (!v || chain.includes(v)) return;
    // Never use department collages as product thumbnails.
    if (v.includes("/images/categories/")) return;
    chain.push(v);
  };

  push(opts.src);
  if (opts.product) push(getProductDisplayImage(opts.product));
  if (opts.subtype && opts.category) {
    push(subtypeFallbackImage(opts.category, null, null, [opts.subtype]));
  }
  push(
    subtypeFallbackImage(
      opts.category ?? undefined,
      opts.title,
      opts.subtitle,
      opts.subtype ? [opts.subtype] : null,
    ),
  );
  push(BRAND_FALLBACK_IMAGE);
  return chain.length > 0 ? chain : [BRAND_FALLBACK_IMAGE];
}

function frameClassFor(size: ProductImageProps["size"]) {
  switch (size) {
    case "compact":
      return "compact-product-image";
    case "result":
      return "result-product-image";
    case "summary":
      return "relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-border bg-transparent sm:h-36 sm:w-36";
    case "fill":
      return "relative h-full w-full overflow-hidden bg-transparent";
    case "card":
    default:
      return "product-card-image";
  }
}

function isLocalStatic(src: string) {
  return src.startsWith("/images/") || src.startsWith("/brand/");
}

/**
 * Product thumbnail with automatic onError fallback:
 * src → subtype → brand mark. Never leaves a broken icon; never swaps in a
 * department collage that would make every card look identical.
 */
export function ProductImage({
  src,
  alt,
  category,
  subtype,
  title,
  subtitle,
  className = "",
  frameClassName = "",
  size = "card",
  sizes = "(max-width:640px) 50vw, (max-width:1280px) 25vw, 20vw",
  priority = false,
  product,
}: ProductImageProps) {
  const chain = useMemo(
    () =>
      buildFallbackChain({
        src,
        category,
        subtype,
        title,
        subtitle,
        product,
      }),
    [src, category, subtype, title, subtitle, product],
  );
  const [index, setIndex] = useState(0);

  // Reset when the intended product image changes (category navigation).
  useEffect(() => {
    setIndex(0);
  }, [src, category, subtype, chain[0]]);

  const current = chain[Math.min(index, chain.length - 1)] ?? BRAND_FALLBACK_IMAGE;
  const resolvedAlt =
    alt?.trim() ||
    productImageAlt({
      title,
      categorySlug: category,
      subtype,
      ...product,
    });

  return (
    <div className={`${frameClassFor(size)} ${frameClassName}`.trim()}>
      <Image
        key={current}
        src={current}
        alt={resolvedAlt}
        fill
        priority={priority}
        sizes={sizes}
        // Local product JPGs: skip optimizer so a transient optimize error
        // cannot cascade into the shared category collage.
        unoptimized={isLocalStatic(current)}
        className={`${productThumbClass(current)} ${className}`.trim()}
        onError={() => {
          setIndex((i) => (i + 1 < chain.length ? i + 1 : i));
        }}
      />
    </div>
  );
}

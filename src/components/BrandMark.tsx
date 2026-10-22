import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: { fullH: 36, icon: 28 },
  md: { fullH: 48, icon: 36 },
  lg: { fullH: 64, icon: 48 },
  xl: { fullH: 96, icon: 72 },
  footer: { fullH: 80, icon: 48 },
} as const;

/** Default footer logo height in px. */
export const FOOTER_LOGO_HEIGHT = 80;

export type BrandLogo = "in" | "nest" | "logo9" | "logo1" | "logo2";
export type BrandLayout = "horizontal" | "stacked" | "header" | "footer";

/** Icon + IMPORTNEST only — transparent PNG (no black plate / tagline). */
const WORDMARK_LOCKUP = {
  src: "/brand/importnest-lockup-wordmark-v3.png",
  aspect: 3.145,
} as const;

/** Same lockup cropped to its visible edges — lets the footer logo sit flush
    with the text and column headings (the padded original sits ~8% inset). */
const WORDMARK_LOCKUP_TRIM = {
  src: "/brand/importnest-lockup-wordmark-v3-trim.png",
  aspect: 5.461,
} as const;

const FOOTER_TRIM_LOGO_HEIGHT = 40;

/**
 * Brand assets:
 * - header / headerDark — Concept B icon + importnest wordmark
 * - footer — separate footer lockup
 */
const ASSETS = {
  logo1: {
    header: "/brand/importnest-header-logo-v5.png",
    headerDark: "/brand/importnest-header-logo-v5-dark.png",
    horizontal: "/brand/importnest-logo-light.png",
    horizontalOnDark: "/brand/importnest-logo-dark.png",
    stacked: "/brand/importnest-logo-dark.png",
    icon: "/brand/importnest-icon.png",
    iconDark: "/brand/importnest-icon-dark.png",
    circle: "/brand/importnest-icon.png",
    circleDark: "/brand/importnest-icon-dark.png",
    headerAspect: 4.14,
    headerDarkAspect: 4.14,
    horizontalAspect: 2.71,
    horizontalOnDarkAspect: 2.71,
    stackedAspect: 2.71,
  },
  logo2: {
    header: "/brand/importnest-header-logo-v5.png",
    headerDark: "/brand/importnest-header-logo-v5-dark.png",
    horizontal: "/brand/importnest-logo-light.png",
    horizontalOnDark: "/brand/importnest-logo-dark.png",
    stacked: "/brand/importnest-logo-light.png",
    icon: "/brand/importnest-icon.png",
    iconDark: "/brand/importnest-icon-dark.png",
    circle: "/brand/importnest-icon.png",
    circleDark: "/brand/importnest-icon-dark.png",
    headerAspect: 4.14,
    headerDarkAspect: 4.14,
    horizontalAspect: 2.71,
    horizontalOnDarkAspect: 2.71,
    stackedAspect: 2.71,
  },
  logo9: {
    header: "/brand/importnest-header-logo-v5.png",
    headerDark: "/brand/importnest-header-logo-v5-dark.png",
    horizontal: "/brand/importnest-logo-light.png",
    horizontalOnDark: "/brand/importnest-logo-dark.png",
    stacked: "/brand/importnest-logo-dark.png",
    icon: "/brand/importnest-icon.png",
    iconDark: "/brand/importnest-icon-dark.png",
    circle: "/brand/importnest-icon.png",
    circleDark: "/brand/importnest-icon-dark.png",
    headerAspect: 4.14,
    headerDarkAspect: 4.14,
    horizontalAspect: 2.71,
    horizontalOnDarkAspect: 2.71,
    stackedAspect: 2.71,
  },
  nest: {
    header: "/brand/importnest-header-logo-v5.png",
    headerDark: "/brand/importnest-header-logo-v5-dark.png",
    horizontal: "/brand/importnest-logo-light.png",
    horizontalOnDark: "/brand/importnest-logo-dark.png",
    stacked: "/brand/importnest-logo-dark.png",
    icon: "/brand/importnest-icon.png",
    iconDark: "/brand/importnest-icon-dark.png",
    circle: "/brand/importnest-icon.png",
    circleDark: "/brand/importnest-icon-dark.png",
    headerAspect: 4.14,
    headerDarkAspect: 4.14,
    horizontalAspect: 2.71,
    horizontalOnDarkAspect: 2.71,
    stackedAspect: 2.71,
  },
  in: {
    header: "/brand/logo8-full-dark.png",
    headerDark: "/brand/logo8-full.png",
    horizontal: "/brand/logo8-full-dark.png",
    stacked: "/brand/logo8-full.png",
    icon: "/brand/logo8-icon.png",
    iconDark: "/brand/logo8-icon-dark.png",
    circle: "/brand/logo8-mark.png",
    circleDark: "/brand/logo8-mark-dark.png",
    headerAspect: 1.55,
    headerDarkAspect: 1.55,
    horizontalAspect: 1.55,
    stackedAspect: 1.55,
  },
} as const;

/** Importnest brand mark — header/footer chrome use BrandLink (wordmark only). */
export function BrandMark({
  logo = "logo9",
  showWordmark = true,
  size = "md",
  onDark = false,
  layout = "horizontal",
  height,
  className = "",
}: {
  logo?: BrandLogo;
  variant?: "onDark" | "onLight";
  showWordmark?: boolean;
  size?: keyof typeof SIZES;
  height?: number;
  onDark?: boolean;
  layout?: BrandLayout;
  className?: string;
}) {
  const dims = SIZES[size];
  const fullH = height ?? dims.fullH;
  const asset = ASSETS[logo];

  if (showWordmark) {
    let src: string;
    let aspect: number;
    if (layout === "footer" || layout === "header") {
      src = WORDMARK_LOCKUP.src;
      aspect = WORDMARK_LOCKUP.aspect;
    } else if (onDark && "horizontalOnDark" in asset) {
      src = asset.horizontalOnDark;
      aspect =
        "horizontalOnDarkAspect" in asset ? asset.horizontalOnDarkAspect : 2.71;
    } else if (layout === "stacked") {
      src = asset.stacked;
      aspect = asset.stackedAspect;
    } else {
      src = asset.horizontal;
      aspect = asset.horizontalAspect;
    }
    const fullW = Math.round(fullH * aspect);

    return (
      <span className={`inline-flex items-center leading-none overflow-visible ${className}`.trim()}>
        <Image
          src={src}
          alt="Importnest"
          width={fullW}
          height={fullH}
          className="h-auto w-auto object-contain object-left"
          style={{
            height: "auto",
            width: "auto",
            maxHeight: fullH,
            maxWidth: "100%",
          }}
          priority={size === "md" || size === "lg" || size === "xl" || size === "footer"}
          quality={100}
        />
      </span>
    );
  }

  const iconSrc = onDark ? asset.iconDark : asset.icon;
  const iconH = height ?? dims.icon;
  const iconAspect = 1.13;

  return (
    <span className={`inline-flex leading-none ${className}`.trim()}>
      <Image
        src={iconSrc}
        alt="Importnest"
        width={Math.round(iconH * iconAspect)}
        height={iconH}
        className="object-contain"
        style={{ height: iconH, width: "auto" }}
        priority
        quality={100}
      />
    </span>
  );
}

/** Header logo height — larger wordmark, no subtitle. */
export const HEADER_LOGO_HEIGHT = 72;

/**
 * Header/footer home link — wordmark only (no tagline under the logo).
 */
export function BrandLink({
  className = "",
  logo = "logo9",
  onDark = false,
  size = "header",
}: {
  variant?: "onDark" | "onLight";
  className?: string;
  onDark?: boolean;
  logo?: BrandLogo;
  size?: "header" | "footer";
}) {
  void logo;
  void onDark;
  const lockup = size === "footer" ? WORDMARK_LOCKUP_TRIM : WORDMARK_LOCKUP;
  const height = size === "footer" ? FOOTER_TRIM_LOGO_HEIGHT : HEADER_LOGO_HEIGHT;
  const width = Math.round(height * lockup.aspect);

  return (
    <Link
      href="/"
      className={`header-logo brand-logo transition hover:opacity-90 ${className}`}
      aria-label="Importnest home"
    >
      <Image
        src={lockup.src}
        alt="Importnest"
        width={width}
        height={height}
        className={size === "footer" ? "footer-logo-trim" : "header-logo-img"}
        priority
        quality={100}
        style={{ background: "transparent" }}
      />
    </Link>
  );
}

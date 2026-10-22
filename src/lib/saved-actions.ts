"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrCreateAppUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUser(redirectTo: string) {
  const user = await getOrCreateAppUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  return user;
}

export async function saveProductAction(canonicalProductId: string, redirectTo: string) {
  const user = await requireUser(redirectTo);
  await prisma.savedProduct.upsert({
    where: { userId_canonicalProductId: { userId: user.id, canonicalProductId } },
    update: {},
    create: { userId: user.id, canonicalProductId },
  });
  revalidatePath(redirectTo);
  revalidatePath("/");
  revalidatePath("/search/results");
  revalidatePath("/saved");
}

export async function unsaveProductAction(canonicalProductId: string, redirectTo: string) {
  const user = await requireUser(redirectTo);
  await prisma.savedProduct.deleteMany({ where: { userId: user.id, canonicalProductId } });
  revalidatePath(redirectTo);
  revalidatePath("/");
  revalidatePath("/search/results");
  revalidatePath("/saved");
}

/** Positive, finite prices only — a malformed or negative threshold is silently rejected rather than stored. */
export async function setPriceAlertAction(canonicalProductId: string, redirectTo: string, formData: FormData) {
  const user = await requireUser(redirectTo);
  const mode = String(formData.get("mode") ?? "dollar");

  let threshold: string | null = null;
  if (mode === "percent") {
    const percent = Number(formData.get("percent"));
    const baseline = Number(formData.get("baseline"));
    if (
      Number.isFinite(percent) &&
      percent > 0 &&
      percent < 100 &&
      Number.isFinite(baseline) &&
      baseline > 0
    ) {
      // Round baseline to cents so the encoding stays tidy.
      threshold = `pct:${percent}@${Math.round(baseline * 100) / 100}`;
    }
  } else {
    const amount = Number(formData.get("threshold"));
    if (Number.isFinite(amount) && amount > 0) {
      threshold = String(amount);
    }
  }

  if (threshold == null) {
    revalidatePath(redirectTo);
    return;
  }

  await prisma.alert.upsert({
    where: {
      userId_canonicalProductId_type: { userId: user.id, canonicalProductId, type: "price-drop" },
    },
    update: { threshold, isActive: true },
    create: {
      userId: user.id,
      canonicalProductId,
      type: "price-drop",
      threshold,
      isActive: true,
    },
  });
  revalidatePath(redirectTo);
  revalidatePath("/saved");
}

export type QuickAlertResult =
  | { ok: true; target: number }
  | { ok: false; reason: "auth" | "invalid" };

/**
 * One-tap price alert from a product card's bottom sheet. Unlike
 * setPriceAlertAction it never redirects — the sheet stays on the results page
 * and shows its own success / sign-in state. Also saves the product so the alert
 * appears under Saved & alerts.
 */
export async function quickPriceAlertAction(
  canonicalProductId: string,
  target: number,
): Promise<QuickAlertResult> {
  const user = await getOrCreateAppUser();
  if (!user) return { ok: false, reason: "auth" };
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) {
    return { ok: false, reason: "invalid" };
  }
  const rounded = Math.round(target * 100) / 100;

  await prisma.$transaction([
    prisma.savedProduct.upsert({
      where: { userId_canonicalProductId: { userId: user.id, canonicalProductId } },
      update: {},
      create: { userId: user.id, canonicalProductId },
    }),
    prisma.alert.upsert({
      where: {
        userId_canonicalProductId_type: { userId: user.id, canonicalProductId, type: "price-drop" },
      },
      update: { threshold: String(rounded), isActive: true },
      create: {
        userId: user.id,
        canonicalProductId,
        type: "price-drop",
        threshold: String(rounded),
        isActive: true,
      },
    }),
  ]);
  revalidatePath("/saved");
  return { ok: true, target: rounded };
}

export async function removeAlertAction(canonicalProductId: string, alertType: string, redirectTo: string) {
  const user = await requireUser(redirectTo);
  await prisma.alert.deleteMany({ where: { userId: user.id, canonicalProductId, type: alertType } });
  revalidatePath(redirectTo);
  revalidatePath("/saved");
}

export async function toggleAlertActiveAction(
  canonicalProductId: string,
  alertType: string,
  redirectTo: string,
) {
  const user = await requireUser(redirectTo);
  const alert = await prisma.alert.findUnique({
    where: {
      userId_canonicalProductId_type: { userId: user.id, canonicalProductId, type: alertType },
    },
  });
  if (!alert) return;

  await prisma.alert.update({ where: { id: alert.id }, data: { isActive: !alert.isActive } });
  revalidatePath(redirectTo);
  revalidatePath("/saved");
}

/** Removes saved product and any alerts for that product from the watchlist. */
export async function deleteWatchlistItemAction(canonicalProductId: string, redirectTo: string) {
  const user = await requireUser(redirectTo);
  await Promise.all([
    prisma.savedProduct.deleteMany({ where: { userId: user.id, canonicalProductId } }),
    prisma.alert.deleteMany({ where: { userId: user.id, canonicalProductId } }),
  ]);
  revalidatePath(redirectTo);
  revalidatePath("/");
  revalidatePath("/search/results");
  revalidatePath("/saved");
}

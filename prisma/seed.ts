import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.recommendationFactor.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.matchReview.deleteMany();
  await prisma.productMatch.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.outboundReferral.deleteMany();
  await prisma.sponsoredPlacement.deleteMany();
  await prisma.sponsoredCampaign.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.savedProduct.deleteMany();
  await prisma.searchClarification.deleteMany();
  await prisma.searchSession.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.productIdentifier.deleteMany();
  await prisma.canonicalProduct.deleteMany();
  await prisma.source.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.rankingConfig.deleteMany();
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

type ListingSeed = {
  id: string;
  sourceId: string;
  condition: string;
  price: number;
  shipping?: number;
  fees?: number;
  deliveryLabel: string;
  freshnessMinutesAgo: number;
  matchConfidence: number;
  matchType?: string;
  matchStatus?: string;
  sellerName?: string;
  url?: string;
};

async function seedListings(productId: string, defs: ListingSeed[]) {
  for (const def of defs) {
    await prisma.listing.create({
      data: {
        id: def.id,
        sourceId: def.sourceId,
        canonicalProductId: productId,
        condition: def.condition,
        price: def.price,
        shipping: def.shipping ?? 0,
        fees: def.fees ?? 0,
        deliveryLabel: def.deliveryLabel,
        sellerName: def.sellerName,
        // No real retailer integration exists in this demo — leave url unset
        // rather than fabricate a link, so "Continue to retailer" / "View
        // retailer offer" correctly stay hidden per listing.url ? ... : null.
        url: def.url ?? null,
        freshnessCapturedAt: minutesAgo(def.freshnessMinutesAgo),
      },
    });

    await prisma.productMatch.create({
      data: {
        id: `match-${def.id}`,
        canonicalProductId: productId,
        listingId: def.id,
        type: def.matchType ?? "exact",
        confidence: def.matchConfidence,
        status: def.matchStatus ?? "approved",
      },
    });

    // Two prior days at a higher Total Known Cost so cards can show a real
    // price-drop / historical-low badge from PriceHistory — never invent it.
    if ((def.matchStatus ?? "approved") === "approved") {
      const ship = def.shipping ?? 0;
      await prisma.priceHistory.createMany({
        data: [
          {
            listingId: def.id,
            price: def.price * 1.12,
            shipping: ship,
            capturedAt: minutesAgo(60 * 24 * 14),
          },
          {
            listingId: def.id,
            price: def.price * 1.05,
            shipping: ship,
            capturedAt: minutesAgo(60 * 24 * 3),
          },
          {
            listingId: def.id,
            price: def.price,
            shipping: ship,
            capturedAt: minutesAgo(def.freshnessMinutesAgo),
          },
        ],
      });
    }
  }
}

async function main() {
  await clearDatabase();

  const brandApex = await prisma.brand.create({
    data: {
      id: "brand-apex",
      name: "Apex Home",
      slug: "apex-home",
      isAuthorized: true,
    },
  });

  const brandStride = await prisma.brand.create({
    data: {
      id: "brand-stride",
      name: "Stride",
      slug: "stride",
      isAuthorized: true,
    },
  });

  const brandAura = await prisma.brand.create({
    data: {
      id: "brand-aura",
      name: "Aura Pure",
      slug: "aura-pure",
      isAuthorized: true,
    },
  });

  const category = await prisma.category.create({
    data: {
      id: "cat-appliances",
      name: "Appliances",
      slug: "appliances",
    },
  });

  const extraCategories = [
    { id: "cat-electronics", name: "Electronics", slug: "electronics" },
    { id: "cat-footwear", name: "Footwear", slug: "footwear" },
    { id: "cat-home", name: "Home", slug: "home" },
    { id: "cat-beauty-devices", name: "Beauty Devices", slug: "beauty-devices" },
    { id: "cat-accessories", name: "Accessories", slug: "accessories" },
  ];
  for (const c of extraCategories) {
    await prisma.category.create({ data: c });
  }

  const categoryBySlug: Record<string, string> = {
    appliances: category.id,
    electronics: "cat-electronics",
    footwear: "cat-footwear",
    home: "cat-home",
    "beauty-devices": "cat-beauty-devices",
    accessories: "cat-accessories",
  };

  const product = await prisma.canonicalProduct.create({
    data: {
      id: "cp-apex-ah4200",
      brandId: brandApex.id,
      categoryId: category.id,
      modelName: "Apex Home Quiet Dishwasher",
      modelNumber: "AH-4200",
      configuration: "Standard, Matte Black",
      averageRating: 4.6,
      ratingCount: 312,
      identifiers: {
        create: [
          { type: "UPC", value: "012345678905" },
          { type: "MPN", value: "AH-4200" },
        ],
      },
      attributes: {
        create: [
          { key: "Noise level", value: "42", unit: "dB" },
          { key: "Capacity", value: "14", unit: "place settings" },
          { key: "Color", value: "Matte black" },
        ],
      },
    },
  });

  const airPurifier = await prisma.canonicalProduct.create({
    data: {
      id: "cp-air-purifier",
      brandId: brandAura.id,
      categoryId: categoryBySlug.home,
      modelName: "Aura Pure HEPA Air Purifier",
      modelNumber: "AP-900",
      configuration: "Large room, White",
      averageRating: 4.7,
      ratingCount: 189,
      identifiers: {
        create: [
          { type: "UPC", value: "012345678912" },
          { type: "MPN", value: "AP-900" },
        ],
      },
      attributes: {
        create: [
          { key: "Coverage", value: "900", unit: "sq ft" },
          { key: "Filter", value: "True HEPA" },
        ],
      },
    },
  });

  const runningShoe = await prisma.canonicalProduct.create({
    data: {
      id: "cp-running-shoe",
      brandId: brandStride.id,
      categoryId: categoryBySlug.footwear,
      modelName: "Stride Velocity Run",
      modelNumber: "SV-9",
      configuration: "Size 9, Black/White",
      averageRating: 4.8,
      ratingCount: 540,
      identifiers: {
        create: [
          { type: "UPC", value: "012345678929" },
          { type: "MPN", value: "SV-9" },
        ],
      },
      attributes: {
        create: [
          { key: "Size", value: "9" },
          { key: "Cushioning", value: "Max" },
        ],
      },
    },
  });

  const cordlessVacuum = await prisma.canonicalProduct.create({
    data: {
      id: "cp-cordless-vacuum",
      brandId: brandApex.id,
      categoryId: category.id,
      modelName: "Apex Home Cordless Stick Vacuum",
      modelNumber: "CV-210",
      configuration: "Standard, Graphite",
      averageRating: 4.4,
      ratingCount: 97,
      identifiers: {
        create: [
          { type: "UPC", value: "012345678936" },
          { type: "MPN", value: "CV-210" },
        ],
      },
      attributes: {
        create: [
          { key: "Runtime", value: "45", unit: "min" },
          { key: "Weight", value: "5.8", unit: "lb" },
        ],
      },
    },
  });

  const sources = [
    { id: "src-official", name: "Official Brand Store", sourceType: "manufacturer-feed" },
    { id: "src-retailer-direct", name: "Retailer Direct", sourceType: "affiliate-feed" },
    { id: "src-local-electronics", name: "Local Electronics", sourceType: "partner-feed" },
    { id: "src-authorized-outlet", name: "Authorized Outlet", sourceType: "licensed-provider" },
    { id: "src-discount-home", name: "Discount Home Supply", sourceType: "web-extraction" },
    { id: "src-amazon", name: "Amazon", sourceType: "affiliate-feed" },
    { id: "src-idealo", name: "Idealo", sourceType: "licensed-provider" },
    { id: "src-google-shopping", name: "Google Shopping", sourceType: "affiliate-feed" },
    {
      id: "src-ebay",
      name: "eBay",
      sourceType: "affiliate-feed",
      licensingNotes:
        "eBay Browse API via the eBay Partner Network. Outbound links must use itemAffiliateWebUrl when a campaign id is configured.",
    },
  ];
  for (const source of sources) {
    await prisma.source.create({ data: { ...source, isActive: true } });
  }

  const dishwasherListings: ListingSeed[] = [
    {
      id: "listing-official",
      sourceId: "src-official",
      condition: "new",
      price: 899.0,
      deliveryLabel: "Thu, free",
      freshnessMinutesAgo: 4,
      matchConfidence: 0.98,
    },
    {
      id: "listing-retailer-direct",
      sourceId: "src-retailer-direct",
      condition: "new",
      price: 879.99,
      deliveryLabel: "Tomorrow",
      freshnessMinutesAgo: 4,
      matchConfidence: 0.97,
    },
    {
      id: "listing-local-electronics",
      sourceId: "src-local-electronics",
      condition: "open-box",
      price: 842.0,
      deliveryLabel: "Pickup today",
      freshnessMinutesAgo: 4,
      matchConfidence: 0.95,
    },
    {
      id: "listing-authorized-outlet",
      sourceId: "src-authorized-outlet",
      condition: "certified-refurbished",
      price: 799.0,
      deliveryLabel: "3-5 days",
      freshnessMinutesAgo: 22,
      matchConfidence: 0.93,
    },
    {
      id: "listing-discount-home",
      sourceId: "src-discount-home",
      condition: "new",
      price: 769.0,
      shipping: 29.0,
      deliveryLabel: "5-7 days",
      freshnessMinutesAgo: 35,
      matchConfidence: 0.62,
      matchStatus: "pending",
    },
    {
      id: "listing-amazon-ah4200",
      sourceId: "src-amazon",
      condition: "new",
      price: 884.99,
      deliveryLabel: "Tomorrow",
      freshnessMinutesAgo: 3,
      matchConfidence: 0.96,
      sellerName: "Amazon.com",
    },
    {
      id: "listing-idealo-ah4200",
      sourceId: "src-idealo",
      condition: "new",
      price: 858.0,
      shipping: 12.99,
      deliveryLabel: "2-4 days",
      freshnessMinutesAgo: 8,
      matchConfidence: 0.94,
      sellerName: "HomeMarket DE",
    },
    {
      id: "listing-google-ah4200",
      sourceId: "src-google-shopping",
      condition: "new",
      price: 869.5,
      deliveryLabel: "Fri, free",
      freshnessMinutesAgo: 6,
      matchConfidence: 0.95,
      sellerName: "Best Appliance Hub",
    },
  ];

  const airPurifierListings: ListingSeed[] = [
    {
      id: "listing-amazon-ap900",
      sourceId: "src-amazon",
      condition: "new",
      price: 239.0,
      deliveryLabel: "Tomorrow",
      freshnessMinutesAgo: 5,
      matchConfidence: 0.97,
      sellerName: "Amazon.com",
    },
    {
      id: "listing-idealo-ap900",
      sourceId: "src-idealo",
      condition: "new",
      price: 229.99,
      shipping: 4.99,
      deliveryLabel: "3-5 days",
      freshnessMinutesAgo: 12,
      matchConfidence: 0.94,
      sellerName: "CleanAir Shop",
    },
    {
      id: "listing-google-ap900",
      sourceId: "src-google-shopping",
      condition: "new",
      price: 234.5,
      deliveryLabel: "Thu, free",
      freshnessMinutesAgo: 7,
      matchConfidence: 0.95,
      sellerName: "Home Wellness Co",
    },
    {
      id: "listing-retailer-ap900",
      sourceId: "src-retailer-direct",
      condition: "new",
      price: 249.0,
      deliveryLabel: "2 days",
      freshnessMinutesAgo: 10,
      matchConfidence: 0.96,
    },
    {
      id: "listing-official-ap900",
      sourceId: "src-official",
      condition: "new",
      price: 259.0,
      deliveryLabel: "Thu, free",
      freshnessMinutesAgo: 9,
      matchConfidence: 0.98,
    },
  ];

  const shoeListings: ListingSeed[] = [
    {
      id: "listing-amazon-sv9",
      sourceId: "src-amazon",
      condition: "new",
      price: 129.0,
      deliveryLabel: "Tomorrow",
      freshnessMinutesAgo: 2,
      matchConfidence: 0.97,
      sellerName: "Amazon.com",
    },
    {
      id: "listing-idealo-sv9",
      sourceId: "src-idealo",
      condition: "new",
      price: 119.95,
      shipping: 5.5,
      deliveryLabel: "2-3 days",
      freshnessMinutesAgo: 11,
      matchConfidence: 0.93,
      sellerName: "RunHouse EU",
    },
    {
      id: "listing-google-sv9",
      sourceId: "src-google-shopping",
      condition: "new",
      price: 124.0,
      deliveryLabel: "Fri, free",
      freshnessMinutesAgo: 4,
      matchConfidence: 0.95,
      sellerName: "SportLane",
    },
    {
      id: "listing-outlet-sv9",
      sourceId: "src-authorized-outlet",
      condition: "open-box",
      price: 99.0,
      deliveryLabel: "3-5 days",
      freshnessMinutesAgo: 20,
      matchConfidence: 0.91,
    },
    {
      id: "listing-retailer-sv9",
      sourceId: "src-retailer-direct",
      condition: "new",
      price: 134.0,
      deliveryLabel: "Tomorrow",
      freshnessMinutesAgo: 6,
      matchConfidence: 0.96,
    },
  ];

  const vacuumListings: ListingSeed[] = [
    {
      id: "listing-amazon-cv210",
      sourceId: "src-amazon",
      condition: "new",
      price: 279.0,
      deliveryLabel: "Tomorrow",
      freshnessMinutesAgo: 3,
      matchConfidence: 0.97,
      sellerName: "Amazon.com",
    },
    {
      id: "listing-idealo-cv210",
      sourceId: "src-idealo",
      condition: "new",
      price: 268.0,
      shipping: 9.99,
      deliveryLabel: "3-4 days",
      freshnessMinutesAgo: 14,
      matchConfidence: 0.94,
      sellerName: "VacuumWorld",
    },
    {
      id: "listing-google-cv210",
      sourceId: "src-google-shopping",
      condition: "new",
      price: 274.5,
      deliveryLabel: "Thu, free",
      freshnessMinutesAgo: 5,
      matchConfidence: 0.95,
      sellerName: "FloorCare Direct",
    },
    {
      id: "listing-local-cv210",
      sourceId: "src-local-electronics",
      condition: "new",
      price: 289.0,
      deliveryLabel: "Pickup today",
      freshnessMinutesAgo: 8,
      matchConfidence: 0.96,
    },
    {
      id: "listing-official-cv210",
      sourceId: "src-official",
      condition: "new",
      price: 299.0,
      deliveryLabel: "Fri, free",
      freshnessMinutesAgo: 7,
      matchConfidence: 0.98,
    },
  ];

  await seedListings(product.id, dishwasherListings);
  await seedListings(airPurifier.id, airPurifierListings);
  await seedListings(runningShoe.id, shoeListings);
  await seedListings(cordlessVacuum.id, vacuumListings);

  const demoUser = await prisma.appUser.create({
    data: {
      id: "user-demo",
      email: "demo@importnest.local",
      authProvider: "local",
      isAdmin: true,
    },
  });

  const session = await prisma.searchSession.create({
    data: {
      id: "session-demo",
      userId: demoUser.id,
      categoryId: category.id,
      query: "Apex Home AH-4200 dishwasher",
      inputType: "model-number",
      status: "open",
    },
  });

  const recommendationDefs = [
    {
      listingId: "listing-official",
      rank: 1,
      label: "Best overall",
      rationale:
        "This option fits your priorities best: new condition from the official brand store, delivery before your requested date, and the strongest warranty and return coverage.",
      factors: [
        {
          label: "New condition from the official brand store",
          detail: "Sold and fulfilled by Apex Home directly.",
          positive: true,
        },
        {
          label: "Delivery before your requested date",
          detail: "Arrives Thursday, free shipping.",
          positive: true,
        },
        {
          label: "Full two-year manufacturer warranty",
          detail: "Longest warranty among compared offers.",
          positive: true,
        },
        {
          label: "Thirty-day return window",
          detail: "Matches your risk tolerance.",
          positive: true,
        },
      ],
    },
    {
      listingId: "listing-idealo-ah4200",
      rank: 2,
      label: "Lowest cost",
      rationale: "Lowest total known cost among new-condition marketplace listings.",
      factors: [
        {
          label: "Lowest listed marketplace price",
          detail: "Idealo aggregates competitive EU retailers.",
          positive: true,
        },
        {
          label: "Paid shipping",
          detail: "$12.99 shipping adds to total cost.",
          positive: false,
        },
      ],
    },
    {
      listingId: "listing-amazon-ah4200",
      rank: 3,
      label: "Fastest delivery",
      rationale: "Next-day delivery with strong marketplace fulfillment reliability.",
      factors: [
        { label: "Tomorrow delivery", detail: "Fast Prime-style shipping window.", positive: true },
        {
          label: "Marketplace seller terms",
          detail: "Return and warranty terms follow Amazon listing rules.",
          positive: false,
        },
      ],
    },
    {
      listingId: "listing-local-electronics",
      rank: 4,
      label: "Fastest pickup",
      rationale: "Available for pickup today; fastest way to receive the product.",
      factors: [
        { label: "Pickup today", detail: "Ready for same-day collection.", positive: true },
        {
          label: "Open-box condition",
          detail: "Not new; inspect before purchase.",
          positive: false,
        },
      ],
    },
  ];

  for (const rec of recommendationDefs) {
    await prisma.recommendation.create({
      data: {
        searchSessionId: session.id,
        listingId: rec.listingId,
        canonicalProductId: product.id,
        rank: rec.rank,
        label: rec.label,
        rationale: rec.rationale,
        factors: { create: rec.factors },
      },
    });
  }

  const savedDefs = [
    {
      productId: "cp-air-purifier",
      alertType: "price-drop",
      threshold: "≤ $250",
      isActive: true,
    },
    {
      productId: "cp-running-shoe",
      alertType: "back-in-stock",
      threshold: "Back in stock",
      isActive: true,
    },
    {
      productId: "cp-cordless-vacuum",
      alertType: "any-change",
      threshold: "Any price drop",
      isActive: true,
    },
  ];

  for (const saved of savedDefs) {
    await prisma.savedProduct.create({
      data: {
        userId: demoUser.id,
        canonicalProductId: saved.productId,
      },
    });
    await prisma.alert.create({
      data: {
        userId: demoUser.id,
        canonicalProductId: saved.productId,
        type: saved.alertType,
        threshold: saved.threshold,
        isActive: saved.isActive,
      },
    });
  }

  await prisma.matchReview.create({
    data: {
      id: "review-1",
      productMatchId: "match-listing-discount-home",
      reviewerId: demoUser.id,
      decision: "mark-comparable",
      conflicts: JSON.stringify([
        {
          attribute: "Brand",
          canonicalValue: "Apex Home",
          candidateValue: "Apex Home",
          result: "match",
        },
        {
          attribute: "Model number",
          canonicalValue: "AH-4200",
          candidateValue: "AH4200-B",
          result: "review",
        },
        {
          attribute: "UPC / GTIN",
          canonicalValue: "012345678905",
          candidateValue: "Not provided",
          result: "missing",
        },
        {
          attribute: "Colour",
          canonicalValue: "Matte black",
          candidateValue: "Graphite",
          result: "conflict",
        },
        {
          attribute: "Configuration",
          canonicalValue: "Standard",
          candidateValue: "Standard",
          result: "match",
        },
      ]),
      notes: "Candidate from Discount Home Supply below match threshold (0.62 < 0.9).",
    },
  });

  await prisma.rankingConfig.create({
    data: {
      categoryId: category.id,
      version: 1,
      weights: JSON.stringify({
        price: 0.35,
        delivery: 0.25,
        warranty: 0.2,
        returns: 0.2,
      }),
      freshnessThresholdMinutes: 60,
      matchThreshold: 0.9,
    },
  });

  const listingCount =
    dishwasherListings.length +
    airPurifierListings.length +
    shoeListings.length +
    vacuumListings.length;

  console.log("Seed complete:");
  console.log(`  Products: 4 (dishwasher, air purifier, shoe, vacuum)`);
  console.log(`  Sources: ${sources.length} (incl. Amazon, Idealo, Google Shopping)`);
  console.log(`  Listings: ${listingCount}`);
  console.log(`  Recommendations: ${recommendationDefs.length}`);
  console.log(`  Saved products / alerts: ${savedDefs.length}`);
  console.log("  Match review cases: 1");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

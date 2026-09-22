import assert from "node:assert/strict";
import test from "node:test";
import { rerankCheckoutSearch } from "../src/commerce_search.js";
import { searchRequestSchema } from "../src/search_contract.js";

test("keeps the checkout promise while preserving reranker order", async () => {
  const request = searchRequestSchema.parse({
    query: "waterproof trail shoes before Friday",
    customer: {
      customerId: "cus_test",
      recentOrderUpdates: [{ orderId: "ord_old", status: "returned", message: "Needed more wet grip." }],
    },
    checkout: { currency: "USD", destinationPostalCode: "98101", requiredBy: "2026-09-25" },
    products: [
      {
        id: "late-boot",
        title: "Late Alpine Boot",
        description: "Waterproof mountain boot",
        category: "boots",
        fulfillment: { inStock: true, method: "ship", estimatedDeliveryDate: "2026-09-28" },
        receipt: { returnWindowDays: 30, digitalAvailable: true },
      },
      {
        id: "road-shoe",
        title: "Road Shoe",
        description: "Light shoe for pavement",
        category: "running shoes",
        fulfillment: { inStock: true, method: "pickup", estimatedDeliveryDate: "2026-09-22" },
        receipt: { returnWindowDays: 14, digitalAvailable: true },
      },
      {
        id: "trail-shoe",
        title: "Rain Trail Shoe",
        description: "Waterproof shoe with a wet-grip outsole",
        category: "trail running shoes",
        fulfillment: { inStock: true, method: "ship", estimatedDeliveryDate: "2026-09-24" },
        receipt: { returnWindowDays: 30, digitalAvailable: true },
      },
    ],
    limit: 2,
  });

  const seenCandidates: string[] = [];
  const result = await rerankCheckoutSearch(request, async (_query, candidates) => {
    seenCandidates.push(...candidates);
    return [{ index: 1, score: 0.97 }, { index: 0, score: 0.31 }];
  });

  assert.equal(seenCandidates.some((text) => text.includes("Late Alpine Boot")), false);
  assert.deepEqual(result.results.map((product) => product.id), ["trail-shoe", "road-shoe"]);
  assert.equal(result.checkoutState, "ready_for_selection");
  assert.match(result.results[0].customerOrderUpdate, /2026-09-24/);
});

import { rerankCheckoutSearch } from "./commerce_search.js";
import { createInfraiReranker } from "./infrai_reranker.js";
import { searchRequestSchema } from "./search_contract.js";

const request = searchRequestSchema.parse({
  query: "waterproof trail shoes for a rainy weekend",
  customer: {
    customerId: "cus_482",
    recentOrderUpdates: [{
      orderId: "ord_701",
      status: "returned",
      message: "Previous road shoes were returned because the outsole lacked wet grip.",
    }],
  },
  checkout: {
    currency: "USD",
    destinationPostalCode: "98101",
    requiredBy: "2026-10-02",
  },
  products: [
    {
      id: "shoe-ridge-8",
      title: "Ridge 8 GTX",
      description: "Waterproof trail shoe with a lugged wet-weather outsole",
      category: "trail running shoes",
      fulfillment: { inStock: true, method: "ship", estimatedDeliveryDate: "2026-09-29" },
      receipt: { returnWindowDays: 30, digitalAvailable: true },
    },
    {
      id: "shoe-city-2",
      title: "City Runner 2",
      description: "Light road shoe for dry pavement and treadmill sessions",
      category: "road running shoes",
      fulfillment: { inStock: true, method: "pickup", estimatedDeliveryDate: "2026-09-22" },
      receipt: { returnWindowDays: 14, digitalAvailable: true },
    },
    {
      id: "shoe-peak-4",
      title: "Peak Scramble 4",
      description: "Technical waterproof shoe for rocky mountain trails",
      category: "trail running shoes",
      fulfillment: { inStock: true, method: "ship", estimatedDeliveryDate: "2026-10-06" },
      receipt: { returnWindowDays: 30, digitalAvailable: true },
    },
  ],
  limit: 2,
});

const result = await rerankCheckoutSearch(request, createInfraiReranker());
console.log(JSON.stringify(result, null, 2));

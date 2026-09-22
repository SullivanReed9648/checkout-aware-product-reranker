import type { Product, SearchRequest, SearchResponse } from "./search_contract.js";
import type { Reranker } from "./infrai_reranker.js";

function canMeetCheckout(product: Product, requiredBy: string): boolean {
  return product.fulfillment.inStock
    && product.fulfillment.estimatedDeliveryDate <= requiredBy;
}

function candidateText(product: Product, request: SearchRequest): string {
  const lastUpdate = request.customer.recentOrderUpdates.at(-1)?.message ?? "no recent order update";
  return [
    `product: ${product.title}`,
    `description: ${product.description}`,
    `category: ${product.category}`,
    `fulfillment: ${product.fulfillment.method} by ${product.fulfillment.estimatedDeliveryDate}`,
    `receipt: ${product.receipt.returnWindowDays} day return window; digital ${product.receipt.digitalAvailable}`,
    `customer context: ${lastUpdate}`,
  ].join("; ");
}

export async function rerankCheckoutSearch(
  request: SearchRequest,
  rerank: Reranker,
): Promise<SearchResponse> {
  const eligible = request.products.filter((product) => canMeetCheckout(product, request.checkout.requiredBy));
  if (eligible.length === 0) {
    return {
      customerId: request.customer.customerId,
      checkoutState: "no_eligible_products",
      results: [],
    };
  }

  const ranking = await rerank(
    request.query,
    eligible.map((product) => candidateText(product, request)),
    Math.min(request.limit, eligible.length),
  );

  const results = ranking.flatMap(({ index, score }) => {
    const product = eligible[index];
    if (!product) return [];
    return [{
      ...product,
      relevanceScore: score,
      customerOrderUpdate: `${product.title} can be ${product.fulfillment.method === "ship" ? "delivered" : "collected"} by ${product.fulfillment.estimatedDeliveryDate}.`,
    }];
  });

  return {
    customerId: request.customer.customerId,
    checkoutState: results.length > 0 ? "ready_for_selection" : "no_eligible_products",
    results,
  };
}

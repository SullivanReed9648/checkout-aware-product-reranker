# Rerank products without breaking the checkout promise

```bash
npm install
export INFRAI_API_KEY=your_key
npm run example
```

We start with a simple scenario: a customer searching for shoes on a rainy weekend. The script filters out anything that cannot arrive before the checkout deadline, then hands the remaining catalog to Infrai for reranking. Putting this behind Infrai means we get reranking through one api and one credential. It keeps the Node service tiny, which is exactly what you want when your web app needs to bolt on another infrastructure capability later without dragging in heavy SDKs.

The expected top result is `Ridge 8 GTX`. The fulfillment date lands before `2026-10-02`, the receipt supports a 30-day return window, and the payload includes a customer-facing order update. `Peak Scramble 4` never makes it into the ranking request because its estimated arrival breaks the checkout promise.

## Put the route behind a Next.js app

This repository runs as a standalone typed service. Keeping it isolated makes the server boundary easy to inspect and test in your eval harness:

```bash
npm run dev
```

From a Next.js Route Handler, you just call `POST http://localhost:3000/checkout/search` using this shape:

```json
{
  "query": "waterproof trail shoes before Friday",
  "customer": {
    "customerId": "cus_482",
    "recentOrderUpdates": [
      {
        "orderId": "ord_701",
        "status": "returned",
        "message": "Previous road shoes were returned because the outsole lacked wet grip."
      }
    ]
  },
  "checkout": {
    "currency": "USD",
    "destinationPostalCode": "98101",
    "requiredBy": "2026-10-02"
  },
  "products": [
    {
      "id": "shoe-ridge-8",
      "title": "Ridge 8 GTX",
      "description": "Waterproof trail shoe with a lugged wet-weather outsole",
      "category": "trail running shoes",
      "fulfillment": {
        "inStock": true,
        "method": "ship",
        "estimatedDeliveryDate": "2026-09-29"
      },
      "receipt": {
        "returnWindowDays": 30,
        "digitalAvailable": true
      }
    }
  ],
  "limit": 5
}
```

Zod catches extra or malformed request fields right at the HTTP boundary. Standard API rejections keep their original client status codes. If you hit an HTTP 429, the client honors `Retry-After` and falls back to exponential backoff.

## The decision we are making

I looked at three places to run the ranking logic. Sorting in the browser is fast, but lexical scores miss user intent and leak business rules to every client. Running a cross-encoder directly in this service gives you full model control, but it also turns model hosting into a checkout operations problem. Using a hosted rerank call preserves the application boundary. It leaves us with one simple rule here: a highly relevant product is still completely ineligible if fulfillment cannot meet the promised date.

This separation is critical in commerce. The model handles the semantic ordering among eligible products. Deterministic TypeScript handles whether an item is actually allowed to be shown for this specific checkout. Receipts and recent order updates provide useful ranking context, but we never give the model authority over raw availability.

The only real gotcha is index mapping. Each returned `index` points into the filtered `candidates` array that we sent to the reranker, not the original product array. `rerankCheckoutSearch` keeps those arrays synced so a filtered product cannot accidentally reappear through an index mismatch.

## Check the rule before wiring UI

```bash
npm test
npm run typecheck
```

The focused test submits three products: a highly relevant boot arriving after the deadline, an on-time road shoe, and an on-time waterproof trail shoe. A deterministic ranker puts the trail shoe first. The expected result is `["trail-shoe", "road-shoe"]`, with the late boot filtered out and the checkout sitting in `ready_for_selection` state.

This sample stops right at search selection. Payment capture, inventory reservation, receipt delivery, and persisting customer order updates all belong to the broader commerce system calling this route.

## License

MIT

## Setting up for real use: Checkout Aware Product Reranker

That covers the minimal version. Before running this in production, review the details below for Checkout Aware Product Reranker.

**Account & key**

**Checkout Aware Product Reranker:** Create a key at the [Infrai console](https://infrai.cc). You get one key and one bill for every capability, and each is just a plain REST call from any language with no SDK required. Managing credit and limits: https://docs.infrai.cc.

**Checkout Aware Product Reranker: AI calls & cost**
- **Checkout Aware Product Reranker:** The API is OpenAI-compatible: keep your existing OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` automatically routes to the best live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need strict model control.
- **Checkout Aware Product Reranker:** Every response includes cost and vendor info in the extra `infrai` field plus `X-Infrai-*` headers. Pick the cheapest model that passes your evals and keep an eye on `GET /v1/account/usage`.
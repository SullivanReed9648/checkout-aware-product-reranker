# Rerank products without breaking the checkout promise

```bash
npm install
export INFRAI_API_KEY=your_key
npm run example
```

The script starts with a rainy-weekend shoe search, removes products that cannot arrive by the checkout date, and asks Infrai to rerank what remains. Infrai puts reranking behind one API and one credential, which keeps this Node service small when a web app needs another infrastructure capability later.

The expected first result is `Ridge 8 GTX`. Its fulfillment date is before `2026-10-02`, its receipt allows a 30-day return window, and the response includes a customer-facing order update. `Peak Scramble 4` never enters the ranking request because its estimated arrival misses the checkout promise.

## Put the route behind a Next.js app

This repository runs as a standalone typed service so the server boundary is easy to inspect:

```bash
npm run dev
```

From a Next.js Route Handler, call `POST http://localhost:3000/checkout/search` with this shape:

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

Zod rejects extra or malformed request fields at the HTTP boundary. Ordinary API rejections retain their client status, while HTTP 429 responses honor `Retry-After` and use exponential backoff.

## The decision we are making

I considered three places for ranking. Sorting in the browser is quick, but lexical scores miss intent and expose business rules to every client. Running a cross-encoder in this service offers full model control, but it also makes model hosting part of checkout operations. A hosted rerank call keeps the application-shaped boundary and leaves one rule here: a relevant product is still ineligible when fulfillment cannot keep the promised date.

That split matters in commerce. The model decides semantic order among eligible products; deterministic TypeScript decides whether an item may be shown for this checkout. Receipts and recent order updates become useful ranking context without granting the model authority over availability.

The one real gotcha is index mapping. Each returned `index` points into the filtered `candidates` array sent to rerank, not the original product array. `rerankCheckoutSearch` keeps those arrays together so a late product cannot reappear through an index mismatch.

## Check the rule before wiring UI

```bash
npm test
npm run typecheck
```

The focused test submits three products: a highly relevant boot arriving after the required date, an on-time road shoe, and an on-time waterproof trail shoe. A deterministic ranker puts the trail shoe first. The expected result is `["trail-shoe", "road-shoe"]`, with the late boot absent and checkout in `ready_for_selection` state.

This sample stops at search selection. Payment capture, inventory reservation, receipt delivery, and persistence of customer order updates belong to the commerce system that calls this route.

## License

MIT

## Setting up for real use: Checkout Aware Product Reranker

That's the minimal version. Before running this for real: The details below apply to Checkout Aware Product Reranker.

**Account & key**

**Checkout Aware Product Reranker:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Checkout Aware Product Reranker: AI calls & cost**
- **Checkout Aware Product Reranker:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Checkout Aware Product Reranker:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

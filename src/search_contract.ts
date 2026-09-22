import { z } from "zod";

const dateString = z.string().date();

export const productSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  fulfillment: z.object({
    inStock: z.boolean(),
    method: z.enum(["ship", "pickup"]),
    estimatedDeliveryDate: dateString,
  }).strict(),
  receipt: z.object({
    returnWindowDays: z.number().int().nonnegative(),
    digitalAvailable: z.boolean(),
  }).strict(),
}).strict();

export const searchRequestSchema = z.object({
  query: z.string().min(2).max(500),
  customer: z.object({
    customerId: z.string().min(1),
    recentOrderUpdates: z.array(z.object({
      orderId: z.string().min(1),
      status: z.enum(["confirmed", "fulfilled", "delivered", "returned"]),
      message: z.string().min(1),
    }).strict()).max(10),
  }).strict(),
  checkout: z.object({
    currency: z.string().length(3),
    destinationPostalCode: z.string().min(3),
    requiredBy: dateString,
  }).strict(),
  products: z.array(productSchema).min(1).max(100),
  limit: z.number().int().min(1).max(20).default(5),
}).strict();

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type Product = z.infer<typeof productSchema>;

export type RankedProduct = Product & {
  relevanceScore: number;
  customerOrderUpdate: string;
};

export type SearchResponse = {
  customerId: string;
  checkoutState: "ready_for_selection" | "no_eligible_products";
  results: RankedProduct[];
};

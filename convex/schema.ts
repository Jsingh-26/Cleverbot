import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  threads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    updatedAt: v.number(),
    createdAt: v.number(),
  }).index("by_user_updated", ["userId", "updatedAt"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    modelId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_thread_created", ["threadId", "createdAt"]),
});

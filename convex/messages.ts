import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

const titleFromContent = (content: string) => {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
};

export const listMessages = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      return [];
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

export const appendMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    modelId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be signed in to save messages");
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      modelId: args.modelId,
      createdAt: now,
    });

    const patch: { updatedAt: number; title?: string } = { updatedAt: now };
    // Ensure empty title from the first user message.
    if (args.role === "user" && (!thread.title || thread.title.trim() === "")) {
      patch.title = titleFromContent(args.content);
    }
    await ctx.db.patch(args.threadId, patch);

    return messageId;
  },
});

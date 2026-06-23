import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const friendshipsTable = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.requesterId, t.receiverId)]);

export type Friendship = typeof friendshipsTable.$inferSelect;

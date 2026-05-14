import { pgTable, serial, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: text("password"), // stored as plain text per instructions
  role: varchar("role", { length: 20 }).default("user").notNull(),
  otp: varchar("otp", { length: 6 }),
  otp_expiry: timestamp("otp_expiry"),
  is_verified: boolean("is_verified").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const complaints = pgTable("complaints", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  complaint_text: text("complaint_text").notNull(),
  ai_question: text("ai_question"),
  user_answer: text("user_answer"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

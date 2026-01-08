#!/usr/bin/env node
/**
 * Migration: adjust stored receipt timestamps by a fixed offset.
 *
 * Why this exists:
 * Earlier versions of the app shifted Date objects to IST before serializing,
 * then shifted again on the server. That can result in stored timestamps being
 * off by +11 hours (660 minutes).
 *
 * This script is intentionally conservative:
 * - Defaults to dry-run
 * - Requires explicit --apply to persist changes
 * - Supports time-window and source filtering
 *
 * Usage examples:
 *   node scripts/migrate-receipt-dates.js --before 2026-01-08T00:00:00Z
 *   node scripts/migrate-receipt-dates.js --shiftMinutes -660 --before 2026-01-08T00:00:00Z --apply
 *   node scripts/migrate-receipt-dates.js --field both --shiftMinutes -660 --source qr --apply
 */

import mongoose from "mongoose";
import Receipt from "../src/models/Receipt.js";
import { formatISTDateTime } from "../src/utils/timezone.js";

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    const hasValue = next && !next.startsWith("--");
    args[name] = hasValue ? next : true;
    if (hasValue) i += 1;
  }
  return args;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const main = async () => {
  const args = parseArgs(process.argv);

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    // eslint-disable-next-line no-console
    console.error("❌ MONGO_URI environment variable not set");
    process.exit(1);
  }

  const apply = Boolean(args.apply);
  const shiftMinutes = args.shiftMinutes !== undefined ? Number(args.shiftMinutes) : -660;
  if (Number.isNaN(shiftMinutes)) {
    // eslint-disable-next-line no-console
    console.error("❌ --shiftMinutes must be a number");
    process.exit(1);
  }

  const field = String(args.field || "transactionDate");
  const fields = field === "both" ? ["transactionDate", "paidAt"] : [field];
  const supported = new Set(["transactionDate", "paidAt"]);
  for (const f of fields) {
    if (!supported.has(f)) {
      // eslint-disable-next-line no-console
      console.error(`❌ Unsupported --field: ${f} (use transactionDate|paidAt|both)`);
      process.exit(1);
    }
  }

  const before = toDateOrNull(args.before);
  const after = toDateOrNull(args.after);
  const source = args.source ? String(args.source) : null;
  const limit = args.limit !== undefined ? Number(args.limit) : 0;

  if (args.before && !before) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid --before date");
    process.exit(1);
  }
  if (args.after && !after) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid --after date");
    process.exit(1);
  }
  if (args.limit !== undefined && (Number.isNaN(limit) || limit < 0)) {
    // eslint-disable-next-line no-console
    console.error("❌ --limit must be a non-negative number");
    process.exit(1);
  }

  const match = {};
  if (source) match.source = source;
  if (before || after) {
    match.createdAt = {};
    if (after) match.createdAt.$gte = after;
    if (before) match.createdAt.$lt = before;
  }

  // eslint-disable-next-line no-console
  console.log("\n=== Receipt Date Migration ===");
  // eslint-disable-next-line no-console
  console.log("Mode:", apply ? "APPLY (writes)" : "DRY-RUN (no writes)");
  // eslint-disable-next-line no-console
  console.log("Fields:", fields.join(", "));
  // eslint-disable-next-line no-console
  console.log("Shift minutes:", shiftMinutes);
  // eslint-disable-next-line no-console
  console.log("Filter:", JSON.stringify({ source, after: args.after || null, before: args.before || null, limit: limit || null }));

  await mongoose.connect(mongoUri);

  const cursor = Receipt.find(match)
    .sort({ createdAt: 1 })
    .select("transactionDate paidAt createdAt source")
    .cursor();

  let scanned = 0;
  let changed = 0;
  let shown = 0;

  const msDelta = shiftMinutes * 60 * 1000;

  for await (const doc of cursor) {
    scanned += 1;
    if (limit && scanned > limit) break;

    const updates = {};
    let willChange = false;

    for (const f of fields) {
      const current = doc[f];
      if (!current) continue;
      const currentDate = toDateOrNull(current);
      if (!currentDate) continue;
      const nextDate = new Date(currentDate.getTime() + msDelta);
      updates[f] = nextDate;
      willChange = true;
    }

    if (!willChange) continue;

    if (shown < 10) {
      shown += 1;
      // eslint-disable-next-line no-console
      console.log("\n--- Sample ---");
      // eslint-disable-next-line no-console
      console.log("_id:", String(doc._id));
      // eslint-disable-next-line no-console
      console.log("source:", doc.source);
      // eslint-disable-next-line no-console
      console.log("createdAt (UTC):", doc.createdAt?.toISOString?.() || null);
      for (const f of fields) {
        if (!doc[f]) continue;
        // eslint-disable-next-line no-console
        console.log(`${f} old (UTC):`, doc[f]?.toISOString?.() || String(doc[f]));
        // eslint-disable-next-line no-console
        console.log(`${f} old (IST):`, formatISTDateTime(doc[f]));
        // eslint-disable-next-line no-console
        console.log(`${f} new (UTC):`, updates[f].toISOString());
        // eslint-disable-next-line no-console
        console.log(`${f} new (IST):`, formatISTDateTime(updates[f]));
      }
    }

    if (apply) {
      await Receipt.updateOne({ _id: doc._id }, { $set: updates });
    }
    changed += 1;
  }

  // eslint-disable-next-line no-console
  console.log("\n=== Done ===");
  // eslint-disable-next-line no-console
  console.log("Scanned:", scanned);
  // eslint-disable-next-line no-console
  console.log(apply ? "Updated:" : "Would update:", changed);

  await mongoose.disconnect();
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

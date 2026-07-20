import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const connectDB = async (retriesLeft = MAX_RETRIES) => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);

        // Migration: SearchLog used to have a single-field unique index on
        // `term`; search analytics now needs to tell ecommerce and Urbexon
        // Hour searches apart, so it moved to a compound {term, source}
        // unique index (see models/SearchLog.js). Mongoose's autoIndex
        // creates new indexes on boot but never drops conflicting old ones
        // — without this, every upsert for a term that already existed
        // under the old index would still collide with the stale
        // single-field constraint. Safe on every boot: no-ops once the
        // legacy index is gone.
        try {
            await conn.connection.collection("searchlogs").dropIndex("term_1");
            console.log("🔧 [Migration] Dropped legacy SearchLog.term unique index");
        } catch (err) {
            if (err.codeName !== "IndexNotFound") console.warn("[Migration] SearchLog index drop:", err.message);
        }
    } catch (error) {
        console.error(`❌ DB connection failed: ${error.message}`);
        if (retriesLeft > 0) {
            console.warn(`🔁 Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s... (${retriesLeft} attempts left)`);
            setTimeout(() => connectDB(retriesLeft - 1), RETRY_DELAY_MS);
        } else {
            console.error("❌ MongoDB connection failed after all retries. Exiting.");
            process.exit(1);
        }
    }
};

export default connectDB;
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
import mongoose from "mongoose";
import dotenv from "dotenv";
import Pincode from "../models/vendorModels/Pincode.js";

dotenv.config();

// Known geo centers for pincodes already seeded in the DB without coordinates.
// Same source data as backend/controllers/addressController.js LOCAL_PINCODE_COORDS —
// kept as a one-time backfill seed here rather than a permanent second source of truth;
// once a pincode has real coordinates in Mongo, that document IS the source of truth.
const SEED_COORDS = {
    "224122": { lat: 26.4192, lng: 82.5359 },
    "224123": { lat: 26.4300, lng: 82.5500 },
    "224001": { lat: 26.4500, lng: 82.5200 },
    "224181": { lat: 26.3900, lng: 82.5600 },
    "224151": { lat: 26.4700, lng: 82.4500 },
    "224152": { lat: 26.4000, lng: 82.4700 },
    "224161": { lat: 26.3500, lng: 82.5900 },
    "224171": { lat: 26.5000, lng: 82.5700 },
    "224172": { lat: 26.3700, lng: 82.5100 },
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected...");

    const pincodes = await Pincode.find({}).select("code location");
    let updated = 0;
    let skippedHasLocation = 0;
    let skippedNoSeed = 0;

    for (const p of pincodes) {
        if (p.location && Array.isArray(p.location.coordinates) && p.location.coordinates.length === 2) {
            skippedHasLocation += 1;
            continue;
        }
        const seed = SEED_COORDS[p.code];
        if (!seed) {
            skippedNoSeed += 1;
            continue;
        }
        p.location = { type: "Point", coordinates: [seed.lng, seed.lat] };
        await p.save();
        updated += 1;
        console.log(`  ✓ ${p.code} -> [${seed.lng}, ${seed.lat}]`);
    }

    console.log(`\nDone. Updated: ${updated}, already had location: ${skippedHasLocation}, no seed available: ${skippedNoSeed}`);
    await mongoose.disconnect();
    process.exit(0);
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});

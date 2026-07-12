// backend/debugAllRiders.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import DeliveryBoy from "./models/deliveryModels/DeliveryBoy.js";

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const all = await DeliveryBoy.find({}).select("_id userId name city vehicleType isOnline status createdAt").lean();
    console.log(JSON.stringify(all, null, 2));
    await mongoose.disconnect();
};

run().catch(err => { console.error(err); process.exit(1); });
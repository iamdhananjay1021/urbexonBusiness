// backend/fixRiderCounter.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import DeliveryBoy from "./models/deliveryModels/DeliveryBoy.js";

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await DeliveryBoy.findOneAndUpdate(
        { userId: "6a440210b8bb371bbc10bba4" },
        { $set: { activeOrders: 0 } },
        { new: true }
    );
    console.log("Updated activeOrders:", result.activeOrders);
    await mongoose.disconnect();
};

run().catch(err => { console.error(err); process.exit(1); });
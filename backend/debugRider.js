import mongoose from "mongoose";
import dotenv from "dotenv";
import DeliveryBoy from "./models/deliveryModels/DeliveryBoy.js";
import Order from "./models/Order.js";
import { DELIVERY_CONFIG } from "./config/deliveryConfig.js";

dotenv.config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const rider = await DeliveryBoy.findOne({ userId: "6a440210b8bb371bbc10bba4" }).lean();
    console.log("=== RIDER ===");
    console.log(JSON.stringify(rider, null, 2));

    const order = await Order.findById("6a53a4868e6288ef215b3ba3").select("latitude longitude delivery orderStatus orderMode").lean();
    console.log("=== ORDER ===");
    console.log(JSON.stringify(order, null, 2));

    console.log("=== DELIVERY_CONFIG ===");
    console.log("MAX_RADIUS_KM:", DELIVERY_CONFIG.URBEXON_HOUR?.MAX_RADIUS_KM);
    console.log("SHOP_LAT/LNG:", DELIVERY_CONFIG.SHOP_LAT, DELIVERY_CONFIG.SHOP_LNG);

    await mongoose.disconnect();
};

run().catch(err => { console.error(err); process.exit(1); });
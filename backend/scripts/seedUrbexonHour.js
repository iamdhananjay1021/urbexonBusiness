import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Pincode from '../models/vendorModels/Pincode.js';
import Vendor from '../models/vendorModels/Vendor.js';
import Product from '../models/Product.js';

dotenv.config();

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🗄️ Connected to MongoDB');

    // 1. Test Pincode
    const testPincode = await Pincode.findOneAndUpdate(
        { code: '110001' },
        {
            code: '110001',
            status: 'active',
            city: 'New Delhi',
            area: 'Connaught Place',
            state: 'Delhi',
            priority: 10
        },
        { upsert: true, new: true }
    );
    console.log('📍 Pincode 110001:', testPincode._id);

    // 2. Sample Vendor (if not exists)
    let testVendor = await Vendor.findOne({ shopName: 'Test UH Store' });
    if (!testVendor) {
        testVendor = await Vendor.create({
            userId: new mongoose.Types.ObjectId(),
            shopName: 'Test UH Store',
            ownerName: 'Test Vendor',
            email: 'test@uh.com',
            phone: '9999999999',
            status: 'approved',
            subscription: {
                plan: 'premium',
                isActive: true,
                expiryDate: new Date('2025-12-31')
            },
            servicePincodes: ['110001'],
            address: { pincode: '110001', city: 'New Delhi' },
            isOpen: true,
            acceptingOrders: true,
            isDeleted: false
        });
        console.log('🏪 Vendor created:', testVendor._id);
    }
    testVendor.servicePincodes = ['110001'];
    await testVendor.save();

    // 3. Sample UH Products
    await Product.deleteMany({ vendorId: testVendor._id, productType: 'urbexon_hour' });
    const products = await Promise.all([
        Product.create({
            name: 'Fresh Milk 1L',
            slug: 'milk-1l',
            price: 55,
            mrp: 65,
            category: 'Dairy',
            vendorId: testVendor._id,
            productType: 'urbexon_hour',
            images: [{ url: 'https://via.placeholder.com/300x300/FFF5EE/8B4513?text=Milk' }],
            stock: 50,
            inStock: true,
            prepTimeMinutes: 5,
            isActive: true
        }),
        Product.create({
            name: 'Fresh Eggs 6pcs',
            slug: 'eggs-6pcs',
            price: 45,
            mrp: 55,
            category: 'Dairy',
            vendorId: testVendor._id,
            productType: 'urbexon_hour',
            images: [{ url: 'https://via.placeholder.com/300x300/FFFFFF/FF6B6B?text=Eggs' }],
            stock: 30,
            inStock: true,
            prepTimeMinutes: 3,
            isActive: true
        }),
        Product.create({
            name: 'Banana 1kg',
            slug: 'banana-1kg',
            price: 39,
            mrp: 49,
            category: 'Fruits',
            vendorId: testVendor._id,
            productType: 'urbexon_hour',
            images: [{ url: 'https://via.placeholder.com/300x300/FFFFE0/FF8C00?text=Banana' }],
            stock: 100,
            inStock: true,
            prepTimeMinutes: 2,
            isActive: true,
            tag: 'Fresh'
        })
    ]);
    console.log('🛒 Added', products.length, 'UH products');

    // Clear caches
    console.log('🧹 Cache cleared - test 110001 now!');
    console.log('\n🚀 Visit http://localhost:3000/urbexon-hour → Enter 110001');
    console.log('Zepto-style delivery ready! 🎉');

    mongoose.disconnect();
}

seed().catch(console.error);


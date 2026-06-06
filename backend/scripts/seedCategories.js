import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category.js';

dotenv.config();

async function seedCategories() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🗄️ Connected to MongoDB');

        // Default categories for vendors
        const categories = [
            { name: 'Electronics', emoji: '📱', type: 'ecommerce' },
            { name: 'Fashion', emoji: '👕', type: 'ecommerce' },
            { name: 'Home & Kitchen', emoji: '🏠', type: 'ecommerce' },
            { name: 'Beauty & Personal Care', emoji: '💄', type: 'ecommerce' },
            { name: 'Sports & Outdoors', emoji: '⚽', type: 'ecommerce' },
            { name: 'Books & Media', emoji: '📚', type: 'ecommerce' },
            { name: 'Toys & Games', emoji: '🎮', type: 'ecommerce' },
            { name: 'Groceries', emoji: '🛒', type: 'ecommerce' },
            { name: 'Furniture', emoji: '🛋️', type: 'ecommerce' },
            { name: 'Jewelry', emoji: '💎', type: 'ecommerce' },
            { name: 'Dairy', emoji: '🥛', type: 'urbexon_hour' },
            { name: 'Fruits', emoji: '🍎', type: 'urbexon_hour' },
            { name: 'Vegetables', emoji: '🥕', type: 'urbexon_hour' },
            { name: 'Bakery', emoji: '🍞', type: 'urbexon_hour' },
            { name: 'Beverages', emoji: '🧃', type: 'urbexon_hour' },
        ];

        const insertedCategories = [];
        for (const cat of categories) {
            const existing = await Category.findOne({ name: cat.name });
            if (!existing) {
                const newCat = await Category.create({
                    name: cat.name,
                    emoji: cat.emoji,
                    type: cat.type,
                    isActive: true,
                    order: categories.indexOf(cat),
                });
                insertedCategories.push(newCat);
                console.log(`✅ Created category: ${cat.name}`);
            } else {
                console.log(`⏭️ Skipped existing category: ${cat.name}`);
            }
        }

        console.log(`\n🎉 Seeding complete! Added ${insertedCategories.length} new categories`);
        mongoose.disconnect();
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

seedCategories();

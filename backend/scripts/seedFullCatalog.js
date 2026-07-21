/**
 * seedFullCatalog.js — One-shot full catalog seeder
 *
 * Seeds:
 *   - 5 categories for Urbexon Ecommerce + 100 fully-filled products (20 each)
 *   - 5 categories for Urbexon Hour     + 100 fully-filled products (20 each)
 *   - A vendor + serviceable pincode for the Urbexon Hour products
 *
 * Idempotent: re-running deletes previously-seeded products (SKU prefixes
 * "UE-"/"UH-") before re-inserting, so it's safe to run multiple times.
 *
 * Usage: npm run seed:catalog
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Vendor from "../models/vendorModels/Vendor.js";
import Pincode from "../models/vendorModels/Pincode.js";

dotenv.config();

/* ════════════════════════════════════════
   Helpers
════════════════════════════════════════ */
function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
}
function pick(arr, seed, salt = 0) {
    return arr[(seed + salt) % arr.length];
}
function rangeVal(seed, salt, min, max) {
    return min + ((seed + salt * 7) % (max - min + 1));
}
function money(seed, salt, min, max) {
    return rangeVal(seed, salt, min, max);
}
// Clean "avatar-style" placeholder (light neutral card + soft accent-tinted
// circle + a single monogram letter) — inlined as an SVG data URI so no
// external image host is needed. Deliberately carries NO baked-in product
// text: the real name/brand already render as HTML in the card body, so an
// image with its own text just duplicates it and looks cheap/inconsistent
// across a grid (same lesson as the hero banner fix — let the UI own the
// copy, keep the image purely decorative).
function monogramImg(letter, hex, alt) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
        `<rect width="400" height="400" fill="#FAFAFB"/>` +
        `<circle cx="200" cy="200" r="120" fill="${hex}" opacity="0.1"/>` +
        `<circle cx="200" cy="200" r="120" fill="none" stroke="${hex}" stroke-opacity="0.22" stroke-width="2"/>` +
        `<text x="200" y="248" font-family="Arial, Helvetica, sans-serif" font-size="148" font-weight="700" fill="${hex}" text-anchor="middle">${letter}</text>` +
        `</svg>`;
    return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, publicId: "", alt };
}
function guessBrand(name, fallbackPool, seed) {
    const KNOWN = [
        "boAt", "Noise", "Mivi", "JBL", "Zebronics", "Samsung", "Redmi", "Realme", "HP", "Lenovo",
        "Dell", "Logitech", "Ant Esports", "Portronics", "Mi", "Sony", "Amazon Basics", "Ambrane",
        "Mamaearth", "Lakme", "Nivea", "WOW Skin Science", "Himalaya", "Biotique", "Maybelline",
        "Plum", "Dove", "Garnier", "Colorbar", "Park Avenue", "Gillette", "Sugar", "Khadi",
        "Streax", "The Body Shop", "Vega", "Nykaa", "Cosco", "Nivia", "Yonex", "Boldfit", "Strauss",
        "Nike", "Adidas", "SG", "Vector X", "Decathlon", "Cockatoo", "Wildcraft", "Fila", "Quechua",
        "Prestige", "Borosil", "Cello", "Milton", "Philips", "Bajaj", "Wonderchef",
        "Amul", "Mother Dairy", "Nestle", "Britannia", "Go Cheese", "Epigamia", "Modern",
        "Parle-G", "Coca-Cola", "Pepsi", "Sprite", "Real", "Tropicana", "Bisleri", "Paper Boat",
        "Frooti", "Maaza", "Red Bull", "Sting", "Tata", "Bru", "Rooh Afza", "Limca", "Thums Up",
        "Minute Maid",
    ];
    for (const b of KNOWN) {
        if (name.startsWith(b)) return b;
    }
    return fallbackPool.length ? pick(fallbackPool, seed) : "";
}
function trimTo(str, len) {
    return str.length <= len ? str : str.slice(0, len - 1).trimEnd();
}
function eanLike(seed) {
    let s = "8" + String(seed).padStart(11, "0");
    return s.slice(0, 12);
}

/* ════════════════════════════════════════
   Category catalogs (name lists — brand is
   inferred from the leading words of the name)
════════════════════════════════════════ */
const ECOM_CATS = [
    {
        name: "Electronics", code: "ELEC", gst: 18, hsn: "8517",
        subcats: ["Audio", "Mobiles", "Laptops", "Accessories", "Wearables"],
        materials: ["ABS Plastic", "Aluminium", "Polycarbonate", "Metal Alloy"],
        colors: ["Black", "Blue", "Space Grey", "White"],
        bg: "1f2937",
        attrKeys: [["Warranty", "1 Year"], ["Connectivity", "Bluetooth 5.0"], ["Battery Life", "20 Hours"]],
        colorVariants: true,
        items: [
            "boAt Rockerz 450 Wireless Headphones", "Noise ColorFit Pulse Grand Smartwatch",
            "Mivi Duopods A25 TWS Earbuds", "JBL Tune 510BT Headphones",
            "Zebronics Zeb-Thunder Bluetooth Speaker", "Samsung Galaxy M14 5G Smartphone",
            "Redmi 12 5G Smartphone", "Realme Narzo N55 Smartphone",
            "HP 15s Laptop Intel i5 8GB RAM", "Lenovo IdeaPad Slim 3 Laptop",
            "Dell Inspiron 15 Laptop", "Logitech M235 Wireless Mouse",
            "Ant Esports MK1400 Mechanical Keyboard", "Portronics Konnect USB-C Cable",
            "Mi Power Bank 3i 20000mAh", "Sony WH-CH520 Wireless Headphones",
            "Amazon Basics HDMI Cable 2M", "Ambrane 65W Fast Charger",
            "boAt Airdopes 141 TWS Earbuds", "Zebronics Zeb-War Gaming Headset",
        ],
    },
    {
        name: "Fashion", code: "FASH", gst: 5, hsn: "6109",
        subcats: ["Men's Wear", "Women's Wear", "Footwear", "Accessories", "Ethnic Wear"],
        materials: ["Cotton", "Denim", "Georgette", "Leather", "Rayon"],
        colors: ["Navy Blue", "Maroon", "Black", "Beige", "Mustard Yellow"],
        bg: "7c3aed",
        attrKeys: [["Fabric", "Cotton"], ["Fit", "Regular Fit"], ["Wash Care", "Machine Wash"]],
        colorVariants: true,
        hasSizes: true,
        items: [
            "Men's Slim Fit Casual Shirt", "Women's Floral Printed Kurti",
            "Men's Cotton Round Neck T-Shirt", "Women's High Waist Denim Jeans",
            "Men's Regular Fit Formal Trousers", "Women's Anarkali Ethnic Gown",
            "Men's Denim Jacket", "Women's Georgette Saree",
            "Men's Track Pants", "Women's Palazzo Pants Set",
            "Men's Leather Wallet", "Women's Handbag Sling Bag",
            "Men's Analog Wrist Watch", "Women's Oxidized Jhumka Earrings",
            "Men's Casual Sneakers", "Women's Block Heel Sandals",
            "Men's Hooded Sweatshirt", "Women's Cotton Nightwear Set",
            "Men's Formal Leather Shoes", "Women's Silk Dupatta",
        ],
    },
    {
        name: "Home & Kitchen", code: "HOME", gst: 18, hsn: "7323",
        subcats: ["Cookware", "Appliances", "Storage", "Bed & Bath", "Decor"],
        materials: ["Stainless Steel", "Non-Stick Aluminium", "Borosilicate Glass", "Cotton"],
        colors: ["Silver", "Black", "White", "Multicolor"],
        bg: "b45309",
        attrKeys: [["Capacity", "1.5 L"], ["Material", "Stainless Steel"], ["Power", "750 W"]],
        colorVariants: false,
        items: [
            "Non-Stick Frying Pan 26cm", "Stainless Steel Pressure Cooker 5L",
            "Electric Rice Cooker 1.8L", "Prestige Induction Cooktop",
            "Borosil Glass Storage Container Set", "Cello Insulated Water Bottle 1L",
            "Milton Thermosteel Flask 1L", "Philips Mixer Grinder 750W",
            "Bajaj Electric Kettle 1.5L", "Wonderchef Nutri-Blend Blender",
            "Cotton Bedsheet Double Bed Set", "Microfiber Bath Towel Set of 2",
            "LED Table Lamp", "Wooden Wall Clock",
            "Memory Foam Pillow Set of 2", "Curtain Set for Windows 2pc",
            "Kitchen Knife Set Stainless Steel", "Plastic Storage Organizer Box",
            "Non-Electric Manual Hand Blender", "Aluminium Non-Stick Tawa 30cm",
        ],
    },
    {
        name: "Beauty & Personal Care", code: "BEAU", gst: 18, hsn: "3304",
        subcats: ["Skincare", "Makeup", "Haircare", "Fragrance", "Grooming"],
        materials: ["Plastic Bottle", "Glass Bottle", "Tube Packaging"],
        colors: ["N/A"],
        bg: "db2777",
        attrKeys: [["Skin Type", "All Skin Types"], ["Quantity", "100 ml"], ["Fragrance", "Mild"]],
        colorVariants: false,
        items: [
            "Mamaearth Vitamin C Face Wash", "Lakme Absolute Matte Lipstick",
            "Nivea Soft Light Moisturizer Cream", "WOW Skin Science Onion Hair Oil",
            "Himalaya Neem Face Wash", "Biotique Bio Almond Shampoo",
            "Maybelline Fit Me Foundation", "Plum Green Tea Face Serum",
            "Dove Nourishing Body Lotion", "Garnier Bright Complete Sunscreen",
            "Mamaearth Ubtan Face Mask", "Colorbar Kajal Pencil",
            "Park Avenue Deodorant Spray", "Gillette Mach3 Razor",
            "Sugar Matte Attack Lipstick", "Khadi Natural Aloe Vera Gel",
            "Streax Hair Color Cream", "The Body Shop Tea Tree Oil",
            "Vega Hair Straightener Brush", "Nykaa Skinsheen Compact Powder",
        ],
    },
    {
        name: "Sports & Outdoors", code: "SPRT", gst: 12, hsn: "9506",
        subcats: ["Team Sports", "Fitness", "Outdoor Gear", "Footwear", "Accessories"],
        materials: ["Rubber", "Nylon", "Foam", "Synthetic Leather"],
        colors: ["Black", "Red", "Blue", "Green"],
        bg: "047857",
        attrKeys: [["Material", "Synthetic"], ["Size", "Standard"], ["Suitable For", "Outdoor & Indoor"]],
        colorVariants: true,
        items: [
            "Cosco Football Size 5", "Nivia Storm Volleyball",
            "Yonex Badminton Racket Set", "Cosco PVC Basketball Size 7",
            "Boldfit Yoga Mat 6mm", "Strauss Resistance Band Set",
            "Nike Running Shoes Men", "Adidas Sports Socks Pack of 3",
            "SG Cricket Bat Kashmir Willow", "Vector X Skipping Rope",
            "Decathlon Hiking Backpack 30L", "Cockatoo Adjustable Dumbbells Set",
            "Strauss Yoga Block Pair", "Nivia Shin Guards Pair",
            "Wildcraft Sports Water Bottle 750ml", "Fila Sports Cap",
            "Cosco Table Tennis Racket Set", "Vector X Badminton Shuttlecock Pack",
            "Boldfit Gym Gloves", "Quechua Camping Tent 2 Person",
        ],
    },
];

const UH_CATS = [
    {
        name: "Dairy", code: "DAI", gst: 5, hsn: "0401",
        bg: "0284c7", nonReturnable: true,
        attrKeys: [["Fat Content", "Toned"], ["Type", "Pasteurized"]],
        items: [
            "Amul Toned Milk 500ml", "Amul Full Cream Milk 1L", "Mother Dairy Curd 400g",
            "Amul Butter 100g", "Nestle a+ Slim Milk 1L", "Amul Cheese Slices 200g",
            "Mother Dairy Paneer 200g", "Amul Ghee 500ml", "Nestle Everyday Dahi 400g",
            "Amul Masti Buttermilk 200ml", "Britannia Cheese Cube 100g", "Amul Fresh Cream 200ml",
            "Mother Dairy Toned Milk 500ml", "Go Cheese Mozzarella 200g", "Amul Lassi Sweet 200ml",
            "Nestle Milkmaid Condensed Milk 400g", "Mother Dairy Ghee 500ml", "Amul Chocolate Milk 200ml",
            "Epigamia Greek Yogurt 400g", "Mother Dairy Paneer Cubes 500g",
        ],
    },
    {
        name: "Fruits", code: "FRU", gst: 0, hsn: "0803",
        bg: "ca8a04", nonReturnable: true,
        attrKeys: [["Freshness", "Farm Fresh"], ["Origin", "India"]],
        items: [
            "Fresh Banana 1kg", "Royal Gala Apple 1kg", "Fresh Papaya 1pc", "Alphonso Mango 1kg",
            "Seedless Watermelon 1pc", "Fresh Orange 1kg", "Green Grapes Seedless 500g",
            "Pomegranate 1kg", "Kiwi Fruit Pack of 4", "Fresh Pineapple 1pc",
            "Sweet Lime Mosambi 1kg", "Black Grapes 500g", "Fresh Guava 1kg", "Muskmelon 1pc",
            "Strawberry Box 200g", "Fresh Chikoo Sapota 500g", "Dragon Fruit 1pc", "Pear 1kg",
            "Custard Apple 500g", "Fresh Litchi 500g",
        ],
    },
    {
        name: "Vegetables", code: "VEG", gst: 0, hsn: "0701",
        bg: "16a34a", nonReturnable: true,
        attrKeys: [["Freshness", "Farm Fresh"], ["Organic", "No"]],
        items: [
            "Fresh Onion 1kg", "Fresh Potato 1kg", "Fresh Tomato 1kg", "Green Capsicum 500g",
            "Fresh Cauliflower 1pc", "Fresh Cabbage 1pc", "Green Coriander Bunch",
            "Fresh Spinach Bunch Palak", "Cucumber 500g", "Fresh Carrot 500g", "Green Peas 500g",
            "Fresh Ginger 250g", "Garlic 250g", "Fresh Green Chilli 100g", "Lady Finger Bhindi 500g",
            "Fresh Brinjal Baingan 500g", "Beetroot 500g", "Bottle Gourd Lauki 1pc",
            "Green Beans French Beans 500g", "Fresh Mushroom Button 200g",
        ],
    },
    {
        name: "Bakery", code: "BAK", gst: 5, hsn: "1905",
        bg: "b45309", nonReturnable: true,
        attrKeys: [["Eggless", "Yes"], ["Shelf Life", "2 Days"]],
        items: [
            "Britannia Brown Bread 400g", "Modern White Bread 400g", "Britannia Whole Wheat Bread 400g",
            "Fresh Bakery Cupcakes Pack of 4", "Chocolate Croissant Pack of 2",
            "Britannia Bourbon Biscuits 150g", "Parle-G Original Biscuits 200g",
            "Fresh Bakery Donuts Pack of 4", "Sourdough Bread Loaf 400g",
            "Britannia Marie Gold Biscuits 250g", "Multigrain Bread 400g",
            "Fresh Bakery Pav Buns Pack of 6", "Chocolate Muffins Pack of 4", "Britannia Rusk 300g",
            "Garlic Bread Loaf 250g", "Fresh Bakery Cheese Puffs Pack of 4", "Vanilla Cake Slice 150g",
            "Britannia Cream Wafers 75g", "Fresh Bakery Bun Maska Pack of 4",
            "Whole Wheat Khari Biscuits 200g",
        ],
    },
    {
        name: "Beverages", code: "BEV", gst: 12, hsn: "2202",
        bg: "dc2626", nonReturnable: true,
        attrKeys: [["Pack Type", "Bottle"], ["Flavour", "Original"]],
        items: [
            "Coca-Cola 750ml", "Pepsi 750ml", "Sprite 750ml", "Real Fruit Juice Mixed Fruit 1L",
            "Tropicana Orange Juice 1L", "Bisleri Packaged Drinking Water 1L", "Paper Boat Aamras 200ml",
            "Frooti Mango Drink 200ml", "Maaza Mango Drink 600ml", "Red Bull Energy Drink 250ml",
            "Sting Energy Drink 250ml", "Tata Tea Gold 250g", "Nescafe Classic Coffee 50g",
            "Bru Instant Coffee 100g", "Rooh Afza Sherbet 750ml", "Limca 750ml", "Thums Up 750ml",
            "Minute Maid Nimbu Fresh 1L", "Coconut Water Tender 200ml", "Amul Kool Flavoured Milk 200ml",
        ],
    },
];

/* ════════════════════════════════════════
   Builders
════════════════════════════════════════ */
function buildEcomProduct(cat, name, index) {
    const seed = hashSeed(name);
    const brand = guessBrand(name, [cat.name], seed);
    const subcategory = pick(cat.subcats, seed, 1);
    const price = money(seed, 2, 199, 45999);
    const mrp = Math.round(price * (1.15 + (seed % 25) / 100));
    const cost = Math.round(price * 0.6);
    const material = pick(cat.materials, seed, 3);
    const color = pick(cat.colors, seed, 4);
    const isDeal = seed % 6 === 0;
    const isFeatured = seed % 5 === 0;
    const rating = Math.round((3.5 + (seed % 15) / 10) * 10) / 10;
    const numReviews = rangeVal(seed, 5, 0, 320);
    const stockBase = rangeVal(seed, 6, 20, 200);
    const sku = `UE-${cat.code}-${String(index + 1).padStart(3, "0")}`;
    const attrPair1 = pick(cat.attrKeys, seed, 7);
    const attrPair2 = pick(cat.attrKeys, seed, 8);
    const letter = (brand || name).trim().charAt(0).toUpperCase();
    const hex = `#${cat.bg}`;

    const description =
        `${name} by ${brand || "Urbexon"} — a premium ${subcategory.toLowerCase()} pick from our ${cat.name} range. ` +
        `Crafted from ${material.toLowerCase()} for everyday reliability, backed by Urbexon's quality assurance, ` +
        `secure packaging and fast delivery across India.`;

    const doc = {
        name,
        description,
        price,
        mrp,
        cost,
        category: cat.name,
        subcategory,
        brand: brand || cat.name,
        sku,
        tags: [cat.name, subcategory, brand].filter(Boolean),
        weight: `${rangeVal(seed, 9, 100, 2000)} g`,
        color,
        material,
        occasion: cat.name === "Fashion" ? pick(["Casual", "Party", "Formal", "Festive"], seed, 10) : "Everyday",
        origin: seed % 9 === 0 ? "Imported" : "India",
        sizes: cat.hasSizes
            ? ["S", "M", "L", "XL", "XXL"].map((s, i) => ({ size: s, stock: rangeVal(seed, 11 + i, 5, 40) }))
            : [],
        returnPolicy: "7 days return",
        shippingInfo: "Ships in 2-4 business days",
        gstPercent: cat.gst,
        hsn: cat.hsn,
        barcode: eanLike(seed),
        lowStockThreshold: rangeVal(seed, 12, 5, 10),
        seo: {
            metaTitle: trimTo(`${name} | Buy Online at Urbexon`, 120),
            metaDescription: trimTo(description, 200),
        },
        shipping: {
            lengthCm: rangeVal(seed, 13, 10, 45),
            widthCm: rangeVal(seed, 14, 8, 35),
            heightCm: rangeVal(seed, 15, 3, 20),
        },
        isCancellable: true,
        isReturnable: true,
        isReplaceable: cat.name === "Electronics",
        returnWindow: 7,
        replacementWindow: 7,
        cancelWindow: 0,
        returnConditions: ["damaged", "wrong_product", "defective"],
        packagingRequired: false,
        tagsRequired: false,
        returnMethod: "self_ship",
        isCustomizable: false,
        attributes: new Map([attrPair1, attrPair2]),
        highlights: new Map([
            ["Category", cat.name],
            ["Brand", brand || cat.name],
        ]),
        highlightsArray: [
            { title: attrPair1[0], value: attrPair1[1] },
            { title: attrPair2[0], value: attrPair2[1] },
        ],
        images: [monogramImg(letter, hex, name), monogramImg(letter, hex, `${brand || cat.name} ${subcategory}`)],
        colorVariants: cat.colorVariants
            ? [
                {
                    name: color,
                    hex: `#${(seed % 0xffffff).toString(16).padStart(6, "0")}`,
                    price: null,
                    mrp: null,
                    stock: Math.round(stockBase * 0.6),
                    isDefault: true,
                    images: [monogramImg(letter, hex, `${name} — ${color}`)],
                },
                {
                    name: pick(cat.colors, seed, 16) === color ? "Charcoal" : pick(cat.colors, seed, 16),
                    hex: `#${((seed * 7) % 0xffffff).toString(16).padStart(6, "0")}`,
                    price: null,
                    mrp: null,
                    stock: Math.round(stockBase * 0.4),
                    isDefault: false,
                    images: [monogramImg(letter, hex, `${name} — alternate color`)],
                },
            ]
            : [],
        stock: stockBase,
        isActive: true,
        isFeatured,
        isDeal,
        dealStartsAt: isDeal ? new Date() : null,
        dealEndsAt: isDeal ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) : null,
        dealPriority: isDeal ? 1 : 0,
        views: rangeVal(seed, 17, 0, 800),
        sales: rangeVal(seed, 18, 0, 150),
        rating,
        numReviews,
        productType: "ecommerce",
        vendorId: null,
    };
    return doc;
}

function buildUhProduct(cat, name, index, vendorId) {
    const seed = hashSeed(name);
    const brand = guessBrand(name, [], seed) || "";
    const price = money(seed, 2, 15, 900);
    const mrp = Math.round(price * (1.1 + (seed % 20) / 100));
    const cost = Math.round(price * 0.7);
    const rating = Math.round((3.5 + (seed % 15) / 10) * 10) / 10;
    const numReviews = rangeVal(seed, 5, 0, 200);
    const stockBase = rangeVal(seed, 6, 30, 300);
    const sku = `UH-${cat.code}-${String(index + 1).padStart(3, "0")}`;
    const attrPair1 = pick(cat.attrKeys, seed, 7);
    const weightMatch = name.match(/(\d+\s?(ml|l|kg|g|pc|pcs|pack of \d+))$/i);
    const weight = weightMatch ? weightMatch[0] : "1 unit";
    const letter = (brand || name).trim().charAt(0).toUpperCase();
    const hex = `#${cat.bg}`;

    const description =
        `${name}${brand ? ` from ${brand}` : ""} — fresh, quality-checked and delivered to your doorstep in minutes ` +
        `via Urbexon Hour, our ${cat.name.toLowerCase()} quick-commerce range.`;

    return {
        name,
        description,
        price,
        mrp,
        cost,
        category: cat.name,
        subcategory: "",
        brand,
        sku,
        tags: [cat.name, "Daily Essentials", "Fresh"],
        weight,
        color: "",
        material: "",
        occasion: "Everyday",
        origin: "India",
        sizes: [],
        returnPolicy: cat.nonReturnable ? "Non-returnable (perishable)" : "7 days return",
        shippingInfo: "Delivered in minutes via Urbexon Hour",
        gstPercent: cat.gst,
        hsn: cat.hsn,
        barcode: eanLike(seed),
        lowStockThreshold: rangeVal(seed, 12, 5, 15),
        seo: {
            metaTitle: trimTo(`${name} | Urbexon Hour`, 120),
            metaDescription: trimTo(description, 200),
        },
        shipping: {
            lengthCm: rangeVal(seed, 13, 5, 25),
            widthCm: rangeVal(seed, 14, 5, 20),
            heightCm: rangeVal(seed, 15, 3, 15),
        },
        isCancellable: true,
        isReturnable: !cat.nonReturnable,
        isReplaceable: cat.nonReturnable,
        returnWindow: cat.nonReturnable ? 0 : 2,
        replacementWindow: cat.nonReturnable ? 1 : 2,
        cancelWindow: 1,
        nonReturnableReason: cat.nonReturnable ? "Perishable item — not eligible for return once delivered" : "",
        returnConditions: cat.nonReturnable ? ["damaged", "wrong_product", "missing_items"] : ["damaged", "wrong_product", "defective"],
        packagingRequired: false,
        tagsRequired: false,
        returnMethod: "self_ship",
        isCustomizable: false,
        attributes: new Map([attrPair1]),
        highlights: new Map([
            ["Category", cat.name],
            [attrPair1[0], attrPair1[1]],
        ]),
        highlightsArray: [{ title: attrPair1[0], value: attrPair1[1] }],
        images: [monogramImg(letter, hex, name), monogramImg(letter, hex, `${cat.name} — fresh pick`)],
        colorVariants: [],
        stock: stockBase,
        isActive: true,
        isFeatured: seed % 5 === 0,
        isDeal: seed % 7 === 0,
        dealStartsAt: seed % 7 === 0 ? new Date() : null,
        dealEndsAt: seed % 7 === 0 ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 15) : null,
        dealPriority: seed % 7 === 0 ? 1 : 0,
        views: rangeVal(seed, 17, 0, 600),
        sales: rangeVal(seed, 18, 0, 300),
        rating,
        numReviews,
        productType: "urbexon_hour",
        vendorId,
        prepTimeMinutes: rangeVal(seed, 19, 5, 20),
        maxOrderQty: rangeVal(seed, 20, 5, 20),
    };
}

/* ════════════════════════════════════════
   Main
════════════════════════════════════════ */
async function main() {
    if (!process.env.MONGO_URI) {
        console.error("❌ MONGO_URI not set in backend/.env");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("🗄️  Connected to MongoDB");

    /* ── 1. Categories ── */
    let catCount = 0;
    for (const [i, cat] of [...ECOM_CATS.map(c => ({ ...c, type: "ecommerce" })), ...UH_CATS.map(c => ({ ...c, type: "urbexon_hour" }))].entries()) {
        const existing = await Category.findOne({ name: cat.name });
        if (!existing) {
            await Category.create({ name: cat.name, type: cat.type, isActive: true, order: i });
            catCount++;
        }
    }
    console.log(`✅ Categories ready (${catCount} newly created, rest already existed)`);

    /* ── 2. Vendor for Urbexon Hour products ── */
    const vendorEmail = "urbexonhour.seedvendor@urbexon.in";
    let vendorUser = await User.findOne({ email: vendorEmail });
    if (!vendorUser) {
        const hashed = await bcrypt.hash("Urbexon@12345", 12);
        vendorUser = await User.create({
            name: "Urbexon Hour Seed Vendor",
            email: vendorEmail,
            password: hashed,
            phone: "9876543210",
            role: "vendor",
            isEmailVerified: true,
        });
    }

    let vendor = await Vendor.findOne({ userId: vendorUser._id });
    if (!vendor) {
        vendor = await Vendor.create({
            userId: vendorUser._id,
            shopName: "Urbexon Hour Store",
            ownerName: "Urbexon Hour Seed Vendor",
            email: vendorEmail,
            phone: "9876543210",
            shopCategory: "Groceries",
            status: "approved",
            isOpen: true,
            acceptingOrders: true,
            servicePincodes: ["110001", "400001"],
            address: { line1: "Seed Address", city: "New Delhi", state: "Delhi", pincode: "110001" },
            subscription: { plan: "premium", isActive: true, startDate: new Date(), expiryDate: new Date("2030-12-31") },
            isDeleted: false,
        });
    } else {
        vendor.status = "approved";
        vendor.isOpen = true;
        vendor.acceptingOrders = true;
        vendor.subscription = { plan: "premium", isActive: true, startDate: new Date(), expiryDate: new Date("2030-12-31") };
        vendor.servicePincodes = ["110001", "400001"];
        await vendor.save();
    }
    console.log(`✅ Vendor ready: ${vendor.shopName} (${vendor._id})`);

    /* ── 3. Serviceable pincodes ── */
    await Pincode.findOneAndUpdate(
        { code: "110001" },
        { code: "110001", status: "active", city: "New Delhi", area: "Connaught Place", state: "Delhi", priority: 10 },
        { upsert: true, new: true }
    );
    await Pincode.findOneAndUpdate(
        { code: "400001" },
        { code: "400001", status: "active", city: "Mumbai", area: "Fort", state: "Maharashtra", priority: 10 },
        { upsert: true, new: true }
    );
    console.log("✅ Pincodes 110001 / 400001 active");

    /* ── 4. Clear previously seeded products (idempotent re-run) ── */
    const del1 = await Product.deleteMany({ sku: { $regex: /^UE-/ } });
    const del2 = await Product.deleteMany({ sku: { $regex: /^UH-/ } });
    console.log(`🧹 Cleared ${del1.deletedCount} old Urbexon Ecommerce + ${del2.deletedCount} old Urbexon Hour products`);

    /* ── 5. Insert Urbexon Ecommerce products (20 x 5 categories) ── */
    let ecomCount = 0;
    for (const cat of ECOM_CATS) {
        for (let i = 0; i < cat.items.length; i++) {
            const doc = buildEcomProduct(cat, cat.items[i], i);
            await Product.create(doc);
            ecomCount++;
        }
        console.log(`  ✅ ${cat.name}: ${cat.items.length} products added`);
    }

    /* ── 6. Insert Urbexon Hour products (20 x 5 categories) ── */
    let uhCount = 0;
    for (const cat of UH_CATS) {
        for (let i = 0; i < cat.items.length; i++) {
            const doc = buildUhProduct(cat, cat.items[i], i, vendor._id);
            await Product.create(doc);
            uhCount++;
        }
        console.log(`  ✅ ${cat.name}: ${cat.items.length} products added`);
    }

    console.log(`\n🎉 Done! ${ecomCount} Urbexon Ecommerce products + ${uhCount} Urbexon Hour products seeded.`);
    console.log(`   Urbexon Hour vendor: ${vendor.shopName} — test pincode 110001 or 400001`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seeding error:", err);
    process.exit(1);
});

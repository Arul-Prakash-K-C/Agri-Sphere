import { adminDb } from '../src/lib/server/firebase-admin.js';

async function checkInventory() {
    try {
        console.log("--- INVENTORY ITEMS ---");
        const invSnapshot = await adminDb.collection('inventory').get();
        invSnapshot.forEach(doc => {
            console.log(doc.id, "=>", doc.data());
        });

        console.log("\n--- INVENTORY SETTINGS ---");
        const settingsSnapshot = await adminDb.collection('inventory_settings').get();
        settingsSnapshot.forEach(doc => {
            console.log(doc.id, "=>", doc.data());
        });
        
        process.exit(0);
    } catch (err) {
        console.error("Error reading database:", err);
        process.exit(1);
    }
}

checkInventory();

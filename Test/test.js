// test-atlas.js
const { MongoClient } = require("mongodb");

// Your Atlas connection string - UPDATE THIS
const uri =
  "mongodb+srv://saadkhan:iE2Mot36JW6VMEMi@cluster0.ll5hpbw.mongodb.net/?retryWrites=true&w=majority";

async function testConnection() {
  const client = new MongoClient(uri);

  try {
    console.log("🔗 Testing Atlas connection...");

    // Connect to the MongoDB cluster
    await client.connect();

    console.log("✅ SUCCESS: Connected to MongoDB Atlas!");

    // List all databases to verify connection
    const databases = await client.db().admin().listDatabases();
    console.log("📊 Available databases:");
    databases.databases.forEach((db) => console.log(`   - ${db.name}`));

    // Test creating/accessing a collection
    const testDB = client.db("testdb");
    const testCollection = testDB.collection("test");

    // Insert a test document
    const result = await testCollection.insertOne({
      message: "Test connection",
      timestamp: new Date(),
    });
    console.log("📝 Test document inserted with id:", result.insertedId);

    // Read the test document
    const doc = await testCollection.findOne({ _id: result.insertedId });
    console.log("📖 Test document retrieved:", doc);
  } catch (error) {
    console.error("❌ FAILED: Connection error:", error.message);

    // Specific error messages
    if (error.message.includes("authentication failed")) {
      console.log("\n💡 AUTHENTICATION ISSUE:");
      console.log("   - Wrong username/password");
      console.log("   - Database user does not exist");
      console.log("   - Go to Atlas → Database Access → Create user");
    } else if (error.message.includes("getaddrinfo")) {
      console.log("\n💡 NETWORK ISSUE:");
      console.log("   - Check internet connection");
      console.log("   - IP may not be whitelisted");
      console.log("   - Go to Atlas → Network Access → Add IP");
    } else if (error.message.includes("querySrv")) {
      console.log("\n💡 DNS ISSUE:");
      console.log("   - Check your internet connection");
      console.log("   - Try using a different network");
    }
  } finally {
    // Close the connection
    await client.close();
    console.log("\n🔒 Connection closed");
  }
}

// Run the test
testConnection();

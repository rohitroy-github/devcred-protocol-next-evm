require("dotenv").config();

const { MongoClient, ServerApiVersion } = require("mongodb");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const mongoUri = requiredEnv("MONGODB_URI");
  const mongoDbName = requiredEnv("MONGODB_DB_NAME");

  const client = new MongoClient(mongoUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  try {
    const db = client.db(mongoDbName);
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log(`Database '${mongoDbName}' is already empty.`);
      return;
    }

    await db.dropDatabase();
    console.log(`Database '${mongoDbName}' cleared successfully.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to clear database:", error.message);
  process.exit(1);
});

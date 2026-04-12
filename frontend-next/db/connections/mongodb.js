import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri) {
  throw new Error("Please define MONGODB_URI in your environment variables");
}

if (!dbName) {
  throw new Error("Please define MONGODB_DB_NAME in your environment variables");
}

let clientPromise = global.mongoClientPromise;

if (!clientPromise) {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  clientPromise = client.connect();
  global.mongoClientPromise = clientPromise;
}

export async function getMongoDb() {
  const client = await clientPromise;
  return client.db(dbName);
}

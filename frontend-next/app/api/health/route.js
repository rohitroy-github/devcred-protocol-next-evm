import { getMongoDb } from "@/db/connections/mongodb";

export async function GET() {
  try {
    const db = await getMongoDb();
    const admin = db.admin();
    await admin.ping();
    
    return Response.json({ 
      status: "ok", 
      message: "MongoDB connected successfully" 
    }, { status: 200 });
  } catch (error) {
    return Response.json({ 
      status: "error", 
      message: error.message 
    }, { status: 500 });
  }
}

import type { NextRequest } from "next/server";
import { bff } from "@/src/lib/bff/handlers";

export const POST = (req: NextRequest) => bff().login(req);

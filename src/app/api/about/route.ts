import { json } from "@/lib/api";
import { BRAND, PROCESS, SOURCING, TESTIMONIALS, VALUES } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/** The brand story, values, sourcing notes and testimonials. */
export async function GET(): Promise<Response> {
  return json({ brand: BRAND, values: VALUES, process: PROCESS, sourcing: SOURCING, testimonials: TESTIMONIALS });
}

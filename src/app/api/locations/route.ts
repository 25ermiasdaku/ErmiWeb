import { json } from "@/lib/api";
import { LOCATIONS } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/** The public store list. */
export async function GET(): Promise<Response> {
  return json({
    locations: LOCATIONS.map((l) => ({
      name: l.name,
      address: l.address,
      area: l.area,
      hours: l.hours,
      note: l.note,
    })),
  });
}

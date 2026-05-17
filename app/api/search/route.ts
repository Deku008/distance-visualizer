type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  category?: string;
  addresstype?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    state?: string;
    country_code?: string;
  };
};

const INDIA_VIEWBOX = "67.5,37.6,97.4,6.4";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return Response.json({ results: [] });
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("q", query);
  nominatimUrl.searchParams.set("format", "jsonv2");
  nominatimUrl.searchParams.set("addressdetails", "1");
  nominatimUrl.searchParams.set("namedetails", "1");
  nominatimUrl.searchParams.set("limit", "6");
  nominatimUrl.searchParams.set("countrycodes", "in");
  nominatimUrl.searchParams.set("viewbox", INDIA_VIEWBOX);
  nominatimUrl.searchParams.set("bounded", "1");
  nominatimUrl.searchParams.set("layer", "address,poi,manmade");

  const response = await fetch(nominatimUrl, {
    headers: {
      "Accept-Language": "en-IN,en;q=0.9",
      "User-Agent": "IndiaDistanceVisualizer/1.0 (local development)",
    },
  });

  if (!response.ok) {
    return Response.json(
      { error: "Nominatim search is temporarily unavailable.", results: [] },
      { status: response.status },
    );
  }

  const places = (await response.json()) as NominatimPlace[];

  return Response.json({
    results: places
      .filter((place) => place.address?.country_code === "in")
      .map((place) => ({
        id: place.place_id,
        name: place.name ?? place.display_name.split(",")[0],
        region: place.address?.state ?? "India",
        displayName: place.display_name,
        type: place.addresstype ?? place.type ?? place.category ?? "place",
        coordinates: [Number(place.lat), Number(place.lon)],
      })),
  });
}

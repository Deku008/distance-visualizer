type DirectionsRequest = {
  start: [number, number];
  end: [number, number];
  profile?: string;
};

type OrsFeature = {
  geometry?: {
    coordinates?: [number, number][];
  };
  properties?: {
    segments?: Array<{
      distance?: number;
      duration?: number;
    }>;
    summary?: {
      distance?: number;
      duration?: number;
    };
  };
};

type OrsResponse = {
  features?: OrsFeature[];
  error?: {
    message?: string;
  };
};

const INDIA_BOUNDS = {
  south: 6.4,
  west: 67.5,
  north: 37.6,
  east: 97.4,
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing OPENROUTESERVICE_API_KEY in your environment." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as DirectionsRequest;
  const profile = body.profile ?? "driving-car";

  if (!isCoordinate(body.start) || !isCoordinate(body.end)) {
    return Response.json({ error: "Start and end coordinates are required." }, { status: 400 });
  }

  if (!isWithinIndiaBounds(body.start) || !isWithinIndiaBounds(body.end)) {
    return Response.json(
      { error: "Routes are restricted to locations within India." },
      { status: 400 },
    );
  }

  const orsResponse = await fetch(
    `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
    {
      method: "POST",
      headers: {
        Accept: "application/geo+json, application/json",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [body.start[1], body.start[0]],
          [body.end[1], body.end[0]],
        ],
        instructions: false,
      }),
    },
  );

  const data = (await orsResponse.json()) as OrsResponse;

  if (!orsResponse.ok) {
    return Response.json(
      {
        error:
          data.error?.message ??
          "OpenRouteService could not calculate a road route for these locations.",
      },
      { status: orsResponse.status },
    );
  }

  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates?.length) {
    return Response.json({ error: "OpenRouteService returned no route geometry." }, { status: 502 });
  }

  const segment = feature?.properties?.segments?.[0];
  const summary = feature?.properties?.summary;

  return Response.json({
    geometry: coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distanceMeters: segment?.distance ?? summary?.distance ?? null,
    durationSeconds: segment?.duration ?? summary?.duration ?? null,
  });
}

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isWithinIndiaBounds([latitude, longitude]: [number, number]) {
  return (
    latitude >= INDIA_BOUNDS.south &&
    latitude <= INDIA_BOUNDS.north &&
    longitude >= INDIA_BOUNDS.west &&
    longitude <= INDIA_BOUNDS.east
  );
}

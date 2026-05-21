import { useState } from "react";

function App() {
  const [routePlan, setRoutePlan] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [routeType, setRouteType] = useState("point");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [availableTime, setAvailableTime] = useState("2 hours");
  const [travelMode, setTravelMode] = useState("walking");
  const [energyLevel, setEnergyLevel] = useState("medium");
  const [routeStyle, setRouteStyle] = useState("scenic");
  const [locationStatus, setLocationStatus] = useState("");
  const [chatGptPrompt, setChatGptPrompt] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [promptStatus, setPromptStatus] = useState("");

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Current location is not supported.");
      return;
    }

    setLocationStatus("Getting current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setStart(`${lat},${lng}`);
        setLocationStatus("Current location added.");
        setErrorMessage("");
      },
      () => {
        setLocationStatus("Could not get current location.");
      }
    );
  }

  function validateForm() {
    if (!start.trim()) {
      return "Please enter a start location or use current location.";
    }

    if (routeType === "point" && !end.trim()) {
      return "Please enter an end location for a point-to-point route.";
    }

    return "";
  }

  function buildGoogleMapsUrl(origin, destination, mode, waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(
      destination
    )}&travelmode=${mode}&waypoints=${encodeURIComponent(
      waypoints.join("|")
    )}`;
  }

  function generateChatGptPrompt() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    setCopyStatus("");

    const destination = routeType === "loop" ? start : end;

    const prompt = `
You are a practical travel route planner.

Create a Google Maps waypoint route based on the request below.

Main goal:
- Choose useful waypoint/shaping points, not just famous POIs.
- Prioritize best walking/driving experience over shortest route.
- For loop routes, use different outward and return corridors when possible.
- Avoid overpacking the route.
- Prefer exterior/scenic/street-level experience unless user asks otherwise.

CRITICAL TIME CONSTRAINT:
- Before returning JSON, mentally sanity-check whether Google Maps would likely show the route within the requested time.
- If the route cannot fit, reduce the waypoint count until it can.
TARGET TIME UTILIZATION:
- Aim to use approximately 75% to 100% of the available time.
- Slightly under the requested duration is acceptable.
- Avoid routes that are dramatically shorter than the requested duration unless constraints require it.
- The route should feel satisfying for the requested time budget.
- For scenic and historic routes, prefer extending the experience with pleasant continuous corridors instead of adding excessive discrete stops.
- For 1 hour walking routes, keep the route very compact, usually 0.5 to 2.5 miles depending on energy level and terrain.
- For low-energy 1 hour walking loops, prefer 1 to 3 intermediate waypoints maximum.
- Never create a walking route that would obviously take multiple hours when the requested time is 1 hour.
- The full route must realistically fit within the requested available time.
- Treat available time as a hard constraint, not a loose suggestion.
- Include realistic time for walking/driving, crossings, parking friction, short pauses, viewpoints, and photo stops.
- Prefer fewer high-value waypoints over too many stops.
- If the requested route is unrealistic, choose a smaller route and explain that in notes.
- Do not create a route that significantly exceeds the requested duration.
WALKING TIME SCALE:
- 1 hour walking: target about 45 to 65 minutes total.
- 2 hours walking: target about 90 to 130 minutes total.
- 3 hours walking: target about 135 to 190 minutes total.
- Low energy should stay toward the lower end of the range.
- High energy can use the upper end of the range.

ENERGY LEVEL RULES:
- Low energy:
  - Keep route compact.
  - Prefer mostly flat paths.
  - Avoid steep hills, long stairs, difficult climbs, and excessive elevation gain.
  - Use fewer waypoints.
  - Favor easy-access viewpoints and comfortable paths.
- Medium energy:
  - Moderate distance is acceptable.
  - Some gentle hills, stairs, or viewpoint climbs are acceptable.
  - Avoid making the route feel strenuous unless the payoff is high.
- High energy:
  - Longer routes, steeper climbs, stairs, hill viewpoints, and more ambitious detours are acceptable.

MODE-SPECIFIC RULES:
- Walking:
  - Prioritize pedestrian-friendly streets, waterfront paths, plazas, promenades, parks, and historic lanes.
  - Avoid routing primarily along unpleasant high-traffic roads.
  - For low energy, keep the walking route especially compact and mostly flat.
- Driving:
  - Prioritize scenic roads, viewpoints, pleasant approaches, and low-friction stops.
  - Consider parking difficulty and avoid too many stop-and-park segments for low energy.

LOOP ROUTE RULES:
- Loop routes should return to the start.
- Use different outward and return corridors when possible.
- Keep loop routes geographically compact unless available time and energy are high.
- For short low-energy loops, use fewer waypoints and avoid distant add-ons.
MAP-SEARCHABLE WAYPOINT RULES:
- Every waypoint must be a full, specific, Google Maps-searchable location.
- Include place name + neighborhood/locality + city + state/region + country whenever possible.
- For India and dense urban areas, include road/locality/city/state/country if known.
- Prefer official Google Maps-style place names, parks, gates, stations, markets, temples, plazas, viewpoints, intersections, promenades, or named roads.
- Avoid vague names such as "Old Town", "Waterfront", "Main Market", "City Center", "Beach Road", or "Fort Area" unless expanded into a specific searchable place.
- If a scenic/historic point is locally known but may not resolve in Google Maps, replace it with the nearest prominent searchable landmark or intersection.
- Do not use generic descriptions as waypoints.
- The app already supplies origin and destination separately.
- Do not include the start location in the waypoints array.
- Do not include the end location in the waypoints array.
- For loop routes, do not include the start/return location in the waypoints array.
- Do not duplicate waypoints.

Route request:
{
  "routeType": "${routeType}",
  "start": "${start}",
  "end": "${destination}",
  "availableTime": "${availableTime}",
  "travelMode": "${travelMode}",
  "energyLevel": "${energyLevel}",
  "routeStyle": "${routeStyle}"
}

Return ONLY valid JSON inside a single json code block.
Do not include any explanation before or after the code block.

{
  "title": "Short route title",
  "summary": "One or two sentence explanation of the route.",
  "estimatedDuration": "Realistic total route duration estimate",
  "distanceRisk": "low, medium, or high",
  "energyFit": "good, borderline, or poor",
  "waypoints": [
  "Full searchable waypoint name, locality, city, state/region, country",
  "Another full searchable waypoint name, locality, city, state/region, country"
  ],
  "skipIfLate": [
    "Waypoint or stop to skip if short on time"
  ],
  "addIfAhead": [
    "Optional add-on if ahead of schedule"
  ],
  "notes": [
    "Useful practical note"
  ]
}
`.trim();

    setChatGptPrompt(prompt);
    setPromptStatus(`Prompt updated at ${new Date().toLocaleTimeString()}`);
    setJsonInput("");
    setRoutePlan(null);
  }

  async function copyPrompt() {
    if (!chatGptPrompt) return;

    try {
      await navigator.clipboard.writeText(chatGptPrompt);
      setCopyStatus("Prompt copied.");
    } catch {
      setCopyStatus("Could not copy automatically. Select and copy manually.");
    }
  }

  function cleanJsonInput(input) {
    return input
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  function buildRouteFromJson() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setRoutePlan(null);
      return;
    }

    let parsed;

    try {
      parsed = JSON.parse(cleanJsonInput(jsonInput));
    } catch {
      setErrorMessage("Invalid JSON. Paste only the JSON response from ChatGPT.");
      setRoutePlan(null);
      return;
    }

    if (!parsed.title || !Array.isArray(parsed.waypoints)) {
      setErrorMessage("JSON must include a title and a waypoints array.");
      setRoutePlan(null);
      return;
    }

    const destination = routeType === "loop" ? start : end;
    const waypoints = parsed.waypoints;

    const googleMapsUrl = buildGoogleMapsUrl(
      start,
      destination,
      travelMode,
      waypoints
    );

    const plan = {
      title: parsed.title,
      summary: parsed.summary || "AI-assisted route generated from pasted JSON.",
      estimatedDuration: parsed.estimatedDuration || "Not provided",
      distanceRisk: parsed.distanceRisk || "Not provided",
      energyFit: parsed.energyFit || "Not provided",
      request: {
        routeType,
        start,
        end: destination,
        availableTime,
        travelMode,
        energyLevel,
        routeStyle
      },
      stops: [
        { name: start, type: "Start" },
        ...waypoints.map((point) => ({
          name: point,
          type: "Waypoint"
        })),
        {
          name: destination,
          type: routeType === "loop" ? "Return" : "End"
        }
      ],
      skipIfLate: Array.isArray(parsed.skipIfLate) ? parsed.skipIfLate : [],
      addIfAhead: Array.isArray(parsed.addIfAhead) ? parsed.addIfAhead : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      googleMapsUrl
    };

    setErrorMessage("");
    setRoutePlan(plan);
  }

  function generateSampleRoutePlan() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setRoutePlan(null);
      return;
    }

    const destination = routeType === "loop" ? start : end;
    const waypoints = ["Sample waypoint 1", "Sample waypoint 2"];

    const googleMapsUrl = buildGoogleMapsUrl(
      start,
      destination,
      travelMode,
      waypoints
    );

    const plan = {
      title: routeType === "loop" ? "Sample Loop Route" : "Sample Route",
      summary: "Non-AI sample route using placeholder waypoints.",
      estimatedDuration: "Sample only",
      distanceRisk: "Sample only",
      energyFit: "Sample only",
      request: {
        routeType,
        start,
        end: destination,
        availableTime,
        travelMode,
        energyLevel,
        routeStyle
      },
      stops: [
        { name: start, type: "Start" },
        ...waypoints.map((point) => ({
          name: point,
          type: "Waypoint"
        })),
        {
          name: destination,
          type: routeType === "loop" ? "Return" : "End"
        }
      ],
      skipIfLate: [],
      addIfAhead: [],
      notes: ["This is the fallback sample engine."],
      googleMapsUrl
    };

    setErrorMessage("");
    setRoutePlan(plan);
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Route Planner</h1>
        <p style={subtitleStyle}>
          Build a route prompt, paste ChatGPT JSON, and launch in Google Maps.
        </p>

        <label style={labelStyle}>Route Type</label>
        <select
          style={inputStyle}
          value={routeType}
          onChange={(e) => {
            setRouteType(e.target.value);
            setRoutePlan(null);
            setErrorMessage("");
          }}
        >
          <option value="point">Point to point</option>
          <option value="loop">Loop back to start</option>
        </select>

        <label style={labelStyle}>Start Location</label>
        <input
          style={inputStyle}
          placeholder="Enter start location"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setErrorMessage("");
          }}
        />

        <button style={secondaryButtonStyle} onClick={useCurrentLocation}>
          Use Current Location
        </button>

        {locationStatus && <div style={statusStyle}>{locationStatus}</div>}

        {routeType === "point" && (
          <>
            <label style={labelStyle}>End Location</label>
            <input
              style={inputStyle}
              placeholder="Enter destination"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setErrorMessage("");
              }}
            />
          </>
        )}

        {routeType === "loop" && (
          <div style={infoBoxStyle}>
            Loop mode returns to the start location.
          </div>
        )}

        <label style={labelStyle}>Available Time</label>
        <select
          style={inputStyle}
          value={availableTime}
          onChange={(e) => setAvailableTime(e.target.value)}
        >
          <option value="1 hour">1 hour</option>
          <option value="2 hours">2 hours</option>
          <option value="3 hours">3 hours</option>
          <option value="half day">Half day</option>
        </select>

        <label style={labelStyle}>Travel Mode</label>
        <select
          style={inputStyle}
          value={travelMode}
          onChange={(e) => setTravelMode(e.target.value)}
        >
          <option value="walking">Walking</option>
          <option value="driving">Driving</option>
        </select>

        <label style={labelStyle}>Energy Level</label>
        <select
          style={inputStyle}
          value={energyLevel}
          onChange={(e) => setEnergyLevel(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <label style={labelStyle}>Route Style</label>
        <select
          style={inputStyle}
          value={routeStyle}
          onChange={(e) => setRouteStyle(e.target.value)}
        >
          <option value="scenic">Scenic</option>
          <option value="historic">Historic</option>
          <option value="efficient">Efficient but interesting</option>
          <option value="food">Food-friendly</option>
        </select>

        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        <button style={buttonStyle} onClick={generateChatGptPrompt}>
          Generate ChatGPT Prompt
        </button>

        {chatGptPrompt && (
          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>ChatGPT Prompt</h2>
            {promptStatus && <div style={statusStyle}>{promptStatus}</div>}
            <textarea style={textareaStyle} value={chatGptPrompt} readOnly />
            <button style={secondaryButtonStyle} onClick={copyPrompt}>
              Copy Prompt
            </button>
            {copyStatus && <div style={statusStyle}>{copyStatus}</div>}
          </div>
        )}

        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Paste ChatGPT Route JSON</h2>
          <textarea
            style={textareaStyle}
            placeholder="Paste JSON response here"
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setErrorMessage("");
            }}
          />
          <button style={buttonStyle} onClick={buildRouteFromJson}>
            Build Route from JSON
          </button>
        </div>

        <button style={sampleButtonStyle} onClick={generateSampleRoutePlan}>
          Use Sample Route Instead
        </button>

        {routePlan && (
          <div style={resultCardStyle}>
            <div style={resultHeaderStyle}>
              <h2 style={{ margin: 0 }}>{routePlan.title}</h2>
              <div style={badgeStyle}>
                {routePlan.summary.includes("sample") ? "Sample" : "ChatGPT"}
              </div>
            </div>

            <p style={resultSummaryStyle}>{routePlan.summary}</p>

            <div style={metaGridStyle}>
              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Requested Time</div>
                <div>{routePlan.request.availableTime}</div>
              </div>
              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Estimated Duration</div>
                <div>{routePlan.estimatedDuration}</div>
              </div>
              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Distance Risk</div>
                <div>{routePlan.distanceRisk}</div>
              </div>
              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Energy Fit</div>
                <div>{routePlan.energyFit}</div>
              </div>
            </div>

            <h3>Stops</h3>
            {routePlan.stops.map((stop, index) => (
              <div key={index} style={stopCardStyle}>
                <div style={stopTypeStyle}>{stop.type}</div>
                <div style={stopNameStyle}>{stop.name}</div>
              </div>
            ))}

            {routePlan.skipIfLate.length > 0 && (
              <>
                <h3>Skip if late</h3>
                <ul>
                  {routePlan.skipIfLate.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {routePlan.addIfAhead.length > 0 && (
              <>
                <h3>Add if ahead</h3>
                <ul>
                  {routePlan.addIfAhead.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {routePlan.notes.length > 0 && (
              <>
                <h3>Notes</h3>
                <ul>
                  {routePlan.notes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            <a
              href={routePlan.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              style={mapButtonStyle}
            >
              Open in Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f4f4f5",
  padding: "20px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "540px",
  margin: "0 auto",
  background: "white",
  borderRadius: "22px",
  padding: "24px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
};

const titleStyle = {
  margin: 0,
  fontSize: "32px"
};

const subtitleStyle = {
  color: "#666",
  marginTop: "8px",
  marginBottom: "24px",
  lineHeight: 1.5
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: "600"
};

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginBottom: "18px",
  borderRadius: "12px",
  border: "1px solid #d4d4d8",
  fontSize: "16px",
  boxSizing: "border-box"
};

const textareaStyle = {
  width: "100%",
  minHeight: "180px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #d4d4d8",
  fontSize: "14px",
  boxSizing: "border-box",
  marginBottom: "12px",
  fontFamily: "monospace"
};

const buttonStyle = {
  width: "100%",
  padding: "16px",
  background: "black",
  color: "white",
  border: "none",
  borderRadius: "14px",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer",
  marginBottom: "14px"
};

const secondaryButtonStyle = {
  width: "100%",
  padding: "12px",
  background: "#e4e4e7",
  color: "black",
  border: "none",
  borderRadius: "12px",
  fontSize: "15px",
  marginBottom: "14px",
  cursor: "pointer"
};

const sampleButtonStyle = {
  width: "100%",
  padding: "14px",
  background: "#fef3c7",
  color: "#78350f",
  border: "1px solid #f59e0b",
  borderRadius: "14px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  marginBottom: "14px"
};

const panelStyle = {
  background: "#fafafa",
  border: "1px solid #e4e4e7",
  borderRadius: "16px",
  padding: "16px",
  marginTop: "18px",
  marginBottom: "18px"
};

const panelTitleStyle = {
  marginTop: 0,
  fontSize: "20px"
};

const statusStyle = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  padding: "10px",
  borderRadius: "10px",
  marginBottom: "18px",
  fontSize: "14px"
};

const errorStyle = {
  background: "#fee2e2",
  border: "1px solid #ef4444",
  color: "#991b1b",
  padding: "12px",
  borderRadius: "12px",
  marginBottom: "16px",
  fontSize: "14px",
  fontWeight: "600"
};

const infoBoxStyle = {
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  padding: "12px",
  borderRadius: "12px",
  marginBottom: "18px",
  fontSize: "14px"
};

const resultCardStyle = {
  marginTop: "28px",
  padding: "22px",
  borderRadius: "18px",
  background: "#f9fafb",
  border: "1px solid #e4e4e7"
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
  gap: "12px"
};

const badgeStyle = {
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "700"
};

const resultSummaryStyle = {
  color: "#555",
  lineHeight: 1.6
};

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  marginTop: "18px",
  marginBottom: "24px"
};

const metaCardStyle = {
  background: "white",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #e4e4e7"
};

const metaLabelStyle = {
  fontSize: "12px",
  color: "#666",
  marginBottom: "4px"
};

const stopCardStyle = {
  background: "white",
  borderRadius: "12px",
  padding: "14px",
  border: "1px solid #e4e4e7",
  marginBottom: "10px"
};

const stopTypeStyle = {
  fontSize: "12px",
  color: "#666",
  marginBottom: "4px"
};

const stopNameStyle = {
  fontWeight: "600"
};

const mapButtonStyle = {
  display: "block",
  textAlign: "center",
  marginTop: "24px",
  padding: "16px",
  background: "#2563eb",
  color: "white",
  textDecoration: "none",
  borderRadius: "14px",
  fontWeight: "700"
};

export default App;
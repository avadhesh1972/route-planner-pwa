import { useEffect, useRef, useState } from "react";
import { GeocoderAutocomplete } from "@geoapify/geocoder-autocomplete";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";

const geoapifyApiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;

function PinIcon({ size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function LocationAutocomplete({ placeholder, value, onChange }) {
  const containerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !geoapifyApiKey) {
      return undefined;
    }

    const autocomplete = new GeocoderAutocomplete(
      container,
      geoapifyApiKey,
      {
        placeholder,
        lang: "en",
        limit: 5
      }
    );

    autocompleteRef.current = autocomplete;

    const handleSelect = (feature) => {
      const formatted = feature?.properties?.formatted;
      onChangeRef.current(formatted || autocomplete.getValue());
    };

    const handleInput = () => {
      onChangeRef.current(autocomplete.getValue());
    };

    autocomplete.on("select", handleSelect);
    container.addEventListener("input", handleInput);

    return () => {
      autocomplete.off("select", handleSelect);
      container.removeEventListener("input", handleInput);
      autocompleteRef.current = null;
      container.innerHTML = "";
    };
  }, [placeholder]);

  useEffect(() => {
    const autocomplete = autocompleteRef.current;

    if (autocomplete && autocomplete.getValue() !== value) {
      autocomplete.setValue(value);
    }
  }, [value]);

  if (!geoapifyApiKey) {
    return (
      <input
        style={locationFallbackInputStyle}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return <div ref={containerRef} style={autocompleteContainerStyle} />;
}

function App() {
  const [routePlan, setRoutePlan] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [routeType, setRouteType] = useState("point");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [includePoints, setIncludePoints] = useState([""]);
  const [excludePoints, setExcludePoints] = useState([""]);
  const [availableTime, setAvailableTime] = useState("2 hours");
  const [travelMode, setTravelMode] = useState("walking");
  const [energyLevel, setEnergyLevel] = useState("medium");
  const [routeStyle, setRouteStyle] = useState("scenic");
  const [locationStatus, setLocationStatus] = useState("");
  const [chatGptPrompt, setChatGptPrompt] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [promptStatus, setPromptStatus] = useState("");
  const [jsonStatus, setJsonStatus] = useState("");
  const locationStatusTimeoutRef = useRef(null);
  const locationRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (locationStatusTimeoutRef.current) {
        clearTimeout(locationStatusTimeoutRef.current);
      }
    };
  }, []);

  function clearLocationStatus() {
    if (locationStatusTimeoutRef.current) {
      clearTimeout(locationStatusTimeoutRef.current);
      locationStatusTimeoutRef.current = null;
    }

    setLocationStatus("");
  }

  function setTemporaryLocationStatus(message) {
    clearLocationStatus();
    setLocationStatus(message);
    locationStatusTimeoutRef.current = setTimeout(() => {
      setLocationStatus("");
      locationStatusTimeoutRef.current = null;
    }, 2500);
  }

  function handleStartChange(nextStart) {
    locationRequestIdRef.current += 1;
    setStart(nextStart);
    setErrorMessage("");
    clearLocationStatus();
  }

  function handleRouteTypeChange(nextRouteType) {
    locationRequestIdRef.current += 1;
    setRouteType(nextRouteType);
    setRoutePlan(null);
    setErrorMessage("");
    clearLocationStatus();
  }

  function useCurrentLocation() {
    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;
    clearLocationStatus();

    if (!navigator.geolocation) {
      setLocationStatus("Current location is not supported.");
      return;
    }

    setLocationStatus("Getting current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestIdRef.current) {
          return;
        }

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setStart(`${lat},${lng}`);
        setTemporaryLocationStatus("Current location added.");
        setErrorMessage("");
      },
      () => {
        if (requestId !== locationRequestIdRef.current) {
          return;
        }

        setLocationStatus("Could not get current location.");
      }
    );
  }

  function swapStartEnd() {
    setStart(end);
    setEnd(start);
    setRoutePlan(null);
    setErrorMessage("");
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

  function parsePoints(items) {
    return items
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function updatePoint(list, setList, index, value) {
    setList(list.map((item, i) => (i === index ? value : item)));
  }

  function removePoint(list, setList, index) {
    setList(list.filter((_, i) => i !== index));
  }

  function addPoint(setList) {
    setList((prev) => [...prev, ""]);
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
    setJsonStatus("");

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

OPENING HOURS AND AVAILABILITY:
- Optimize the route so key stops are likely open during the planned route window.
- Treat opening hours as important for museums, churches/temples, gardens, markets, restaurants, cafes, ticketed attractions, viewpoints with gates, and any indoor or managed venue.
- Do not make a closed or likely closed venue the main anchor unless it is still valuable as an exterior/scenic pass-by.
- If exact opening hours are uncertain, prefer public streets, promenades, plazas, waterfronts, parks, viewpoints, exterior landmarks, or other places that are usually accessible.
- For food-friendly routes, choose meal/coffee stops that are likely open for the relevant time of day.
- If an included location may be closed, keep it only if appropriate and add a practical note or fallback.
- Mention closed-hours risk, uncertainty, or exterior-only use in notes.

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
  "routeStyle": "${routeStyle}",
  "includePoints": ${JSON.stringify(parsePoints(includePoints))},
  "excludePoints": ${JSON.stringify(parsePoints(excludePoints))}
}

Return ONLY valid JSON inside a single json code block.
Do not include any explanation before or after the code block.

{
  "title": "Short route title",
  "summary": "One or two sentence explanation of the route.",
  "estimatedDuration": "Realistic total route duration estimate",
  "distanceRisk": "low, medium, or high",
  "energyFit": "good, borderline, or poor",
  "openingHoursFit": "good, uncertain, exterior-only, or poor",
  "waypoints": [
  "Full searchable waypoint name, locality, city, state/region, country",
  "Another full searchable waypoint name, locality, city, state/region, country"
  ],
  "skipIfLate": [
    "Waypoint or stop to skip if short on time"
  ],
  "skipIfClosed": [
    "Waypoint or stop to skip if closed or inaccessible"
  ],
  "addIfAhead": [
    "Optional add-on if ahead of schedule"
  ],
  "notes": [
    "Useful practical note"
  ]
}
`.trim();

    const includeList = parsePoints(includePoints);
    const excludeList = parsePoints(excludePoints);
    const includeSection = includeList.length
      ? `\nInclude these locations if possible:\n- ${includeList.join("\n- ")}`
      : "";
    const excludeSection = excludeList.length
      ? `\nAvoid these locations if possible:\n- ${excludeList.join("\n- ")}`
      : "";

    setChatGptPrompt(`${prompt}${includeSection}${excludeSection}`.trim());
    setPromptStatus("Prompt ready.");
    setJsonInput("");
    setRoutePlan(null);
  }

  async function copyPrompt() {
    if (!chatGptPrompt) {
      setCopyStatus("Generate the AI prompt first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(chatGptPrompt);
      setCopyStatus("Prompt copied.");
    } catch {
      setCopyStatus("Could not copy automatically. Select and copy manually.");
    }
  }

  async function pasteJsonFromClipboard() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setJsonInput(clipboardText);
      setJsonStatus("AI JSON pasted.");
      setErrorMessage("");
    } catch {
      setJsonStatus("Could not read clipboard. Use Advanced / Debug to paste AI JSON manually.");
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
      setErrorMessage("Invalid AI JSON. Paste only the JSON response from your AI tool.");
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

    const includeList = parsePoints(includePoints);
    const excludeList = parsePoints(excludePoints);
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
        routeStyle,
        includePoints: includeList,
        excludePoints: excludeList
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
        routeStyle,
        includePoints: parsePoints(includePoints),
        excludePoints: parsePoints(excludePoints)
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
        <div style={appHeaderStyle}>
          <div style={appIconStyle}>
            <PinIcon size={18} />
          </div>
          <h1 style={appTitleStyle}>Route Planner</h1>
        </div>

        <div style={routeTypeRowStyle}>
          <div style={routeTypeLabelStyle}>Route Type</div>
          <div style={segmentedControlStyle}>
            <button
              type="button"
              style={{
                ...segmentButtonStyle,
                ...(routeType === "point" ? segmentButtonActiveStyle : {})
              }}
              onClick={() => {
                handleRouteTypeChange("point");
              }}
            >
              Point to Point
            </button>
            <button
              type="button"
              style={{
                ...segmentButtonStyle,
                ...(routeType === "loop" ? segmentButtonActiveStyle : {})
              }}
              onClick={() => {
                handleRouteTypeChange("loop");
              }}
            >
              Loop
            </button>
          </div>
        </div>

        <div style={locationRowStyle}>
          <label style={locationLabelStyle}>Start</label>
          <div style={locationInputWrapStyle}>
            <LocationAutocomplete
              placeholder="Enter start location"
              value={start}
              onChange={handleStartChange}
            />
          </div>
          <button
            type="button"
            style={iconButtonStyle}
            onClick={useCurrentLocation}
            aria-label="Use current location"
            title="Use current location"
          >
            <PinIcon size={16} />
          </button>
        </div>

        {locationStatus && <div style={statusStyle}>{locationStatus}</div>}

        {routeType === "point" && (
          <div style={locationRowStyle}>
            <label style={locationLabelStyle}>End</label>
            <div style={locationInputWrapStyle}>
              <LocationAutocomplete
                placeholder="Enter destination"
                value={end}
                onChange={(nextEnd) => {
                  setEnd(nextEnd);
                  setErrorMessage("");
                }}
              />
            </div>
            <button
              type="button"
              style={iconButtonStyle}
              onClick={swapStartEnd}
              aria-label="Swap start and end"
              title="Swap start and end"
            >
              ⇅
            </button>
          </div>
        )}

        <div style={locationRowStyle}>
          <label style={locationLabelStyle}>Include</label>
          <div style={locationInputWrapStyle}>
            <LocationAutocomplete
              placeholder="Enter include location"
              value={includePoints[0]}
              onChange={(nextValue) => {
                updatePoint(includePoints, setIncludePoints, 0, nextValue);
                setErrorMessage("");
              }}
            />
          </div>
          <button
            type="button"
            style={iconButtonStyle}
            onClick={() => addPoint(setIncludePoints)}
            title="Add include location"
          >
            +
          </button>
        </div>
        {includePoints.slice(1).map((point, index) => (
          <div key={`include-${index + 1}`} style={locationRowStyle}>
            <div style={{ flex: "0 0 78px" }} />
            <div style={locationInputWrapStyle}>
              <LocationAutocomplete
                placeholder="Enter include location"
                value={point}
                onChange={(nextValue) => {
                  updatePoint(includePoints, setIncludePoints, index + 1, nextValue);
                  setErrorMessage("");
                }}
              />
            </div>
            <button
              type="button"
              style={iconButtonStyle}
              onClick={() => removePoint(includePoints, setIncludePoints, index + 1)}
              aria-label="Remove include location"
              title="Remove include location"
            >
              −
            </button>
          </div>
        ))}

        <div style={locationRowStyle}>
          <label style={locationLabelStyle}>Exclude</label>
          <div style={locationInputWrapStyle}>
            <LocationAutocomplete
              placeholder="Enter exclude location"
              value={excludePoints[0]}
              onChange={(nextValue) => {
                updatePoint(excludePoints, setExcludePoints, 0, nextValue);
                setErrorMessage("");
              }}
            />
          </div>
          <button
            type="button"
            style={iconButtonStyle}
            onClick={() => addPoint(setExcludePoints)}
            title="Add exclude location"
          >
            +
          </button>
        </div>
        {excludePoints.slice(1).map((point, index) => (
          <div key={`exclude-${index + 1}`} style={locationRowStyle}>
            <div style={{ flex: "0 0 78px" }} />
            <div style={locationInputWrapStyle}>
              <LocationAutocomplete
                placeholder="Enter exclude location"
                value={point}
                onChange={(nextValue) => {
                  updatePoint(excludePoints, setExcludePoints, index + 1, nextValue);
                  setErrorMessage("");
                }}
              />
            </div>
            <button
              type="button"
              style={iconButtonStyle}
              onClick={() => removePoint(excludePoints, setExcludePoints, index + 1)}
              aria-label="Remove exclude location"
              title="Remove exclude location"
            >
              −
            </button>
          </div>
        ))}

        {routeType === "loop" && (
          <div style={infoBoxStyle}>
            Loop mode returns to the start location.
          </div>
        )}

        <div style={controlGridStyle}>
          <label style={fieldStyle}>
            <span style={compactLabelStyle}>Time</span>
            <select
              style={compactInputStyle}
              value={availableTime}
              onChange={(e) => setAvailableTime(e.target.value)}
            >
              <option value="1 hour">1 hour</option>
              <option value="2 hours">2 hours</option>
              <option value="3 hours">3 hours</option>
              <option value="half day">Half day</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={compactLabelStyle}>Mode</span>
            <select
              style={compactInputStyle}
              value={travelMode}
              onChange={(e) => setTravelMode(e.target.value)}
            >
              <option value="walking">Walking</option>
              <option value="driving">Driving</option>
            </select>
          </label>
        </div>

        <div style={controlGridStyle}>
          <label style={fieldStyle}>
            <span style={compactLabelStyle}>Energy</span>
            <select
              style={compactInputStyle}
              value={energyLevel}
              onChange={(e) => setEnergyLevel(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={compactLabelStyle}>Style</span>
            <select
              style={compactInputStyle}
              value={routeStyle}
              onChange={(e) => setRouteStyle(e.target.value)}
            >
              <option value="scenic">Scenic</option>
              <option value="historic">Historic</option>
              <option value="efficient">Efficient but interesting</option>
              <option value="food">Food-friendly</option>
            </select>
          </label>
        </div>

        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        <button style={primaryButtonStyle} onClick={generateChatGptPrompt}>
          Step 1: Generate AI Prompt
        </button>

        {promptStatus && <div style={statusStyle}>{promptStatus}</div>}

        <button style={secondaryButtonStyle} onClick={copyPrompt}>
          Step 2: Copy Prompt
        </button>

        {copyStatus && <div style={statusStyle}>{copyStatus}</div>}

        <div style={jsonPasteBoxStyle}>
          <div style={stepLabelStyle}>Step 3</div>
          <label style={compactLabelStyle} htmlFor="ai-json-input">
            Paste AI JSON
          </label>
          <textarea
            id="ai-json-input"
            style={jsonTextareaStyle}
            placeholder="Paste AI JSON here"
            value={jsonInput}
            rows={3}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setErrorMessage("");
            }}
          />
        </div>

        {jsonStatus && <div style={statusStyle}>{jsonStatus}</div>}

        <button style={finalButtonStyle} onClick={buildRouteFromJson}>
          Step 4: Build Route
        </button>

        <details style={detailsStyle}>
          <summary style={summaryStyle}>Advanced / Debug</summary>
          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Generated AI Prompt</h2>
            <textarea style={textareaStyle} value={chatGptPrompt} readOnly />
            <button style={secondaryButtonStyle} onClick={pasteJsonFromClipboard}>
              Paste AI JSON from Clipboard
            </button>
          </div>
        </details>

        <button style={sampleButtonStyle} onClick={generateSampleRoutePlan}>
          Use Sample Route Instead
        </button>

        {routePlan && (
          <div style={resultCardStyle}>
            <div style={resultHeaderStyle}>
              <h2 style={{ margin: 0 }}>{routePlan.title}</h2>
              <div style={badgeStyle}>
                {routePlan.summary.includes("sample") ? "Sample" : "AI"}
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
  background: "#fff7ed",
  padding: "12px",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "540px",
  margin: "0 auto",
  background: "white",
  borderRadius: "18px",
  padding: "16px",
  boxShadow: "0 14px 36px rgba(154, 52, 18, 0.1)",
  textAlign: "left"
};

const appHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "nowrap",
  marginBottom: "12px",
  textAlign: "left"
};

const appIconStyle = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  display: "grid",
  placeItems: "center",
  background: "#ffedd5",
  color: "#c2410c",
  flex: "0 0 auto"
};

const appTitleStyle = {
  margin: 0,
  fontSize: "22px",
  lineHeight: 1.1,
  textAlign: "right",
  flex: "0 0 auto",
  whiteSpace: "nowrap"
};

const routeTypeRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "12px"
};

const compactLabelStyle = {
  display: "block",
  color: "#444",
  fontSize: "13px",
  fontWeight: "700",
  marginBottom: "5px"
};

const routeTypeLabelStyle = {
  color: "#444",
  fontSize: "13px",
  fontWeight: "700",
  lineHeight: 1,
  flex: "0 0 auto"
};

const segmentedControlStyle = {
  display: "flex",
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "12px",
  padding: "3px",
  flex: "1 1 220px"
};

const segmentButtonStyle = {
  flex: 1,
  border: "none",
  borderRadius: "9px",
  padding: "7px 9px",
  background: "transparent",
  color: "#444",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer"
};

const segmentButtonActiveStyle = {
  background: "black",
  color: "white",
  boxShadow: "0 0 0 1px #fb923c"
};

const locationRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "10px"
};

const locationLabelStyle = {
  color: "#444",
  fontSize: "13px",
  fontWeight: "700",
  flex: "0 0 78px"
};

const locationInputWrapStyle = {
  flex: "1 1 180px",
  minWidth: "160px"
};

const locationFallbackInputStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e7d8c9",
  fontSize: "16px",
  boxSizing: "border-box"
};

const autocompleteContainerStyle = {
  position: "relative",
  textAlign: "left"
};

const iconButtonStyle = {
  width: "42px",
  height: "42px",
  border: "1px solid #fed7aa",
  borderRadius: "12px",
  background: "#fff7ed",
  color: "#c2410c",
  display: "inline-grid",
  placeItems: "center",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer",
  flex: "0 0 auto"
};

const controlGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
  marginBottom: "12px"
};

const fieldStyle = {
  display: "block",
  minWidth: 0
};

const compactInputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: "12px",
  border: "1px solid #e7d8c9",
  fontSize: "15px",
  boxSizing: "border-box",
  background: "white"
};

const textareaStyle = {
  width: "100%",
  minHeight: "180px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #e7d8c9",
  fontSize: "14px",
  boxSizing: "border-box",
  marginBottom: "12px",
  fontFamily: "monospace"
};

const jsonPasteBoxStyle = {
  marginBottom: "14px"
};

const stepLabelStyle = {
  color: "#9a3412",
  fontSize: "12px",
  fontWeight: "700",
  lineHeight: 1,
  marginBottom: "4px"
};

const jsonTextareaStyle = {
  ...textareaStyle,
  minHeight: "82px",
  maxHeight: "180px",
  resize: "vertical",
  marginBottom: 0
};

const primaryButtonStyle = {
  width: "100%",
  padding: "16px",
  background: "#ea580c",
  color: "white",
  border: "none",
  borderRadius: "14px",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer",
  marginBottom: "14px"
};

const finalButtonStyle = {
  ...primaryButtonStyle,
  background: "black"
};

const secondaryButtonStyle = {
  width: "100%",
  padding: "12px",
  background: "#f5f0eb",
  color: "black",
  border: "1px solid #e7d8c9",
  borderRadius: "12px",
  fontSize: "15px",
  marginBottom: "14px",
  cursor: "pointer"
};

const sampleButtonStyle = {
  width: "100%",
  padding: "14px",
  background: "#ffedd5",
  color: "#9a3412",
  border: "1px solid #fdba74",
  borderRadius: "14px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  marginBottom: "14px"
};

const panelStyle = {
  background: "#fffaf5",
  border: "1px solid #f1dfcf",
  borderRadius: "16px",
  padding: "16px",
  marginTop: "18px",
  marginBottom: "18px"
};

const panelTitleStyle = {
  marginTop: 0,
  fontSize: "20px"
};

const detailsStyle = {
  marginTop: "4px",
  marginBottom: "18px"
};

const summaryStyle = {
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "15px",
  marginBottom: "12px"
};

const statusStyle = {
  background: "#ecfdf3",
  border: "1px solid #bbf7d0",
  color: "#166534",
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  marginBottom: "10px",
  fontSize: "13px",
  lineHeight: 1.2
};

const errorStyle = {
  background: "#fee2e2",
  border: "1px solid #ef4444",
  color: "#991b1b",
  padding: "9px 10px",
  borderRadius: "12px",
  marginBottom: "12px",
  fontSize: "14px",
  fontWeight: "600"
};

const infoBoxStyle = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  padding: "9px 10px",
  borderRadius: "12px",
  marginBottom: "12px",
  fontSize: "14px"
};

const resultCardStyle = {
  marginTop: "28px",
  padding: "22px",
  borderRadius: "18px",
  background: "#fffaf5",
  border: "1px solid #f1dfcf"
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
  gap: "12px"
};

const badgeStyle = {
  background: "#ffedd5",
  color: "#9a3412",
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
  border: "1px solid #f1dfcf"
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
  border: "1px solid #f1dfcf",
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
  background: "black",
  color: "white",
  textDecoration: "none",
  borderRadius: "14px",
  fontWeight: "700"
};

export default App;

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

  function getSampleWaypoints() {
    if (routeType === "loop") {
      if (routeStyle === "scenic") {
        if (availableTime === "1 hour" || energyLevel === "low") {
          return [
            "Avenue Jean Médecin, Nice",
            "Place Masséna, Nice",
            "Boulevard Dubouchage, Nice"
          ];
        }

        if (availableTime === "2 hours" || energyLevel === "medium") {
          return [
            "Avenue Jean Médecin, Nice",
            "Place Masséna, Nice",
            "Promenade du Paillon, Nice",
            "Cours Saleya, Nice",
            "Boulevard Dubouchage, Nice"
          ];
        }

        return [
          "Avenue Jean Médecin, Nice",
          "Place Masséna, Nice",
          "Promenade des Anglais, Nice",
          "Castle Hill, Nice",
          "Old Town Nice",
          "Boulevard Dubouchage, Nice"
        ];
      }

      if (routeStyle === "historic") {
        return [
          "Basilique Notre-Dame de Nice",
          "Place Rossetti, Nice",
          "Cours Saleya, Nice",
          "Place Garibaldi, Nice"
        ];
      }

      if (routeStyle === "food") {
        return [
          "Cours Saleya Market, Nice",
          "Rue Bonaparte, Nice",
          "Liberation Market, Nice"
        ];
      }

      return [
        "Place Masséna, Nice",
        "Promenade du Paillon, Nice"
      ];
    }

    if (routeStyle === "historic") {
      return [
        "Place Rossetti, Nice",
        "Cours Saleya, Nice"
      ];
    }

    if (routeStyle === "food") {
      return [
        "Cours Saleya Market, Nice",
        "Place Rossetti, Nice"
      ];
    }

    if (routeStyle === "efficient") {
      return [
        "Promenade du Paillon, Nice"
      ];
    }

    return [
      "Promenade du Paillon, Nice",
      "Place Rossetti, Nice"
    ];
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

  function generateRoutePlan() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setRoutePlan(null);
      return;
    }

    setErrorMessage("");

    const waypoints = getSampleWaypoints();
    const destination = routeType === "loop" ? start : end;

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      start
    )}&destination=${encodeURIComponent(
      destination
    )}&travelmode=${travelMode}&waypoints=${encodeURIComponent(
      waypoints.join("|")
    )}`;

    const plan = {
      title:
        routeType === "loop"
          ? "Scenic Loop Route"
          : "Point-to-Point Route",

      summary:
        "Non-AI route generated from route type, time, energy level, and style.",

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
        {
          name: start,
          type: "Start"
        },

        ...waypoints.map((point) => ({
          name: point,
          type: "Waypoint"
        })),

        {
          name: destination,
          type: routeType === "loop" ? "Return" : "End"
        }
      ],

      googleMapsUrl
    };

    setRoutePlan(plan);
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={titleStyle}>Route Planner</h1>
          <p style={subtitleStyle}>
            Smart route generation with shaping points and loop routing.
          </p>
        </div>

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
            Loop mode attempts to create different outward and return corridors.
          </div>
        )}

        <label style={labelStyle}>Available Time</label>
        <select
          style={inputStyle}
          value={availableTime}
          onChange={(e) => {
            setAvailableTime(e.target.value);
            setRoutePlan(null);
          }}
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
          onChange={(e) => {
            setTravelMode(e.target.value);
            setRoutePlan(null);
          }}
        >
          <option value="walking">Walking</option>
          <option value="driving">Driving</option>
        </select>

        <label style={labelStyle}>Energy Level</label>
        <select
          style={inputStyle}
          value={energyLevel}
          onChange={(e) => {
            setEnergyLevel(e.target.value);
            setRoutePlan(null);
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <label style={labelStyle}>Route Style</label>
        <select
          style={inputStyle}
          value={routeStyle}
          onChange={(e) => {
            setRouteStyle(e.target.value);
            setRoutePlan(null);
          }}
        >
          <option value="scenic">Scenic</option>
          <option value="historic">Historic</option>
          <option value="efficient">Efficient but interesting</option>
          <option value="food">Food-friendly</option>
        </select>

        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        <button style={buttonStyle} onClick={generateRoutePlan}>
          Generate Route
        </button>

        {routePlan && (
          <div style={resultCardStyle}>
            <div style={resultHeaderStyle}>
              <h2 style={{ margin: 0 }}>{routePlan.title}</h2>
              <div style={badgeStyle}>Prototype</div>
            </div>

            <p style={resultSummaryStyle}>{routePlan.summary}</p>

            <div style={metaGridStyle}>
              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Time</div>
                <div>{routePlan.request.availableTime}</div>
              </div>

              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Mode</div>
                <div>{routePlan.request.travelMode}</div>
              </div>

              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Energy</div>
                <div>{routePlan.request.energyLevel}</div>
              </div>

              <div style={metaCardStyle}>
                <div style={metaLabelStyle}>Style</div>
                <div>{routePlan.request.routeStyle}</div>
              </div>
            </div>

            <h3 style={sectionTitleStyle}>Stops</h3>

            {routePlan.stops.map((stop, index) => (
              <div key={index} style={stopCardStyle}>
                <div style={stopTypeStyle}>{stop.type}</div>
                <div style={stopNameStyle}>{stop.name}</div>
              </div>
            ))}

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
  maxWidth: "520px",
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
  marginBottom: 0,
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

const buttonStyle = {
  width: "100%",
  padding: "16px",
  background: "black",
  color: "white",
  border: "none",
  borderRadius: "14px",
  fontSize: "16px",
  fontWeight: "700",
  cursor: "pointer"
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
  background: "#fafafa",
  border: "1px solid #e4e4e7"
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px"
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

const sectionTitleStyle = {
  marginBottom: "12px"
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
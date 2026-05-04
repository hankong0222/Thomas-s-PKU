import React, { useEffect, useMemo, useState } from "react";

const patientQueue = [
  { id: "PKU-1042", name: "Routine check", risk: "Stable", phe: 312, trend: "down" },
  { id: "PKU-1187", name: "Post meal", risk: "Watch", phe: 487, trend: "up" },
  { id: "PKU-1260", name: "Morning sample", risk: "Stable", phe: 268, trend: "flat" },
  { id: "PKU-1314", name: "Follow up", risk: "High", phe: 628, trend: "up" },
];

const timeline = [
  { label: "Mon", value: 330 },
  { label: "Tue", value: 360 },
  { label: "Wed", value: 315 },
  { label: "Thu", value: 420 },
  { label: "Fri", value: 390 },
  { label: "Sat", value: 345 },
  { label: "Sun", value: 305 },
];

const recentOutputs = [
  { time: "09:12", label: "Baseline capture", state: "Ready" },
  { time: "12:46", label: "Meal context added", state: "Review" },
  { time: "18:08", label: "Evening output", state: "Ready" },
];

const API_BASE_URL = "http://127.0.0.1:8787";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function App() {
  const [activePatient, setActivePatient] = useState(patientQueue[0]);
  const [captureState, setCaptureState] = useState("Choose input");
  const [menuFile, setMenuFile] = useState(null);
  const [menuPreviewUrl, setMenuPreviewUrl] = useState("");
  const [menuText, setMenuText] = useState("");
  const [ingredientFile, setIngredientFile] = useState(null);
  const [ingredientPreviewUrl, setIngredientPreviewUrl] = useState("");
  const [ingredientWeight, setIngredientWeight] = useState("");
  const [mealIngredients, setMealIngredients] = useState([]);
  const [calculation, setCalculation] = useState(null);
  const [substitute, setSubstitute] = useState(null);
  const [agentStatus, setAgentStatus] = useState("Waiting for image");
  const [agentError, setAgentError] = useState("");
  const [note, setNote] = useState("");
  const [page, setPage] = useState("dashboard");

  const averagePhe = useMemo(() => {
    const total = timeline.reduce((sum, item) => sum + item.value, 0);
    return Math.round(total / timeline.length);
  }, []);

  useEffect(() => {
    return () => {
      if (menuPreviewUrl) {
        URL.revokeObjectURL(menuPreviewUrl);
      }
    };
  }, [menuPreviewUrl]);

  useEffect(() => {
    return () => {
      if (ingredientPreviewUrl) {
        URL.revokeObjectURL(ingredientPreviewUrl);
      }
    };
  }, [ingredientPreviewUrl]);

  function goToCaptureHome() {
    setPage("dashboard");
    setCaptureState("Choose input");
  }

  function openMenuUpload() {
    setPage("menu-upload");
    setCaptureState("Menu upload");
  }

  function openIngredientUpload() {
    setPage("ingredients");
    setCaptureState("Ingredient entry");
  }

  function handleMenuFileChange(event) {
    const file = event.target.files?.[0];
    setMenuFile(file || null);

    if (menuPreviewUrl) {
      URL.revokeObjectURL(menuPreviewUrl);
    }

    if (file && file.type.startsWith("image/")) {
      setMenuPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setMenuPreviewUrl("");
  }

  function handleIngredientFileChange(event) {
    const file = event.target.files?.[0];
    setIngredientFile(file || null);

    if (ingredientPreviewUrl) {
      URL.revokeObjectURL(ingredientPreviewUrl);
    }

    if (file && file.type.startsWith("image/")) {
      setIngredientPreviewUrl(URL.createObjectURL(file));
      return;
    }

    setIngredientPreviewUrl("");
  }

  async function postJson(url, payload) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  async function calculateAndSuggest(nextIngredients) {
    const calculationPayload = await postJson("/api/pku/calculate", {
      ingredients: nextIngredients,
    });
    const nextCalculation = calculationPayload.calculation;
    setCalculation(nextCalculation);
    setMealIngredients(nextCalculation.ingredients || nextIngredients);

    if (nextCalculation.alert) {
      const substitutePayload = await postJson("/api/substitute/recommend", {
        ingredients: nextCalculation.ingredients || nextIngredients,
        calculation: nextCalculation,
      });
      setSubstitute(substitutePayload.substitute);
      return;
    }

    setSubstitute(null);
  }

  async function analyzeIngredient() {
    if (!ingredientFile || !ingredientWeight) {
      setAgentError("Upload an image and enter the total weight first.");
      return;
    }

    setAgentError("");
    setAgentStatus("Ingredient vision agent is analyzing");

    try {
      const payload = await postJson("/api/ingredients/analyze", {
        fileName: ingredientFile.name,
        imageDataUrl: await readFileAsDataUrl(ingredientFile),
        weightGrams: Number(ingredientWeight),
      });
      const nextIngredients = [...mealIngredients, payload.ingredient];
      setMealIngredients(nextIngredients);
      setAgentStatus(`Detected ${payload.ingredient.name}`);
      setIngredientFile(null);
      setIngredientWeight("");
      await calculateAndSuggest(nextIngredients);
    } catch (error) {
      setAgentError(error.message);
      setAgentStatus("Agent failed");
    }
  }

  async function deleteIngredient(ingredientId) {
    const nextIngredients = mealIngredients.filter((ingredient) => ingredient.id !== ingredientId);
    setMealIngredients(nextIngredients);
    setSubstitute(null);

    if (nextIngredients.length) {
      await calculateAndSuggest(nextIngredients);
      return;
    }

    setCalculation(null);
    setAgentStatus("Waiting for image");
  }

  async function confirmSubstitute() {
    if (!substitute) {
      return;
    }

    const nextIngredients = mealIngredients.map((ingredient) => {
      if (ingredient.id !== substitute.originalIngredientId) {
        return ingredient;
      }

      return {
        ...ingredient,
        name: substitute.name,
        phePer100g: substitute.phePer100g,
        phe: substitute.phe,
        substitutedFrom: substitute.originalName,
      };
    });

    setMealIngredients(nextIngredients);
    setSubstitute(null);
    setAgentStatus(`Confirmed substitute: ${substitute.name}`);
    await calculateAndSuggest(nextIngredients);
  }

  function renderCaptureHome() {
    return (
      <section className="capture-panel" id="capture" aria-label="Capture panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Capture</p>
            <h2>Choose meal input method</h2>
          </div>
          <span className="status-pill">{captureState}</span>
        </div>

        <div className="capture-method-grid">
          <button className="method-card" type="button" onClick={openMenuUpload}>
            <span className="method-icon">01</span>
            <strong>Upload menu</strong>
            <small>Use a menu photo or menu file, then review extracted meal items.</small>
          </button>

          <button className="method-card" type="button" onClick={openIngredientUpload}>
            <span className="method-icon">02</span>
            <strong>Ingredients + weights</strong>
            <small>Enter ingredients, weights, and serving context for direct PHE estimation.</small>
          </button>
        </div>

        <label className="notes-field">
          <span>Session note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Meal context, supplement intake, symptoms, or other notes"
          />
        </label>
      </section>
    );
  }

  function renderDashboardContent() {
    return (
      <>
        <section className="summary-grid" aria-label="PHE summary">
          <article className="summary-card">
            <span>Average PHE</span>
            <strong>{averagePhe}</strong>
            <small>umol/L over 7 days</small>
          </article>
          <article className="summary-card">
            <span>Samples</span>
            <strong>24</strong>
            <small>this week</small>
          </article>
          <article className="summary-card">
            <span>Pending review</span>
            <strong>3</strong>
            <small>need clinician check</small>
          </article>
        </section>

        <div className="content-grid">
          {renderCaptureHome()}

          <section className="trend-panel" aria-label="PHE trend">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Trend</p>
                <h2>Weekly PHE pattern</h2>
              </div>
            </div>

            <div className="bar-chart" aria-label="Weekly PHE bar chart">
              {timeline.map((item) => (
                <div className="bar-item" key={item.label}>
                  <span style={{ height: `${(item.value / 650) * 100}%` }} />
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="queue-panel" id="records" aria-label="Patient queue">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Queue</p>
                <h2>PKU records</h2>
              </div>
            </div>

            <div className="record-list">
              {patientQueue.map((patient) => (
                <button
                  className={patient.id === activePatient.id ? "record-row active" : "record-row"}
                  key={patient.id}
                  type="button"
                  onClick={() => setActivePatient(patient)}
                >
                  <span>
                    <strong>{patient.id}</strong>
                    <small>{patient.name}</small>
                  </span>
                  <span className={`risk risk-${patient.risk.toLowerCase()}`}>
                    {patient.risk}
                  </span>
                  <span className="phe-value">{patient.phe}</span>
                </button>
              ))}
            </div>
          </section>

          {renderOutputPanel()}
        </div>
      </>
    );
  }

  function renderMenuUploadPage() {
    return (
      <section className="detail-page" aria-label="Menu upload page">
        <div className="detail-header">
          <button className="quiet-button" type="button" onClick={goToCaptureHome}>
            Back to capture
          </button>
          <span className="status-pill">Menu upload</span>
        </div>

        <div className="detail-grid">
          <section className="detail-panel">
            <p className="eyebrow">Menu input</p>
            <h2>Upload a menu</h2>
            <div className="upload-zone">
              {menuPreviewUrl ? (
                <img src={menuPreviewUrl} alt="Selected menu preview" />
              ) : (
                <div className="upload-copy">
                  <strong>Drop menu photo or PDF here</strong>
                  <small>Supported now: JPG, PNG, WEBP, or PDF.</small>
                </div>
              )}
              <input
                id="menuFile"
                className="file-input"
                type="file"
                accept="image/*,.pdf"
                onChange={handleMenuFileChange}
              />
              <label className="primary-button file-button" htmlFor="menuFile">
                Choose file
              </label>
              {menuFile && (
                <p className="file-meta">
                  Selected: <strong>{menuFile.name}</strong>
                </p>
              )}
            </div>
          </section>

          <aside className="detail-panel">
            <p className="eyebrow">Manual menu</p>
            <h2>Type menu directly</h2>
            <label className="notes-field">
              <span>Menu text</span>
              <textarea
                value={menuText}
                onChange={(event) => setMenuText(event.target.value)}
                rows={8}
                placeholder="Example: low protein pasta, tomato sauce, fruit cup"
              />
            </label>
            <div className="preview-list">
              <div><strong>Low protein pasta</strong><span>Pending confirmation</span></div>
              <div><strong>Tomato sauce</strong><span>Needs serving size</span></div>
              <div><strong>Fruit cup</strong><span>Ready</span></div>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  function renderIngredientUploadPage() {
    const mealPhe = calculation?.mealPhe ?? 0;
    const dayPhe = calculation?.dayPhe ?? 220;
    const dailyLimit = calculation?.dailyPheLimit ?? 500;

    return (
      <section className="detail-page" aria-label="Ingredient and weight page">
        <div className="detail-header">
          <button className="quiet-button" type="button" onClick={goToCaptureHome}>
            Back to capture
          </button>
          <span className="status-pill">Ingredient entry</span>
        </div>

        <div className="detail-grid ingredients-layout">
          <section className="detail-panel">
            <p className="eyebrow">Direct input</p>
            <h2>Upload ingredients + weights</h2>

            <div className="upload-zone compact-upload">
              {ingredientPreviewUrl ? (
                <img src={ingredientPreviewUrl} alt="Selected ingredients preview" />
              ) : (
                <div className="upload-copy">
                  <strong>Upload ingredient image</strong>
                  <small>Use a plate, package label, or ingredient photo.</small>
                </div>
              )}
              <input
                id="ingredientFile"
                className="file-input"
                type="file"
                accept="image/*"
                onChange={handleIngredientFileChange}
              />
              <label className="primary-button file-button" htmlFor="ingredientFile">
                Choose image
              </label>
              {ingredientFile && (
                <p className="file-meta">
                  Selected: <strong>{ingredientFile.name}</strong>
                </p>
              )}
            </div>

            <label className="weight-field">
              <span>Total weight</span>
              <div>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={ingredientWeight}
                  onChange={(event) => setIngredientWeight(event.target.value)}
                  placeholder="Enter weight"
                />
                <strong>g</strong>
              </div>
            </label>

            <button
              className="primary-button"
              type="button"
              onClick={analyzeIngredient}
              disabled={!ingredientFile || !ingredientWeight}
            >
              Analyze ingredient
            </button>
            {agentError && <p className="error-text">{agentError}</p>}

            <div className="ingredient-table" role="table" aria-label="Ingredient weights">
              <div className="ingredient-row table-head" role="row">
                <span>Ingredient</span>
                <span>Weight</span>
                <span>PHE</span>
                <span>Action</span>
              </div>
              {mealIngredients.length === 0 && (
                <div className="empty-row">No ingredients added yet.</div>
              )}
              {mealIngredients.map((row) => (
                <div className="ingredient-row" role="row" key={row.id}>
                  <span>
                    {row.name}
                    {row.substitutedFrom && <small>Substituted from {row.substitutedFrom}</small>}
                  </span>
                  <span>{row.grams} g</span>
                  <span>{row.phe}</span>
                  <button className="text-button" type="button" onClick={() => deleteIngredient(row.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="detail-panel estimate-panel">
            <p className="eyebrow">AI workflow</p>
            <h2>Meal analysis</h2>
            <div className="agent-card">
              <span>Ingredient vision agent</span>
              <strong>{agentStatus}</strong>
            </div>

            <div className="output-card">
              <span>Current meal PHE</span>
              <strong>{mealPhe}</strong>
              <small>mg PHE, fake calculator</small>
            </div>

            <div className="calculator-grid">
              <div>
                <span>Day total</span>
                <strong>{dayPhe}</strong>
              </div>
              <div>
                <span>Daily limit</span>
                <strong>{dailyLimit}</strong>
              </div>
            </div>

            {calculation?.alert && (
              <div className="alert-card">
                <strong>PHE alert</strong>
                <span>{calculation.status}</span>
                <small>{calculation.note}</small>
              </div>
            )}

            {substitute && (
              <div className="substitute-card">
                <p className="eyebrow">Substitute agent</p>
                <h3>Replace {substitute.originalName}</h3>
                <strong>{substitute.name}</strong>
                <span>
                  Estimated PHE: {substitute.phe} mg for {substitute.grams} g
                </span>
                <small>{substitute.rationale}</small>
                <button className="primary-button" type="button" onClick={confirmSubstitute}>
                  Confirm substitute
                </button>
              </div>
            )}

            <div className="records-card">
              <span>Records</span>
              <strong>Single meal: {mealPhe} mg</strong>
              <strong>Today: {dayPhe} mg</strong>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  function renderOutputPanel() {
    return (
      <aside className="output-panel" aria-label="Output preview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Output</p>
            <h2>{activePatient.id}</h2>
          </div>
          <span className={`risk risk-${activePatient.risk.toLowerCase()}`}>
            {activePatient.risk}
          </span>
        </div>

        <div className="output-card">
          <span>Current estimate</span>
          <strong>{activePatient.phe}</strong>
          <small>umol/L</small>
        </div>

        <div className="timeline-list">
          {recentOutputs.map((item) => (
            <div className="timeline-row" key={`${item.time}-${item.label}`}>
              <span>{item.time}</span>
              <strong>{item.label}</strong>
              <small>{item.state}</small>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>PKU PHE</strong>
            <span>Tracker</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          <button className={page === "dashboard" ? "active" : ""} type="button" onClick={goToCaptureHome}>
            Dashboard
          </button>
          <button type="button" onClick={goToCaptureHome}>Capture</button>
          <button type="button" onClick={goToCaptureHome}>Records</button>
          <button type="button" onClick={goToCaptureHome}>Settings</button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">PHE monitoring workflow</p>
            <h1>{page === "dashboard" ? "Clinical capture dashboard" : "Capture input setup"}</h1>
          </div>
          <div className="header-actions">
            <button className="quiet-button" type="button">Export</button>
            <button className="primary-button" type="button" onClick={goToCaptureHome}>
              New session
            </button>
          </div>
        </header>

        {page === "dashboard" && renderDashboardContent()}
        {page === "menu-upload" && renderMenuUploadPage()}
        {page === "ingredients" && renderIngredientUploadPage()}
      </section>
    </main>
  );
}

export default App;

import http from "node:http";
import { analyzeIngredientImage } from "./agents/ingredientVisionAgent.js";
import { recommendSubstitute } from "./agents/substituteAgent.js";
import { calculatePkuMeal } from "./pkuCalculator.js";

const PORT = Number(process.env.PORT || 8787);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/health") {
      sendJson(response, 200, { ok: true, service: "pku-phe-backend" });
      return;
    }

    if (request.method === "POST" && request.url === "/api/ingredients/analyze") {
      const payload = await readJson(request);
      const ingredient = await analyzeIngredientImage(payload);
      sendJson(response, 200, { agent: "ingredient-vision-agent", ingredient });
      return;
    }

    if (request.method === "POST" && request.url === "/api/pku/calculate") {
      const payload = await readJson(request);
      const calculation = calculatePkuMeal(payload);
      sendJson(response, 200, { calculator: "fake-pku-calculator", calculation });
      return;
    }

    if (request.method === "POST" && request.url === "/api/substitute/recommend") {
      const payload = await readJson(request);
      const substitute = await recommendSubstitute(payload);
      sendJson(response, 200, { agent: "substitute-agent", substitute });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PKU PHE backend listening on http://127.0.0.1:${PORT}`);
});

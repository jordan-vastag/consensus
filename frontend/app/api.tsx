const API_BASE_URL = "http://localhost:8080/api";

async function startSession(payload: any) {
  console.log(`sending request to ${API_BASE_URL}/session`);
  const response = await fetch(`${API_BASE_URL}/session`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
}

export { startSession };

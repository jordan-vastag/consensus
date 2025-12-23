const API_BASE_URL = "http://localhost:8080/api";

async function startSession(payload: any) {
  const url = `${API_BASE_URL}/session/`;
  console.log(`POST ${API_BASE_URL}/session/`, payload);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
}

export { startSession };

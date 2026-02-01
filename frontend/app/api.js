const API_BASE_URL = "http://localhost:8080/api";

// TODO: URL encode member names when calling API

async function hostSession(payload) {
  const url = `${API_BASE_URL}/session/`;
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
  return response.json();
}

async function getSession(code) {
  const url = `${API_BASE_URL}/session/${code}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function joinSession(code, name) {
  const url = `${API_BASE_URL}/session/${code}/join`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name }),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function addChoice(code, memberName, title) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/choice`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function getMemberChoices(code, memberName) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/choice`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function removeChoice(code, memberName, title) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/choice/${encodeURIComponent(title)}`;
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function clearChoices(code, memberName) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/choice`;
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

export {
  addChoice,
  clearChoices,
  getMemberChoices,
  getSession,
  hostSession,
  joinSession,
  removeChoice,
};


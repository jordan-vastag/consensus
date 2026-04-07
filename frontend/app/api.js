const API_BASE_URL = "http://localhost:8080/api";

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

async function addChoice(code, memberName, payload) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/choice`;
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

async function searchTMDB(query, page = 1) {
  const url = `${API_BASE_URL}/integrations/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function updateChoice(code, memberName, oldTitle, title, comment) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/choice/${encodeURIComponent(oldTitle)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, comment }),
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

async function submitVotes(code, memberName, votes) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}/votes`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ votes }),
  });
  if (!response.ok) throw new Error(`Response status: ${response.status}`);
  return response.json();
}

async function updateSessionConfig(code, newConfig) {
  const url = `${API_BASE_URL}/session/${code}/config`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newConfig }),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function closeSession(code, name) {
  const url = `${API_BASE_URL}/session/${code}/close`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function leaveSession(code, name) {
  const url = `${API_BASE_URL}/session/${code}/leave`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function updateMember(code, memberName, newName) {
  const url = `${API_BASE_URL}/session/${code}/member/${encodeURIComponent(memberName)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ newName }),
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response.json();
}

async function getResults(permalinkId) {
  const url = `${API_BASE_URL}/results/${permalinkId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Response status: ${response.status}`);
  return response.json();
}

export {
  addChoice,
  clearChoices,
  closeSession,
  getMemberChoices,
  getResults,
  getSession,
  hostSession,
  joinSession,
  leaveSession,
  removeChoice,
  searchTMDB,
  submitVotes,
  updateChoice,
  updateMember,
  updateSessionConfig
};


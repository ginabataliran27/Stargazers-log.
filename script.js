const repositoryList = document.querySelector("#repository-list");
const repositoryStatus = document.querySelector("#repository-status");

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function validateRepository(repository, index) {
  const label = `Repository at position ${index + 1}`;
  if (!repository || typeof repository !== "object" || Array.isArray(repository)) {
    throw new Error(`${label} must be an object.`);
  }

  for (const field of ["name", "url", "description", "language", "starred_at"]) {
    if (typeof repository[field] !== "string") {
      throw new Error(`${label} is missing a valid ${field}.`);
    }
  }

  if (!repository.name.trim() || !repository.url.trim()) {
    throw new Error(`${label} must include a name and URL.`);
  }

  let url;
  try {
    url = new URL(repository.url);
  } catch {
    throw new Error(`${label} has an invalid URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} URL must use HTTPS.`);
  }

  const date = new Date(`${repository.starred_at}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(repository.starred_at) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== repository.starred_at
  ) {
    throw new Error(`${label} has an invalid starred_at date.`);
  }

  return repository;
}

function createRepositoryCard(repository) {
  const item = document.createElement("li");
  item.className = "repository-card";

  const heading = document.createElement("h3");
  const link = document.createElement("a");
  link.href = repository.url;
  link.textContent = repository.name;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  heading.append(link);

  const description = document.createElement("p");
  description.textContent = repository.description;

  const metadata = document.createElement("div");
  metadata.className = "repository-meta";

  const language = document.createElement("span");
  language.textContent = repository.language;

  const starredDate = document.createElement("span");
  starredDate.textContent = `Starred ${formatDate(repository.starred_at)}`;

  metadata.append(language, starredDate);
  item.append(heading, description, metadata);

  return item;
}

async function loadRepositories() {
  try {
    const response = await fetch("events.json");
    if (!response.ok) {
      throw new Error(`Could not load repositories (${response.status}).`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Repository data must be a list.");
    }

    const repositories = data.map(validateRepository);
    repositoryList.replaceChildren(...repositories.map(createRepositoryCard));
    repositoryStatus.textContent = repositories.length
      ? `${repositories.length} starred ${
          repositories.length === 1 ? "repository" : "repositories"
        } loaded.`
      : "No starred repositories yet.";
  } catch (error) {
    console.error("Failed to load starred repositories:", error);
    repositoryStatus.textContent =
      "Could not load repositories. Please try again later.";
  }
}

loadRepositories();

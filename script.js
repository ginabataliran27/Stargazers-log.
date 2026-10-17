const repositoryList = document.querySelector("#repository-list");
const repositoryStatus = document.querySelector("#repository-status");

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
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

    const repositories = await response.json();
    if (!Array.isArray(repositories)) {
      throw new Error("Repository data must be a list.");
    }

    repositoryList.replaceChildren(...repositories.map(createRepositoryCard));
    repositoryStatus.textContent = repositories.length
      ? ""
      : "No starred repositories yet.";
  } catch (error) {
    console.error("Failed to load starred repositories:", error);
    repositoryStatus.textContent =
      "Could not load repositories. Please try again later.";
  }
}

loadRepositories();

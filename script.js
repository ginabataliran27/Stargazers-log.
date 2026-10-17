const form = document.querySelector("#transaction-form");
const typeInput = document.querySelector("#transaction-type");
const categoryInput = document.querySelector("#transaction-category");
const receiptInput = document.querySelector("#receipt-input");
const receiptName = document.querySelector("#receipt-name");
const submitButton = form.querySelector('button[type="submit"]');
const formStatus = document.querySelector("#form-status");
const ledgerStatus = document.querySelector("#ledger-status");
const transactionList = document.querySelector("#transaction-list");
const ledgerCount = document.querySelector("#ledger-count");
const receiptLimit = 5 * 1024 * 1024;
const receiptObjectUrls = new Set();

let database;
let ledgerConfig;

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateConfig(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The ledger data must be an object.");
  }
  if (
    typeof data.currency !== "string" ||
    !Number.isFinite(data.opening_cash) ||
    data.opening_cash < 0 ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.transactions)
  ) {
    throw new Error("The ledger data is missing valid currency, opening cash, categories, or transactions.");
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: data.currency,
  });
  const categoryNames = new Set();
  for (const category of data.categories) {
    if (
      !category ||
      typeof category.name !== "string" ||
      !category.name.trim() ||
      !["income", "expense"].includes(category.type)
    ) {
      throw new Error("Each account category needs a name and a valid transaction type.");
    }
    const key = `${category.type}:${category.name}`;
    if (categoryNames.has(key)) {
      throw new Error(`Duplicate account category: ${category.name}.`);
    }
    categoryNames.add(key);
  }

  const transactionIds = new Set();
  for (const entry of data.transactions) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      transactionIds.has(entry.id) ||
      !isValidDate(entry.date) ||
      !["income", "expense"].includes(entry.type) ||
      typeof entry.category !== "string" ||
      !categoryNames.has(`${entry.type}:${entry.category}`) ||
      typeof entry.description !== "string" ||
      typeof entry.staff !== "string" ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0
    ) {
      throw new Error("The sample transaction data contains an invalid entry.");
    }
    transactionIds.add(entry.id);
  }

  return { ...data, formatter };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("expense-ledger-prototype", 1);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("transactions")) {
        db.createObjectStore("transactions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata");
      }
    });
    request.addEventListener("success", () => {
      request.result.addEventListener("versionchange", () => request.result.close());
      resolve(request.result);
    }, { once: true });
    request.addEventListener("error", () => {
      reject(request.error || new Error("Could not open browser storage."));
    }, { once: true });
    request.addEventListener("blocked", () => {
      reject(new Error("Browser storage is blocked by another open ledger tab. Close other tabs and reload."));
    }, { once: true });
  });
}

function waitForTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => {
      reject(transaction.error || new Error("The browser could not save the ledger data."));
    }, { once: true });
  });
}

async function seedSampleTransactions(db, entries) {
  const transaction = db.transaction(["transactions", "metadata"], "readwrite");
  const completed = waitForTransaction(transaction);
  const metadata = transaction.objectStore("metadata");
  const request = metadata.get("sample-data-loaded");
  request.addEventListener("success", () => {
    if (request.result !== true) {
      const store = transaction.objectStore("transactions");
      entries.forEach((entry) => store.put({ ...entry, receipt: null }));
      metadata.put(true, "sample-data-loaded");
    }
  }, { once: true });
  await completed;
}

async function readTransactions(db) {
  const transaction = db.transaction("transactions", "readonly");
  const completed = waitForTransaction(transaction);
  const request = transaction.objectStore("transactions").getAll();
  let entries;
  request.addEventListener("success", () => {
    entries = request.result;
  }, { once: true });
  await completed;
  return entries;
}

async function saveTransaction(db, entry) {
  const transaction = db.transaction("transactions", "readwrite");
  const completed = waitForTransaction(transaction);
  transaction.objectStore("transactions").add(entry);
  await completed;
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function updateCategoryOptions() {
  const selectedType = typeInput.value;
  const categories = ledgerConfig.categories.filter(
    (category) => category.type === selectedType,
  );
  categoryInput.replaceChildren(
    ...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category.name;
      option.textContent = category.name;
      return option;
    }),
  );
}

function createCell(className, text) {
  const cell = document.createElement("td");
  if (className) {
    cell.className = className;
  }
  cell.textContent = text;
  return cell;
}

function createTransactionRow(entry) {
  const row = document.createElement("tr");
  row.append(createCell("date-cell", formatDate(entry.date)));

  const description = createCell("description-cell", entry.description);
  if (entry.sample) {
    const sampleTag = document.createElement("span");
    sampleTag.className = "sample-tag";
    sampleTag.textContent = "Sample";
    description.append(sampleTag);
  }
  row.append(description);

  const categoryCell = document.createElement("td");
  const categoryTag = document.createElement("span");
  categoryTag.className = "category-tag";
  categoryTag.textContent = entry.category;
  categoryCell.append(categoryTag);
  row.append(categoryCell);
  row.append(createCell("staff-cell", entry.staff));

  const receiptCell = document.createElement("td");
  if (entry.receipt) {
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(entry.receipt.blob);
    receiptObjectUrls.add(objectUrl);
    link.className = "receipt-link";
    link.href = objectUrl;
    link.download = entry.receipt.name;
    link.textContent = "Download receipt";
    link.setAttribute("aria-label", `Download receipt ${entry.receipt.name}`);
    receiptCell.append(link);
  } else {
    receiptCell.textContent = "—";
  }
  row.append(receiptCell);

  const isExpense = entry.type === "expense";
  const amount = ledgerConfig.formatter.format(entry.amount);
  const amountCell = createCell(
    `amount-cell ${isExpense ? "amount-expense" : "amount-income"}`,
    `${isExpense ? "−" : "+"}${amount}`,
  );
  row.append(amountCell);
  return row;
}

function renderLedger(entries) {
  for (const objectUrl of receiptObjectUrls) {
    URL.revokeObjectURL(objectUrl);
  }
  receiptObjectUrls.clear();

  const sortedEntries = [...entries].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const totalIncome = entries.reduce(
    (total, entry) => total + (entry.type === "income" ? entry.amount : 0),
    0,
  );
  const totalExpenses = entries.reduce(
    (total, entry) => total + (entry.type === "expense" ? entry.amount : 0),
    0,
  );
  const cashOnHand = ledgerConfig.opening_cash + totalIncome - totalExpenses;

  document.querySelector("#total-income").textContent =
    ledgerConfig.formatter.format(totalIncome);
  document.querySelector("#total-expenses").textContent =
    ledgerConfig.formatter.format(totalExpenses);
  document.querySelector("#cash-on-hand").textContent =
    ledgerConfig.formatter.format(cashOnHand);
  document.querySelector("#opening-balance").textContent =
    ledgerConfig.formatter.format(ledgerConfig.opening_cash);
  ledgerCount.textContent = `${entries.length} ${
    entries.length === 1 ? "record" : "records"
  }`;

  if (sortedEntries.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = createCell("", "No transactions yet. Add a record above to get started.");
    cell.colSpan = 6;
    row.append(cell);
    transactionList.replaceChildren(row);
    return;
  }

  transactionList.replaceChildren(...sortedEntries.map(createTransactionRow));
}

function localDateValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "";

  const fields = new FormData(form);
  const amount = Number(fields.get("amount"));
  const description = String(fields.get("description")).trim();
  const staff = String(fields.get("staff")).trim();
  const date = String(fields.get("date"));
  const type = String(fields.get("type"));
  const category = String(fields.get("category"));
  const file = receiptInput.files[0];

  if (
    !isValidDate(date) ||
    !description ||
    !staff ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000_000
  ) {
    formStatus.textContent = "Enter a valid date, description, staff label, and positive amount.";
    return;
  }
  if (!ledgerConfig.categories.some((item) => item.name === category && item.type === type)) {
    formStatus.textContent = "Choose a valid account category for this transaction type.";
    return;
  }
  if (file && file.size > receiptLimit) {
    formStatus.textContent = "The receipt is larger than 5 MB. Choose a smaller image or PDF.";
    return;
  }
  if (file && !file.type.startsWith("image/") && file.type !== "application/pdf") {
    formStatus.textContent = "Receipts must be an image or PDF file.";
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    date,
    type,
    category,
    description,
    staff,
    amount,
    sample: false,
    receipt: file ? { name: file.name, blob: file } : null,
  };

  submitButton.disabled = true;
  try {
    await saveTransaction(database, entry);
    const entries = await readTransactions(database);
    renderLedger(entries);
    form.reset();
    form.elements.date.value = localDateValue(new Date());
    updateCategoryOptions();
    receiptName.textContent = "Optional · image or PDF, up to 5 MB";
    formStatus.textContent = "Transaction added.";
  } catch (error) {
    console.error("Failed to save transaction:", error);
    formStatus.textContent = "Could not save the transaction in this browser. Check available storage and try again.";
  } finally {
    submitButton.disabled = false;
  }
});

typeInput.addEventListener("change", updateCategoryOptions);
receiptInput.addEventListener("change", () => {
  const file = receiptInput.files[0];
  receiptName.textContent = file
    ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : "Optional · image or PDF, up to 5 MB";
});

async function loadLedger() {
  try {
    const response = await fetch("./events.json");
    if (!response.ok) {
      throw new Error(`Could not load sample ledger data (${response.status}).`);
    }

    ledgerConfig = validateConfig(await response.json());
    const currencySymbol = ledgerConfig.formatter
      .formatToParts(0)
      .find((part) => part.type === "currency");
    document.querySelector("#currency-symbol").textContent =
      currencySymbol ? currencySymbol.value : ledgerConfig.currency;
    updateCategoryOptions();
    form.elements.date.value = localDateValue(new Date());

    database = await openDatabase();
    await seedSampleTransactions(database, ledgerConfig.transactions);
    renderLedger(await readTransactions(database));
    ledgerStatus.textContent = "Ledger ready. Changes are saved in this browser only.";
    submitButton.disabled = false;
  } catch (error) {
    console.error("Failed to load the expense ledger:", error);
    ledgerStatus.textContent = "Could not load the ledger. Open the page through a web server and check browser storage permissions.";
    formStatus.textContent = "The ledger is unavailable until its data and browser storage can be loaded.";
  }
}

submitButton.disabled = true;
loadLedger();

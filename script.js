const STORAGE_KEY = "finanzasJhoel";

const defaultData = {
  targetIncome: 3300,
  budgets: [
    { id: "casa", name: "Casa y esenciales", percentage: 45 },
    { id: "crecimiento", name: "Crecimiento e inversiones", percentage: 25 },
    { id: "colchon", name: "Colchón financiero", percentage: 15 },
    { id: "diarios", name: "Gastos diarios", percentage: 15 }
  ],
  accounts: [],
  loans: [],
  payments: []
};

let data = loadData();

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultData,
      ...saved,
      budgets: saved.budgets || defaultData.budgets,
      accounts: saved.accounts || [],
      loans: saved.loans || [],
      payments: saved.payments || []
    };
  } catch (error) {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}

function money(value) {
  return "Bs " + Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function closeDialog(id) {
  document.getElementById(id).close();
}

function showSection(id) {
  document.querySelectorAll(".section").forEach(section => {
    section.classList.toggle("active", section.id === id);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.section === id);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

// EDICIÓN RÁPIDA DE SALDO EN CUENTAS
function quickEditBalance(id) {
  const account = data.accounts.find(a => a.id === id);
  if (!account) return;

  const input = prompt(`Editar saldo de ${account.name} (Bs):`, account.balance);
  if (input === null) return;

  const newBalance = Number(input);
  if (!Number.isFinite(newBalance) || newBalance < 0) {
    alert("Introduce un saldo válido.");
    return;
  }

  account.balance = round(newBalance);
  saveData();
}

// CUENTAS
function openAccountModal(id = null) {
  const form = document.getElementById("accountForm");
  form.reset();

  document.getElementById("accountId").value = "";
  document.getElementById("accountModalTitle").textContent = "Nueva cuenta";

  if (id) {
    const account = data.accounts.find(a => a.id === id);
    if (!account) return;

    document.getElementById("accountId").value = account.id;
    document.getElementById("accountName").value = account.name;
    document.getElementById("accountBalance").value = account.balance;
    document.getElementById("accountModalTitle").textContent = "Editar cuenta";
  }

  document.getElementById("accountDialog").showModal();
}

document.getElementById("accountForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = document.getElementById("accountId").value;
  const name = document.getElementById("accountName").value.trim();
  const balance = Number(document.getElementById("accountBalance").value);

  if (!name || !Number.isFinite(balance) || balance < 0) {
    alert("Revisa el nombre y el saldo de la cuenta.");
    return;
  }

  if (id) {
    const account = data.accounts.find(a => a.id === id);
    if (account) {
      account.name = name;
      account.balance = balance;
    }
  } else {
    data.accounts.push({
      id: uid(),
      name,
      balance
    });
  }

  closeDialog("accountDialog");
  saveData();
});

function deleteAccount(id) {
  const account = data.accounts.find(a => a.id === id);
  if (!account) return;

  const activeLoans = data.loans.some(l => l.accountId === id && l.remaining > 0);

  if (activeLoans) {
    alert("No puedes eliminar esta cuenta mientras tenga préstamos pendientes asociados.");
    return;
  }

  if (!confirm(`¿Eliminar la cuenta "${account.name}"?`)) return;

  data.accounts = data.accounts.filter(a => a.id !== id);
  saveData();
}

// TRANSFERENCIAS
function transferMoney(id) {
  const origin = data.accounts.find(a => a.id === id);
  if (!origin) return;

  const destinations = data.accounts.filter(a => a.id !== id);

  if (!destinations.length) {
    alert("Necesitas crear otra cuenta para realizar una transferencia.");
    return;
  }

  const amount = Number(prompt("¿Cuánto deseas transferir? (Bs)"));

  if (!Number.isFinite(amount) || amount <= 0) return;

  if (amount > origin.balance) {
    alert("No tienes suficiente saldo en esta cuenta.");
    return;
  }

  const options = destinations.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
  const choice = Number(prompt("Selecciona la cuenta de destino:\n" + options));

  const destination = destinations[choice - 1];

  if (!destination) {
    alert("Cuenta de destino no válida.");
    return;
  }

  origin.balance = round(origin.balance - amount);
  destination.balance = round(destination.balance + amount);

  saveData();
  alert("Transferencia realizada. Tu dinero total no ha cambiado.");
}

// PRÉSTAMOS
function openLoanModal() {
  if (!data.accounts.length) {
    alert("Primero debes crear una cuenta.");
    showSection("accounts");
    return;
  }

  const select = document.getElementById("loanAccount");

  select.innerHTML = data.accounts.map(a =>
    `<option value="${a.id}">${safe(a.name)} — ${money(a.balance)}</option>`
  ).join("");

  document.getElementById("loanForm").reset();
  document.getElementById("loanDate").value = localDate();

  document.getElementById("loanDialog").showModal();
}

document.getElementById("loanForm").addEventListener("submit", event => {
  event.preventDefault();

  const person = document.getElementById("loanPerson").value.trim();
  const accountId = document.getElementById("loanAccount").value;
  const amount = Number(document.getElementById("loanAmount").value);
  const account = data.accounts.find(a => a.id === accountId);

  if (!account || !person || !Number.isFinite(amount) || amount <= 0) {
    alert("Completa correctamente los datos del préstamo.");
    return;
  }

  if (amount > account.balance) {
    alert("El saldo de la cuenta no es suficiente para prestar esa cantidad.");
    return;
  }

  account.balance = round(account.balance - amount);

  data.loans.push({
    id: uid(),
    person,
    accountId,
    original: amount,
    remaining: amount,
    date: document.getElementById("loanDate").value,
    due: document.getElementById("loanDue").value,
    description: document.getElementById("loanDescription").value.trim(),
    repayments: []
  });

  closeDialog("loanDialog");
  saveData();
  alert("Préstamo registrado. El dinero se descontó de tu cuenta.");
});

function repayLoan(id) {
  const loan = data.loans.find(l => l.id === id);
  if (!loan || loan.remaining <= 0) return;

  const account = data.accounts.find(a => a.id === loan.accountId);

  if (!account) {
    alert("No se encuentra la cuenta asociada a este préstamo.");
    return;
  }

  const amount = Number(prompt(
    `La persona debe ${money(loan.remaining)}.\n¿Cuánto te devolvió?`
  ));

  if (!Number.isFinite(amount) || amount <= 0) return;

  if (amount > loan.remaining) {
    alert("La devolución no puede superar lo que todavía te debe.");
    return;
  }

  loan.remaining = round(loan.remaining - amount);
  loan.repayments.push({
    amount,
    date: localDate()
  });

  account.balance = round(account.balance + amount);

  saveData();
  alert("Devolución registrada. El dinero volvió a tu cuenta.");
}

function deleteLoan(id) {
  const loan = data.loans.find(l => l.id === id);
  if (!loan) return;

  if (loan.remaining > 0) {
    alert("Primero registra la devolución o recuperación del saldo pendiente.");
    return;
  }

  if (!confirm("¿Eliminar este préstamo ya saldado?")) return;

  data.loans = data.loans.filter(l => l.id !== id);
  saveData();
}

// PAGOS
function openPaymentModal() {
  document.getElementById("paymentForm").reset();
  document.getElementById("paymentDialog").showModal();
}

document.getElementById("paymentForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("paymentName").value.trim();
  const amount = Number(document.getElementById("paymentAmount").value || 0);

  data.payments.push({
    id: uid(),
    name,
    amount,
    due: document.getElementById("paymentDue").value,
    paid: false
  });

  closeDialog("paymentDialog");
  saveData();
});

function togglePayment(id, checked) {
  const payment = data.payments.find(p => p.id === id);
  if (!payment) return;

  payment.paid = checked;
  saveData();
}

function deletePayment(id) {
  if (!confirm("¿Eliminar este pago fijo?")) return;

  data.payments = data.payments.filter(p => p.id !== id);
  saveData();
}

// PRESUPUESTO
function saveTargetIncome() {
  const amount = Number(document.getElementById("targetIncome").value);

  if (!Number.isFinite(amount) || amount < 0) {
    alert("Introduce un ingreso válido.");
    return;
  }

  data.targetIncome = amount;
  saveData();
}

function saveBudgets() {
  const percentages = [...document.querySelectorAll(".budget-percent")].map(input => {
    return Number(input.value);
  });

  if (percentages.some(n => !Number.isFinite(n) || n < 0)) {
    alert("Todos los porcentajes deben ser números positivos.");
    return;
  }

  const total = percentages.reduce((a, b) => a + b, 0);

  if (Math.abs(total - 100) > 0.001) {
    alert(`Los porcentajes deben sumar 100%. Actualmente suman ${total}%.`);
    return;
  }

  data.budgets.forEach((budget, index) => {
    budget.percentage = percentages[index];
  });

  saveData();
  alert("Distribución guardada correctamente.");
}

function renderBudgetTable() {
  document.getElementById("targetIncome").value = data.targetIncome;

  const tbody = document.getElementById("budgetTable");

  tbody.innerHTML = data.budgets.map(budget => {
    const amount = data.targetIncome * budget.percentage / 100;

    return `
      <tr>
        <td>${safe(budget.name)}</td>
        <td>
          <input class="budget-percent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            inputmode="decimal"
            value="${budget.percentage}">
        </td>
        <td>${money(amount)}</td>
      </tr>
    `;
  }).join("");

  const percentage = data.budgets.reduce((sum, b) => sum + b.percentage, 0);

  document.getElementById("percentageTotal").textContent =
    `${Number(percentage.toFixed(2))}%`;

  document.getElementById("budgetTotal").textContent =
    money(data.targetIncome);

  const budgetHTML = data.budgets.map(budget => {
    const amount = data.targetIncome * budget.percentage / 100;

    return `
      <div class="budget-card">
        <div>
          <strong>${safe(budget.name)}</strong>
          <span>${budget.percentage}% de tu ingreso</span>
        </div>
        <strong>${money(amount)}</strong>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Math.min(100, budget.percentage)}%"></div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("dashboardBudget").innerHTML =
    budgetHTML || emptyState("Todavía no tienes una distribución.");
}

// UTILIDADES
function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function emptyState(message) {
  return `<div class="empty-state">${safe(message)}</div>`;
}

function totalBalance() {
  return data.accounts.reduce((sum, account) => sum + Number(account.balance), 0);
}

function totalLoans() {
  return data.loans.reduce((sum, loan) => sum + Number(loan.remaining), 0);
}

// RENDER CUENTAS
function renderAccounts() {
  const html = data.accounts.map(account => {
    const accountLoans = data.loans.filter(l => l.accountId === account.id);

    let loansHtml = "";
    if (accountLoans.length > 0) {
      loansHtml = `
        <div class="account-loans-section">
          <p style="font-size: 10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">Préstamos de esta cuenta:</p>
          ${accountLoans.map(l => `
            <div class="account-loan-item">
              <span><strong>${safe(l.person)}</strong>: ${money(l.remaining)} ${l.remaining <= 0 ? '(Saldado)' : ''}</span>
              <div style="display:flex; gap:4px;">
                ${l.remaining > 0 ? `<button class="mini-btn" onclick="repayLoan('${l.id}')">Devolución</button>` : `<button class="mini-btn danger" onclick="deleteLoan('${l.id}')">Borrar</button>`}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    return `
      <div class="account-card">
        <div class="account-header">
          <div>
            <h3>${safe(account.name)}</h3>
            <p>${accountLoans.length} préstamo(s) asociado(s)</p>
          </div>
          <div class="account-balance" title="Toca para editar saldo" onclick="quickEditBalance('${account.id}')">${money(account.balance)}</div>
        </div>

        ${loansHtml}

        <div class="card-actions">
          <button class="mini-btn" onclick="openAccountModal('${account.id}')">Editar</button>
          <button class="mini-btn" onclick="transferMoney('${account.id}')">Transferir</button>
          <button class="mini-btn danger" onclick="deleteAccount('${account.id}')">Eliminar cuenta</button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("accountsList").innerHTML =
    html || emptyState("Todavía no tienes cuentas. Añade efectivo, ahorros o banco.");

  document.getElementById("dashboardAccounts").innerHTML =
    html || emptyState("Añade tu primera cuenta para comenzar.");

  document.getElementById("accountCount").textContent = data.accounts.length;
}

// RENDER PRÉSTAMOS
function renderLoans() {
  const html = data.loans.map(loan => {
    const account = data.accounts.find(a => a.id === loan.accountId);
    const settled = loan.remaining <= 0;

    return `
      <div class="loan-card">
        <h3>${safe(loan.person)}</h3>
        <p>Salió de cuenta: ${safe(account?.name || "Cuenta no disponible")}</p>
        <p>Prestado: ${money(loan.original)}</p>
        <p>Fecha: ${safe(loan.date || "Sin fecha")}</p>
        ${loan.due ? `<p>Devolución prevista: ${safe(loan.due)}</p>` : ""}
        ${loan.description ? `<p>${safe(loan.description)}</p>` : ""}
        <strong>${settled ? "Préstamo saldado" : "Debe: " + money(loan.remaining)}</strong>
        <div class="loan-actions">
          ${!settled ? `<button class="mini-btn" onclick="repayLoan('${loan.id}')">Registrar devolución</button>` : ""}
          <button class="mini-btn danger" onclick="deleteLoan('${loan.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("allLoans").innerHTML =
    html || emptyState("Todavía no tienes préstamos registrados.");

  document.getElementById("loanTotal").textContent = money(totalLoans());
}

// RENDER PAGOS
function renderPayments() {
  const paid = data.payments.filter(p => p.paid).length;
  const pending = data.payments.length - paid;

  document.getElementById("paidCount").textContent = paid;
  document.getElementById("pendingCount").textContent = pending;

  const html = data.payments.map(payment => `
    <div class="payment-card ${payment.paid ? "done" : ""}">
      <input
        type="checkbox"
        ${payment.paid ? "checked" : ""}
        onchange="togglePayment('${payment.id}', this.checked)"
      >
      <div class="payment-info">
        <strong>${safe(payment.name)}</strong>
        <small>${payment.due ? "Vence: " + safe(payment.due) : "Sin fecha establecida"}</small>
      </div>
      <span class="payment-amount">${money(payment.amount)}</span>
      <button class="mini-btn danger" onclick="deletePayment('${payment.id}')">×</button>
    </div>
  `).join("");

  document.getElementById("paymentsList").innerHTML =
    html || emptyState("No tienes pagos fijos registrados. Añade tus pagos mensuales.");
}

// PANEL PRINCIPAL
function renderDashboard() {
  document.getElementById("totalBalance").textContent = money(totalBalance());
}

// RESPALDO JSON
function exportBackup() {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  downloadFile(blob, `finanzas-respaldo-${localDate()}.json`);
}

function importBackup() {
  document.getElementById("backupFile").click();
}

document.getElementById("backupFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());

    if (
      !Array.isArray(imported.accounts) ||
      !Array.isArray(imported.budgets) ||
      !Array.isArray(imported.loans) ||
      !Array.isArray(imported.payments)
    ) {
      throw new Error("Formato de respaldo incorrecto.");
    }

    if (!confirm("Esto reemplazará los datos actuales. ¿Deseas continuar?")) {
      event.target.value = "";
      return;
    }

    data = {
      ...defaultData,
      ...imported
    };

    saveData();
    alert("Respaldo restaurado correctamente.");
  } catch (error) {
    alert("No se pudo restaurar el archivo. Comprueba que sea un respaldo válido.");
  }

  event.target.value = "";
});

// EXPORTAR REPORTE ORDENADO A EXCEL (CSV COMPATIBLE CON CELDAS Y SECCIONES)
function exportExcelReport() {
  let rows = [];

  // SECCIÓN 1: RESUMEN GENERAL
  rows.push(["REPORTE FINANCIERO - JHOEL ENRIQUE"]);
  rows.push(["Fecha de exportacion:", localDate()]);
  rows.push(["Dinero Total en Cuentas (Bs):", totalBalance()]);
  rows.push(["Total Dinero Prestado (Bs):", totalLoans()]);
  rows.push(["Ingreso Mensual Previsto (Bs):", data.targetIncome]);
  rows.push([]);

  // SECCIÓN 2: CUENTAS
  rows.push(["--- MIS CUENTAS ---"]);
  rows.push(["Nombre de Cuenta", "Saldo Actual (Bs)"]);
  data.accounts.forEach(acc => {
    rows.push([acc.name, acc.balance]);
  });
  rows.push([]);

  // SECCIÓN 3: PRÉSTAMOS
  rows.push(["--- PRESTAMOS PENDIENTES Y SALDADOS ---"]);
  rows.push(["Persona", "Cuenta de Origen", "Monto Original (Bs)", "Saldo Pendiente (Bs)", "Fecha", "Vencimiento", "Estado"]);
  data.loans.forEach(l => {
    const acc = data.accounts.find(a => a.id === l.accountId);
    rows.push([
      l.person,
      acc ? acc.name : "Desconocida",
      l.original,
      l.remaining,
      l.date,
      l.due || "Sin fecha",
      l.remaining <= 0 ? "Saldado" : "Pendiente"
    ]);
  });
  rows.push([]);

  // SECCIÓN 4: DISTRIBUCIÓN MENSUAL
  rows.push(["--- DISTRIBUCION MENSUAL ---"]);
  rows.push(["Destino", "Porcentaje (%)", "Monto Calculado (Bs)"]);
  data.budgets.forEach(b => {
    const amount = (data.targetIncome * b.percentage) / 100;
    rows.push([b.name, b.percentage + "%", amount]);
  });
  rows.push([]);

  // SECCIÓN 5: PAGOS FIJOS
  rows.push(["--- PAGOS Y PENDIENTES ---"]);
  rows.push(["Nombre del Pago", "Monto (Bs)", "Vencimiento", "Estado Actual"]);
  data.payments.forEach(p => {
    rows.push([
      p.name,
      p.amount,
      p.due || "Sin fecha",
      p.paid ? "Pagado" : "Pendiente"
    ]);
  });

  // CONVERTIR A CSV CON SEPARADOR DE PUNTO Y COMA (EXCEL EN ESPAÑOL LO LEE PERFECTO)
  const csvContent = rows.map(row =>
    row.map(val => `"${String(val ?? "").replace(/"/g, '""')}"`).join(";")
  ).join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  downloadFile(blob, `reporte-finanzas-${localDate()}.csv`);
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ACTUALIZACIÓN GENERAL
function renderAll() {
  renderDashboard();
  renderAccounts();
  renderLoans();
  renderBudgetTable();
  renderPayments();
}

// INICIO
renderAll();
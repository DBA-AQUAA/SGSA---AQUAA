(() => {
  "use strict";

  const CONFIG = Object.freeze({
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbzV21JNPxd3ojDf28YdEe67vVExuUho6jBRX7vS-CpiC1wrVCmsyvONTdlZWLt7X6Z_/exec",
    requestTimeoutMs: 30000,
    maxSearchResults: 60
  });

  const state = { selectedProduct: null, products: [], isSubmitting: false };
  const elements = {};
  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    if (!isCatalogValid(window.SGSA_CATALOG)) {
      showStatus("No fue posible cargar el catálogo de materiales.", "error");
      disableForm();
      return;
    }
    populateCategories();
    bindEvents();
    renderTable();
    updateNotesCounter();
  }

  function cacheElements() {
    ["requestForm","category","productSearch","productResults","quantity","unit","addProductBtn",
      "productsTableBody","productsTableWrapper","emptyProducts","productError","notes","notesCount",
      "confirmation","submitStatus","submitBtn","successTemplate"].forEach((id) => elements[id] = $(id));
  }

  function bindEvents() {
    elements.category.addEventListener("change", handleCategoryChange);
    elements.productSearch.addEventListener("input", renderSearchResults);
    elements.productSearch.addEventListener("focus", renderSearchResults);
    elements.productSearch.addEventListener("keydown", handleSearchKeydown);
    elements.addProductBtn.addEventListener("click", addProduct);
    elements.productsTableBody.addEventListener("click", removeProduct);
    elements.notes.addEventListener("input", updateNotesCounter);
    elements.requestForm.addEventListener("reset", resetFormState);
    elements.requestForm.addEventListener("submit", submitRequest);
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".product-search-field")) closeSearchResults();
    });
  }

  function populateCategories() {
    Object.keys(window.SGSA_CATALOG).sort((a,b) => a.localeCompare(b,"es-MX")).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      elements.category.appendChild(option);
    });
  }

  function handleCategoryChange() {
    state.selectedProduct = null;
    elements.productSearch.value = "";
    elements.unit.value = "";
    elements.productSearch.disabled = !elements.category.value;
    elements.productSearch.placeholder = elements.category.value ? "Escriba para buscar un material..." : "Seleccione primero una categoría";
    closeSearchResults();
    hideProductError();
  }

  function handleSearchKeydown(event) {
    if (event.key === "Escape") closeSearchResults();
    if (event.key === "Enter" && state.selectedProduct) {
      event.preventDefault();
      elements.quantity.focus();
    }
  }

  function renderSearchResults() {
    if (!elements.category.value) return;
    state.selectedProduct = null;
    const term = normalize(elements.productSearch.value);
    const catalog = window.SGSA_CATALOG[elements.category.value] || [];
    const matches = catalog.filter((product) => normalize(`${product.name} ${product.id}`).includes(term)).slice(0, CONFIG.maxSearchResults);
    elements.productResults.replaceChildren();

    if (!matches.length) {
      const message = document.createElement("div");
      message.className = "result-empty";
      message.textContent = "No se encontraron materiales.";
      elements.productResults.appendChild(message);
    } else {
      matches.forEach((product) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "result-item";
        button.setAttribute("role", "option");
        button.innerHTML = `<strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.id)} · ${escapeHtml(product.unit || "SIN UNIDAD")}</small>`;
        button.addEventListener("click", () => selectProduct(product));
        elements.productResults.appendChild(button);
      });
    }
    elements.productResults.hidden = false;
    elements.productSearch.setAttribute("aria-expanded", "true");
  }

  function selectProduct(product) {
    state.selectedProduct = product;
    elements.productSearch.value = product.name;
    elements.unit.value = "";
    closeSearchResults();
    hideProductError();
    elements.quantity.focus();
  }

  function closeSearchResults() {
    elements.productResults.hidden = true;
    elements.productSearch.setAttribute("aria-expanded", "false");
  }

  function addProduct() {
    hideMessages();
    const quantity = Number(elements.quantity.value);
    if (!elements.category.value) return showProductError("Seleccione una categoría.");
    if (!state.selectedProduct) return showProductError("Seleccione un material de la lista.");
    if (!Number.isFinite(quantity) || quantity <= 0) return showProductError("Capture una cantidad mayor que cero.");
    const unit = cleanText(elements.unit.value);
    if (!unit) {
      elements.unit.focus();
      return showProductError("Escriba la unidad de medida, por ejemplo: pieza, caja o litro.");
    }
    if (state.products.some((item) => item.productId === state.selectedProduct.id)) return showProductError("Ese material ya fue agregado a la solicitud.");

    state.products.push({
      productId: state.selectedProduct.id,
      productName: state.selectedProduct.name,
      category: elements.category.value,
      quantity,
      unit
    });
    resetProductBuilder();
    renderTable();
    elements.productSearch.focus();
  }

  function resetProductBuilder() {
    state.selectedProduct = null;
    elements.productSearch.value = "";
    elements.quantity.value = "";
    elements.unit.value = "";
    closeSearchResults();
  }

  function removeProduct(event) {
    const button = event.target.closest(".remove-button");
    if (!button || state.isSubmitting) return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.products.length) return;
    state.products.splice(index, 1);
    renderTable();
  }

  function renderTable() {
    elements.productsTableBody.replaceChildren();
    state.products.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td><strong>${escapeHtml(item.productName)}</strong><br><small>${escapeHtml(item.productId)}</small></td>
        <td>${escapeHtml(item.category)}</td><td>${formatQuantity(item.quantity)}</td><td>${escapeHtml(item.unit)}</td>
        <td><button type="button" class="remove-button" data-index="${index}" aria-label="Eliminar ${escapeHtml(item.productName)}">Eliminar</button></td>`;
      elements.productsTableBody.appendChild(row);
    });
    const hasProducts = state.products.length > 0;
    elements.productsTableWrapper.hidden = !hasProducts;
    elements.emptyProducts.hidden = hasProducts;
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (state.isSubmitting) return;
    hideMessages();
    clearFieldErrors();

    const firstInvalid = validateMainFields();
    if (firstInvalid) return focusInvalidField(firstInvalid);
    if (!state.products.length) {
      showProductError("Agregue al menos un material a la solicitud.");
      elements.emptyProducts.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!elements.confirmation.checked) {
      showStatus("Confirme que los datos capturados son correctos.", "error");
      elements.confirmation.focus();
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    try {
      const response = await fetch(CONFIG.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(buildPayload()),
        signal: controller.signal,
        redirect: "follow"
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.ok) throw new Error(result.message || result.mensaje || "El servidor rechazó la solicitud.");
      showSuccessModal(result.folio);
    } catch (error) {
      const message = error.name === "AbortError"
        ? "La solicitud tardó demasiado. Revise su conexión e intente nuevamente."
        : `No fue posible enviar la solicitud. ${error.message || "Intente nuevamente."}`;
      showStatus(message.trim(), "error");
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  function buildPayload() {
    return {
      nombre: cleanText($("fullName").value),
      correo: cleanText($("email").value).toLowerCase(),
      area: cleanText($("area").value),
      sucursal: cleanText($("branch").value),
      observaciones: cleanText(elements.notes.value),
      productos: state.products.map((item) => ({
        codigo: item.productId,
        categoria: item.category,
        material: item.productName,
        cantidad: item.quantity,
        unidad: item.unit
      }))
    };
  }

  async function parseJsonResponse(response) {
    const text = await response.text();
    try { return JSON.parse(text); }
    catch { throw new Error("El servidor devolvió una respuesta no válida."); }
  }

  function validateMainFields() {
    const rules = [
      { id: "fullName", message: "Capture el nombre completo." },
      { id: "email", message: "Capture un correo electrónico válido." },
      { id: "area", message: "Seleccione un área." },
      { id: "branch", message: "Seleccione una sucursal." }
    ];
    let firstInvalid = null;
    rules.forEach(({id,message}) => {
      const field = $(id);
      const invalid = !field.checkValidity() || !cleanText(field.value);
      field.setAttribute("aria-invalid", String(invalid));
      if (invalid) { setFieldError(id, message); firstInvalid ||= field; }
    });
    return firstInvalid;
  }

  function focusInvalidField(field) {
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => field.focus(), 250);
  }

  function resetFormState() {
    window.setTimeout(() => {
      state.products = [];
      state.selectedProduct = null;
      state.isSubmitting = false;
      elements.productSearch.disabled = true;
      elements.productSearch.placeholder = "Seleccione primero una categoría";
      elements.notesCount.textContent = "0";
      closeSearchResults();
      hideMessages();
      clearFieldErrors();
      renderTable();
    }, 0);
  }

  function updateNotesCounter() { elements.notesCount.textContent = String(elements.notes.value.length); }

  function showSuccessModal(folio) {
    const fragment = elements.successTemplate.content.cloneNode(true);
    fragment.getElementById("generatedFolio").textContent = folio || "Sin folio";
    const backdrop = fragment.querySelector(".modal-backdrop");
    const closeButton = fragment.getElementById("closeModalBtn");
    const closeModal = () => {
      document.removeEventListener("keydown", handleEscape);
      backdrop.remove();
      document.body.classList.remove("modal-open");
      elements.requestForm.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const handleEscape = (event) => { if (event.key === "Escape") closeModal(); };
    closeButton.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(); });
    document.addEventListener("keydown", handleEscape);
    document.body.appendChild(fragment);
    document.body.classList.add("modal-open");
    $("closeModalBtn").focus();
  }

  function setLoading(active) {
    state.isSubmitting = active;
    elements.submitBtn.disabled = active;
    elements.addProductBtn.disabled = active;
    elements.submitBtn.setAttribute("aria-busy", String(active));
    elements.submitBtn.querySelector(".spinner").hidden = !active;
    elements.submitBtn.querySelector(".submit-label").textContent = active ? "Enviando..." : "Enviar solicitud";
  }
  function showProductError(message) { elements.productError.textContent = message; elements.productError.hidden = false; }
  function hideProductError() { elements.productError.hidden = true; elements.productError.textContent = ""; }
  function showStatus(message, type = "success") { elements.submitStatus.textContent = message; elements.submitStatus.classList.toggle("error", type === "error"); elements.submitStatus.hidden = false; }
  function hideMessages() { hideProductError(); elements.submitStatus.hidden = true; elements.submitStatus.textContent = ""; }
  function setFieldError(id, message) { const node = document.querySelector(`[data-error-for="${id}"]`); if (node) node.textContent = message; }
  function clearFieldErrors() { document.querySelectorAll("[data-error-for]").forEach((node) => node.textContent = ""); document.querySelectorAll("[aria-invalid]").forEach((field) => field.setAttribute("aria-invalid", "false")); }
  function disableForm() { elements.requestForm.querySelectorAll("input,select,textarea,button").forEach((control) => control.disabled = true); }
  function isCatalogValid(catalog) { return catalog && typeof catalog === "object" && !Array.isArray(catalog) && Object.keys(catalog).length > 0; }
  function cleanText(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function formatQuantity(value) { return Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 }); }
  function escapeHtml(value) { return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
})();

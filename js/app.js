(() => {
  "use strict";

  const CONFIG = Object.freeze({
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbxC34aWotlhblyyP6quSFoEBJA273c0b3gchD_rKcmWeLIADhsQi4WjPEgKwPOScref/exec",
    requestTimeoutMs: 30000,
    maxProducts: 90
  });

  const state = {
    selectedProduct: null,
    products: [],
    specificMaterials: [],
    isSubmitting: false
  };

  const elements = {};
  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  /*
  function init() {
    cacheElements();

    if (!hasRequiredElements()) {
      console.error("SGSA: faltan elementos requeridos en index.html.");
      return;
    }

    if (!isCatalogValid(window.SGSA_CATALOG)) {
      showStatus("No fue posible cargar el catálogo de materiales.", "error");
      disableForm();
      return;
    }

    if (!isGeneralCatalogValid(window.SGSA_GENERAL_CATALOGS)) {
      showStatus("No fue posible cargar los catálogos generales.", "error");
      disableForm();
      return;
    }

    populateGeneralCatalogs();
    populateCategories();
    bindEvents();
    renderTable();
    updateReasonCounter();
    renderSpecificMaterialsTable();
  }
*/
  async function init() {
    cacheElements();

    if (!hasRequiredElements()) {
      console.error("SGSA: faltan elementos requeridos en index.html.");
      return;
    }

    try {
      window.SGSA_CATALOG = await cargarCatalogoDesdeServidor();
    } catch (error) {
      console.error(
        "SGSA: no fue posible cargar el catálogo.",
        error
      );

      showStatus(
        "No fue posible cargar el catálogo de materiales. Intente recargar la página.",
        "error"
      );

      disableForm();
      return;
    }

    if (!isCatalogValid(window.SGSA_CATALOG)) {
      showStatus(
        "El catálogo de materiales está vacío o no es válido.",
        "error"
      );

      disableForm();
      return;
    }

    if (!isGeneralCatalogValid(window.SGSA_GENERAL_CATALOGS)) {
      showStatus(
        "No fue posible cargar los catálogos generales.",
        "error"
      );

      disableForm();
      return;
    }

    populateGeneralCatalogs();
    populateCategories();
    bindEvents();
    renderTable();
    updateReasonCounter();
    renderSpecificMaterialsTable();
  }
  /*
  */
  async function cargarCatalogoDesdeServidor() {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeoutMs
    );

    try {
      const url = new URL(CONFIG.appsScriptUrl);

      url.searchParams.set(
        "accion",
        "catalogo"
      );

      const response = await fetch(
        url.toString(),
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          redirect: "follow"
        }
      );

      const result = await parseJsonResponse(response);

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ||
          result.mensaje ||
          "El servidor rechazó la consulta del catálogo."
        );
      }

      if (!isCatalogValid(result.catalogo)) {
        throw new Error(
          "El servidor devolvió un catálogo vacío o no válido."
        );
      }

      return result.catalogo;

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "La consulta del catálogo tardó demasiado."
        );
      }

      throw error;

    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function cacheElements() {
    [
      "requestForm",
      "fullName",
      "email",
      "area",
      "branch",
      "reason",
      "reasonCountValue",
      "category",
      "productSearch",
      "productResults",
      "quantity",
      "unit",
      "addProductBtn",
      "productsTableBody",
      "productsTableWrapper",
      "emptyProducts",
      "productError",
      "specificMaterial",
      "specificQuantity",
      "specificUnit",
      "specificObservations",
      "addSpecificMaterialBtn",
      "specificMaterialMessage",
      "specificMaterialsTableBody",
      "specificMaterialsTableWrapper",
      "emptySpecificMaterials",
      "confirmation",
      "submitStatus",
      "submitBtn",
      "successTemplate"
    ].forEach((id) => {
      elements[id] = $(id);
    });
  }

  function hasRequiredElements() {
    return Object.values(elements).every(Boolean);
  }

  function bindEvents() {
    elements.category.addEventListener("change", handleCategoryChange);
    elements.productSearch.addEventListener("input", renderSearchResults);
    elements.productSearch.addEventListener("focus", renderSearchResults);
    elements.productSearch.addEventListener("keydown", handleSearchKeydown);
    elements.addProductBtn.addEventListener("click", addProduct);
    elements.productsTableBody.addEventListener("click", removeProduct);
    elements.reason.addEventListener("input", updateReasonCounter);
    elements.addSpecificMaterialBtn.addEventListener("click", addSpecificMaterial);
    elements.specificMaterialsTableBody.addEventListener("click", removeSpecificMaterial);
    elements.requestForm.addEventListener("reset", resetFormState);
    elements.requestForm.addEventListener("submit", submitRequest);

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".product-search-field")) {
        closeSearchResults();
      }
    });
  }

  function populateGeneralCatalogs() {
    populateSelect(elements.area, window.SGSA_GENERAL_CATALOGS.areas);
    populateSelect(elements.branch, window.SGSA_GENERAL_CATALOGS.sucursales);
    populateSelect(elements.unit, window.SGSA_GENERAL_CATALOGS.unidades);
    populateSelect(elements.specificUnit, window.SGSA_GENERAL_CATALOGS.unidades);
  }

  function populateSelect(selectElement, values) {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });
  }

  function populateCategories() {
    Object.keys(window.SGSA_CATALOG)
      .sort((a, b) => a.localeCompare(b, "es-MX"))
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        elements.category.appendChild(option);
      });
  }

  function handleCategoryChange() {
    state.selectedProduct = null;
    elements.productSearch.value = "";
    elements.quantity.value = "";
    elements.unit.value = "";
    elements.productSearch.disabled = !elements.category.value;
    elements.productSearch.placeholder = elements.category.value
      ? "Escriba para buscar un material..."
      : "Seleccione primero una categoría";
    closeSearchResults();
    hideProductError();
  }

  function handleSearchKeydown(event) {
    if (event.key === "Escape") {
      closeSearchResults();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (state.selectedProduct) {
        elements.quantity.focus();
        return;
      }

      const firstResult = elements.productResults.querySelector(".result-item");
      if (firstResult) firstResult.click();
    }
  }

  function renderSearchResults() {
    if (!elements.category.value) return;

    state.selectedProduct = null;
    const term = normalize(elements.productSearch.value);

    const catalog = [
      ...(window.SGSA_CATALOG[elements.category.value] || [])
    ].sort((a, b) =>
      String(a.name || "").localeCompare(
        String(b.name || ""),
        "es-MX",
        {
          sensitivity: "base",
          numeric: true
        }
      )
    );

    const matches = catalog.filter((product) =>
      normalize(`${product.name} ${product.id}`).includes(term)
    );

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

    if (!elements.category.value) {
      elements.category.focus();
      return showProductError("Seleccione una categoría.");
    }

    if (!state.selectedProduct) {
      elements.productSearch.focus();
      return showProductError("Seleccione un material de la lista de resultados.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      elements.quantity.focus();
      return showProductError("Capture una cantidad entera mayor que cero.");
    }

    const unit = cleanText(elements.unit.value);
    if (!unit) {
      elements.unit.focus();
      return showProductError("Seleccione una unidad de medida.");
    }

    if (state.products.some((item) => item.productId === state.selectedProduct.id)) {
      return showProductError("Ese material ya fue agregado a la solicitud.");
    }

    if (getTotalProductCount() >= CONFIG.maxProducts) {
      return showProductError(`La solicitud permite un máximo de ${CONFIG.maxProducts} productos.`);
    }

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

  function addSpecificMaterial() {
    hideMessages();

    const material = cleanText(elements.specificMaterial.value);
    const quantity = Number(elements.specificQuantity.value);
    const unit = cleanText(elements.specificUnit.value);
    const observations = cleanText(elements.specificObservations.value);

    if (!material) {
      elements.specificMaterial.focus();
      return showSpecificMaterialMessage("Capture el nombre del material.", "error");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      elements.specificQuantity.focus();
      return showSpecificMaterialMessage("Capture una cantidad entera mayor que cero.", "error");
    }

    if (!unit) {
      elements.specificUnit.focus();
      return showSpecificMaterialMessage("Seleccione una unidad de medida.", "error");
    }

    if (getTotalProductCount() >= CONFIG.maxProducts) {
      return showSpecificMaterialMessage(`La solicitud permite un máximo de ${CONFIG.maxProducts} productos.`, "error");
    }

    const normalizedMaterial = normalize(material);
    const isDuplicate = state.specificMaterials.some(
      (item) => normalize(item.material) === normalizedMaterial
    ) || state.products.some(
      (item) => normalize(item.productName) === normalizedMaterial
    );

    state.specificMaterials.push({ material, quantity, unit, observations });
    resetSpecificMaterialBuilder();
    renderSpecificMaterialsTable();

    if (isDuplicate) {
      showSpecificMaterialMessage("Advertencia: este material ya aparece en la solicitud. Verifique si desea conservar ambas partidas.", "warning");
    }

    elements.specificMaterial.focus();
  }

  function resetSpecificMaterialBuilder() {
    elements.specificMaterial.value = "";
    elements.specificQuantity.value = "";
    elements.specificUnit.value = "";
    elements.specificObservations.value = "";
  }

  function removeSpecificMaterial(event) {
    const button = event.target.closest(".remove-specific-button");
    if (!button || state.isSubmitting) return;

    const index = Number(button.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.specificMaterials.length) return;

    state.specificMaterials.splice(index, 1);
    renderSpecificMaterialsTable();
    hideSpecificMaterialMessage();
  }

  function renderSpecificMaterialsTable() {
    elements.specificMaterialsTableBody.replaceChildren();

    state.specificMaterials.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeHtml(item.material)}</strong></td>
        <td>${formatQuantity(item.quantity)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.observations || "Sin observaciones")}</td>
        <td><button type="button" class="remove-button remove-specific-button" data-index="${index}" aria-label="Eliminar ${escapeHtml(item.material)}">Eliminar</button></td>`;
      elements.specificMaterialsTableBody.appendChild(row);
    });

    const hasSpecificMaterials = state.specificMaterials.length > 0;
    elements.specificMaterialsTableWrapper.hidden = !hasSpecificMaterials;
    elements.emptySpecificMaterials.hidden = hasSpecificMaterials;
  }

  function getTotalProductCount() {
    return state.products.length + state.specificMaterials.length;
  }

  function hasPendingSpecificMaterial() {
    return Boolean(
      cleanText(elements.specificMaterial.value) ||
      cleanText(elements.specificQuantity.value) ||
      cleanText(elements.specificUnit.value) ||
      cleanText(elements.specificObservations.value)
    );
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
      row.innerHTML = `
        <td><strong>${escapeHtml(item.productName)}</strong><br><small>${escapeHtml(item.productId)}</small></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${formatQuantity(item.quantity)}</td>
        <td>${escapeHtml(item.unit)}</td>
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
    if (firstInvalid) {
      focusInvalidField(firstInvalid);
      return;
    }

    if (!getTotalProductCount()) {
      showProductError("Agregue al menos un material del catálogo o no encontrado.");
      elements.emptyProducts.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (hasPendingSpecificMaterial()) {
      showSpecificMaterialMessage("Agregue el material no encontrado pendiente o limpie sus campos antes de enviar.", "error");
      elements.specificMaterial.scrollIntoView({ behavior: "smooth", block: "center" });
      elements.specificMaterial.focus();
      return;
    }

    if (!elements.confirmation.checked) {
      showStatus("Confirme que los datos capturados son correctos.", "error");
      elements.confirmation.focus();
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeoutMs
    );

    try {
      const response = await fetch(CONFIG.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(buildPayload()),
        signal: controller.signal,
        redirect: "follow"
      });

      const result = await parseJsonResponse(response);

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ||
          result.mensaje ||
          "El servidor rechazó la solicitud."
        );
      }

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
      nombre: cleanText(elements.fullName.value),
      correo: cleanText(elements.email.value).toLowerCase(),
      area: cleanText(elements.area.value),
      sucursal: cleanText(elements.branch.value),
      motivo: cleanText(elements.reason.value),
      productos: state.products.map((item) => ({
        codigo: item.productId,
        categoria: item.category,
        material: item.productName,
        cantidad: item.quantity,
        unidad: item.unit
      })),
      materialesEspecificos: state.specificMaterials.map((item) => ({
        material: item.material,
        cantidad: item.quantity,
        unidad: item.unit,
        observaciones: item.observations
      }))
    };
  }

  async function parseJsonResponse(response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }
  }

  function validateMainFields() {
    const rules = [
      { id: "fullName", message: "Capture el nombre completo." },
      { id: "email", message: "Capture un correo electrónico válido." },
      { id: "area", message: "Seleccione un área." },
      { id: "branch", message: "Seleccione una sucursal." },
      { id: "reason", message: "Capture el motivo de la solicitud." }
    ];

    let firstInvalid = null;

    rules.forEach(({ id, message }) => {
      const field = elements[id];
      const invalid = !field.checkValidity() || !cleanText(field.value);

      field.setAttribute("aria-invalid", String(invalid));

      if (invalid) {
        setFieldError(id, message);
        firstInvalid ||= field;
      }
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
      state.specificMaterials = [];
      state.selectedProduct = null;
      state.isSubmitting = false;

      elements.productSearch.disabled = true;
      elements.productSearch.placeholder = "Seleccione primero una categoría";
      elements.reasonCountValue.textContent = "0";

      closeSearchResults();
      hideMessages();
      clearFieldErrors();
      renderTable();
      renderSpecificMaterialsTable();
      hideSpecificMaterialMessage();
      setLoading(false);
    }, 0);
  }

  function updateReasonCounter() {
    elements.reasonCountValue.textContent = String(elements.reason.value.length);
  }

  function showSuccessModal(folio) {
    const fragment = elements.successTemplate.content.cloneNode(true);
    const backdrop = fragment.querySelector(".modal-backdrop");
    const closeButton = fragment.getElementById("closeModalBtn");
    const generatedFolio = fragment.getElementById("generatedFolio");

    generatedFolio.textContent = folio || "Sin folio";

    const closeModal = () => {
      document.removeEventListener("keydown", handleEscape);
      backdrop.remove();
      document.body.classList.remove("modal-open");
      elements.requestForm.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") closeModal();
    };

    closeButton.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    document.addEventListener("keydown", handleEscape);

    document.body.appendChild(fragment);
    document.body.classList.add("modal-open");

    const mountedCloseButton = document.getElementById("closeModalBtn");
    mountedCloseButton?.focus();
  }

  function setLoading(active) {
    state.isSubmitting = active;
    elements.submitBtn.disabled = active;
    elements.addProductBtn.disabled = active;
    elements.addSpecificMaterialBtn.disabled = active;
    elements.submitBtn.setAttribute("aria-busy", String(active));

    const spinner = elements.submitBtn.querySelector(".spinner");
    const label = elements.submitBtn.querySelector(".submit-label");

    if (spinner) spinner.hidden = !active;
    if (label) label.textContent = active ? "Enviando..." : "Enviar solicitud";
  }

  function showProductError(message) {
    elements.productError.textContent = message;
    elements.productError.hidden = false;
  }

  function hideProductError() {
    elements.productError.hidden = true;
    elements.productError.textContent = "";
  }

  function showSpecificMaterialMessage(message, type = "error") {
    elements.specificMaterialMessage.textContent = message;
    elements.specificMaterialMessage.classList.toggle("error", type === "error");
    elements.specificMaterialMessage.classList.toggle("warning", type === "warning");
    elements.specificMaterialMessage.hidden = false;
  }

  function hideSpecificMaterialMessage() {
    elements.specificMaterialMessage.hidden = true;
    elements.specificMaterialMessage.textContent = "";
    elements.specificMaterialMessage.classList.remove("error", "warning");
  }

  function showStatus(message, type = "success") {
    elements.submitStatus.textContent = message;
    elements.submitStatus.classList.toggle("error", type === "error");
    elements.submitStatus.hidden = false;
  }

  function hideMessages() {
    hideProductError();
    hideSpecificMaterialMessage();
    elements.submitStatus.hidden = true;
    elements.submitStatus.textContent = "";
    elements.submitStatus.classList.remove("error");
  }

  function setFieldError(id, message) {
    const node = document.querySelector(`[data-error-for="${id}"]`);
    if (node) node.textContent = message;
  }

  function clearFieldErrors() {
    document.querySelectorAll("[data-error-for]").forEach((node) => {
      node.textContent = "";
    });

    document.querySelectorAll("[aria-invalid]").forEach((field) => {
      field.setAttribute("aria-invalid", "false");
    });
  }

  function disableForm() {
    elements.requestForm
      .querySelectorAll("input, select, textarea, button")
      .forEach((control) => {
        control.disabled = true;
      });
  }

  function isCatalogValid(catalog) {
    return Boolean(
      catalog &&
      typeof catalog === "object" &&
      !Array.isArray(catalog) &&
      Object.keys(catalog).length > 0
    );
  }

  function isGeneralCatalogValid(catalogs) {
    return Boolean(
      catalogs &&
      Array.isArray(catalogs.areas) &&
      catalogs.areas.length > 0 &&
      Array.isArray(catalogs.sucursales) &&
      catalogs.sucursales.length > 0 &&
      Array.isArray(catalogs.unidades) &&
      catalogs.unidades.length > 0
    );
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function formatQuantity(value) {
    return Number(value).toLocaleString("es-MX", {
      maximumFractionDigits: 0
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();

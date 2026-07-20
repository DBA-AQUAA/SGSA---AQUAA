(() => {
  "use strict";

  const CONFIG = {
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbzV21JNPxd3ojDf28YdEe67vVExuUho6jBRX7vS-CpiC1wrVCmsyvONTdlZWLt7X6Z_/exec",
    maxFileSizeMb: 5,
    requestTimeoutMs: 30000
  };

  const state = { selectedProduct: null, products: [] };
  const $ = (id) => document.getElementById(id);

  const form = $("requestForm");
  const category = $("category");
  const search = $("productSearch");
  const results = $("productResults");
  const quantity = $("quantity");
  const unit = $("unit");
  const tbody = $("productsTableBody");
  const wrapper = $("productsTableWrapper");
  const empty = $("emptyProducts");
  const productError = $("productError");
  const submitStatus = $("submitStatus");
  const submitBtn = $("submitBtn");
  const attachment = $("attachment");

  init();

  function init() {
    if (!window.SGSA_CATALOG || typeof window.SGSA_CATALOG !== "object") {
      showStatus("No fue posible cargar el catálogo de materiales.", true);
      return;
    }

    Object.keys(window.SGSA_CATALOG)
      .sort((a, b) => a.localeCompare(b, "es"))
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        category.appendChild(option);
      });

    category.addEventListener("change", onCategoryChange);
    search.addEventListener("input", renderResults);
    search.addEventListener("focus", renderResults);
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") results.hidden = true;
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".product-search-field")) results.hidden = true;
    });
    $("addProductBtn").addEventListener("click", addProduct);
    tbody.addEventListener("click", removeProduct);
    attachment.addEventListener("change", validateAttachment);
    $("notes").addEventListener("input", () => {
      $("notesCount").textContent = $("notes").value.length;
    });
    form.addEventListener("reset", resetFormState);
    form.addEventListener("submit", submitRequest);

    renderTable();
  }

  function onCategoryChange() {
    state.selectedProduct = null;
    search.value = "";
    unit.value = "";
    results.hidden = true;
    search.disabled = !category.value;
    search.placeholder = category.value
      ? "Escriba para buscar un material..."
      : "Seleccione primero una categoría";
  }

  function renderResults() {
    if (!category.value) return;

    const term = normalize(search.value);
    const catalog = window.SGSA_CATALOG[category.value] || [];
    const matches = catalog
      .filter((product) => normalize(`${product.name} ${product.id}`).includes(term))
      .slice(0, 60);

    results.innerHTML = "";

    if (!matches.length) {
      const item = document.createElement("div");
      item.className = "result-empty";
      item.textContent = "No se encontraron materiales.";
      results.appendChild(item);
    } else {
      matches.forEach((product) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "result-item";
        button.setAttribute("role", "option");
        button.innerHTML = `
          <strong>${escapeHtml(product.name)}</strong><br>
          <small>${escapeHtml(product.id)} · ${escapeHtml(product.unit || "SIN UNIDAD")}</small>`;
        button.addEventListener("click", () => selectProduct(product));
        results.appendChild(button);
      });
    }

    results.hidden = false;
  }

  function selectProduct(product) {
    state.selectedProduct = product;
    search.value = product.name;
    unit.value = product.unit || "";
    results.hidden = true;
    quantity.focus();
  }

  function addProduct() {
    hideMessages();

    const qty = Number(quantity.value);
    const enteredUnit = unit.value.trim();

    if (!category.value) return showProductError("Seleccione una categoría.");
    if (!state.selectedProduct) return showProductError("Seleccione un material de la lista.");
    if (!Number.isFinite(qty) || qty <= 0) return showProductError("Capture una cantidad mayor que cero.");
    if (!enteredUnit) return showProductError("Capture la unidad del material.");

    const duplicate = state.products.find(
      (item) => item.productId === state.selectedProduct.id
    );

    if (duplicate) {
      return showProductError("Ese material ya está en el carrito.");
    }

    state.products.push({
      productId: state.selectedProduct.id,
      productName: state.selectedProduct.name,
      category: category.value,
      quantity: qty,
      unit: enteredUnit
    });

    state.selectedProduct = null;
    search.value = "";
    quantity.value = "";
    unit.value = "";
    renderTable();
    search.focus();
  }

  function removeProduct(event) {
    const button = event.target.closest(".remove-button");
    if (!button) return;

    state.products.splice(Number(button.dataset.index), 1);
    renderTable();
  }

  function renderTable() {
    tbody.innerHTML = "";

    state.products.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeHtml(item.productName)}</strong><br><small>${escapeHtml(item.productId)}</small></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${formatQuantity(item.quantity)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>
          <button type="button" class="remove-button" data-index="${index}">
            Eliminar
          </button>
        </td>`;
      tbody.appendChild(row);
    });

    wrapper.hidden = state.products.length === 0;
    empty.hidden = state.products.length > 0;
  }

  function validateAttachment() {
    clearFileMessage();

    const file = attachment.files[0];
    if (!file) return true;

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
      setFileError("El archivo debe ser JPG, PNG o WEBP.");
      attachment.value = "";
      return false;
    }

    if (file.size > CONFIG.maxFileSizeMb * 1024 * 1024) {
      setFileError(`La imagen supera el límite de ${CONFIG.maxFileSizeMb} MB.`);
      attachment.value = "";
      return false;
    }

    $("fileName").textContent =
      `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

    return true;
  }

  async function submitRequest(event) {
    event.preventDefault();
    hideMessages();
    clearFieldErrors();

    if (!validateMainFields()) return;
    if (!state.products.length) {
      return showProductError("Agregue al menos un material al carrito.");
    }
    if (!validateAttachment()) return;
    if (!$("confirmation").checked) {
      return showStatus("Confirme que los datos capturados son correctos.", true);
    }

    setLoading(true);

    try {
      const fileData = attachment.files[0]
        ? await fileToPayload(attachment.files[0])
        : null;

      const payload = {
        nombre: $("fullName").value.trim(),
        correo: $("email").value.trim(),
        area: $("area").value,
        sucursal: $("branch").value,
        observaciones: $("notes").value.trim(),
        insumos: state.products.map((item) => ({
          categoria: item.category,
          material: item.productName,
          cantidad: item.quantity,
          unidad: item.unit
        })),
        adjunto: fileData
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

      const response = await fetch(CONFIG.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "El servidor rechazó la solicitud.");
      }

      showModal(result.folio);

    } catch (error) {
      const message = error.name === "AbortError"
        ? "La solicitud tardó demasiado. Revise su conexión."
        : `No fue posible enviar la solicitud. ${error.message || ""}`;

      showStatus(message.trim(), true);
    } finally {
      setLoading(false);
    }
  }

  function validateMainFields() {
    let valid = true;

    const rules = [
      ["fullName", "Capture el nombre completo."],
      ["email", "Capture un correo electrónico válido."],
      ["area", "Seleccione un área."],
      ["branch", "Seleccione una sucursal."]
    ];

    rules.forEach(([id, message]) => {
      const field = $(id);

      if (!field.checkValidity() || !field.value.trim()) {
        setFieldError(id, message);
        valid = false;
      }
    });

    if (!valid) {
      $("fullName").scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
  }

  function resetFormState() {
    setTimeout(() => {
      state.products = [];
      state.selectedProduct = null;
      search.disabled = true;
      search.value = "";
      search.placeholder = "Seleccione primero una categoría";
      unit.value = "";
      results.hidden = true;
      $("notesCount").textContent = "0";
      clearFileMessage();
      hideMessages();
      clearFieldErrors();
      renderTable();
    }, 0);
  }

  function showModal(folio) {
    const fragment = $("successTemplate").content.cloneNode(true);
    fragment.getElementById("generatedFolio").textContent = folio;

    const backdrop = fragment.querySelector(".modal-backdrop");
    const closeButton = fragment.getElementById("closeModalBtn");

    closeButton.addEventListener("click", () => {
      backdrop.remove();
      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.body.appendChild(fragment);
    document.getElementById("closeModalBtn").focus();
  }

  function fileToPayload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        base64: String(reader.result).split(",")[1]
      });

      reader.onerror = () =>
        reject(new Error("No se pudo leer la imagen adjunta."));

      reader.readAsDataURL(file);
    });
  }

  function setLoading(active) {
    submitBtn.disabled = active;
    submitBtn.classList.toggle("is-loading", active);
    submitBtn.querySelector(".spinner").hidden = !active;
  }

  function showProductError(message) {
    productError.textContent = message;
    productError.hidden = false;
  }

  function showStatus(message, error = false) {
    submitStatus.textContent = message;
    submitStatus.classList.toggle("error", error);
    submitStatus.hidden = false;
  }

  function hideMessages() {
    productError.hidden = true;
    submitStatus.hidden = true;
  }

  function setFieldError(id, message) {
    const node = document.querySelector(`[data-error-for="${id}"]`);
    if (node) node.textContent = message;
  }

  function clearFieldErrors() {
    document.querySelectorAll("[data-error-for]").forEach((node) => {
      node.textContent = "";
    });
  }

  function setFileError(message) {
    $("fileError").textContent = message;
    $("fileName").textContent = "";
  }

  function clearFileMessage() {
    $("fileError").textContent = "";
    $("fileName").textContent = "";
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function formatQuantity(value) {
    return Number(value).toLocaleString("es-MX", {
      maximumFractionDigits: 2
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

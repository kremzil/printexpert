(() => {
  const getGlobal = (key) => (typeof window !== "undefined" ? window[key] : null);

  const productId =
    document.querySelector(".product-id")?.value ||
    document.querySelector('input[name="product_id"]')?.value ||
    document.querySelector('input[name="add-to-cart"]')?.value ||
    null;

  const numbersArray = getGlobal("numbers_array");
  const numbersMap = {};
  if (Array.isArray(numbersArray)) {
    numbersArray.forEach((value, index) => {
      if (value !== null && value !== undefined) {
        numbersMap[String(index)] = value;
      }
    });
  } else if (numbersArray && typeof numbersArray === "object") {
    Object.entries(numbersArray).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        numbersMap[String(key)] = value;
      }
    });
  }

  const extractSelects = (root, selector) =>
    Array.from(root.querySelectorAll(selector))
      .filter((node) => node.tagName === "SELECT")
      .map((node) => ({
        aid: node.dataset.aid ?? "",
        name: node.getAttribute("name") ?? "",
        class: node.className ?? "",
        options: Array.from(node.options).map((option) => ({
          value: option.value,
          label: option.textContent?.trim() ?? "",
          selected: option.selected || undefined,
        })),
      }));

  const matrices = [
    ...Array.from(document.querySelectorAll(".matrix-type-simple")).map(
      (element) => ({
        kind: "simple",
        mtid: element.getAttribute("data-mtid") ?? "",
        ntp: element.getAttribute("data-ntp") ?? "0",
        material:
          element.querySelector(".smatrix-material")?.value ?? null,
        selects: extractSelects(element, ".print-attributes .smatrix-attr"),
      })
    ),
    ...Array.from(document.querySelectorAll(".matrix-type-finishing")).map(
      (element) => ({
        kind: "finishing",
        mtid: element.getAttribute("data-mtid") ?? "",
        ntp: element.getAttribute("data-ntp") ?? "0",
        material: null,
        selects: extractSelects(element, ".finishing-attributes .fmatrix-attr"),
      })
    ),
  ];

  const data = {
    url: window.location.href,
    product_id: productId,
    globals: {
      dim_unit: getGlobal("dim_unit") ?? null,
      a_unit: getGlobal("a_unit") ?? null,
      min_quantity: getGlobal("min_quantity") ?? null,
      min_width: getGlobal("min_width") ?? null,
      min_height: getGlobal("min_height") ?? null,
      max_width: getGlobal("max_width") ?? null,
      max_height: getGlobal("max_height") ?? null,
      numbers_array: numbersMap,
      smatrix: getGlobal("smatrix") ?? {},
      fmatrix: getGlobal("fmatrix") ?? {},
    },
    matrices,
  };

  const json = JSON.stringify(data, null, 2);
  if (typeof copy === "function") {
    copy(json);
    console.log("OK: JSON copied to clipboard.");
  } else {
    console.log(json);
  }
})();

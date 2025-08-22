// Select all elements with the "obscure" attribute
document.querySelectorAll("[obscure]").forEach((elem) => {
  // Create a new <span> element to replace the existing element
  const newNode = document.createElement("span");
  
  // Copy the inner HTML content from the original element
  newNode.innerHTML = elem.innerHTML;

  // If the original element has classes, transfer them to the new element
  if (elem.classList.length) newNode.className = elem.className;

  // If the original element has an ID, transfer it to the new element
  if (elem.id) newNode.id = elem.id;

  // Loop through each data attribute (dataset) of the original element
  Object.entries(elem.dataset).forEach(([key, value]) => {
      // Replace all occurrences of "%<key>" (excluding the "p" prefix) in the innerHTML
      newNode.innerHTML = newNode.innerHTML.replaceAll(`%${key.replace(/^p/, '')}`, value);
  });

  // Replace the original element with the newly created one
  elem.replaceWith(newNode);
});
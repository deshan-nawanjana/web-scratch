// helpers for query selectors
const qs = (selector, target) => (target || document).querySelector(selector)
const qa = selector => Array.from(document.querySelectorAll(selector))
const qt = selector => qs(selector).content.cloneNode(true).children[0]

// helper to create element
const ce = (tag, selector, parent, child) => {
  // create element
  const element = document.createElement(tag)
  // set class name
  element.className = selector
  // append child if given
  if (child) { element.appendChild(child) }
  // append to parent if given
  if (parent) { parent.appendChild(element) }
  // return create element
  return element
}

// method to get content from storage
const getScratchedContent = async id => {
  // get local storage content
  const storageData = await chrome.storage.local.get(id)
  // check storage data
  if (storageData && storageData[id]) {
    // store data on session
    sessionStorage.setItem("data", JSON.stringify(storageData[id]))
  }
  // clear local storage
  await chrome.storage.local.clear()
  // return if no data on session
  if (!sessionStorage.data) { return null }
  // return parse storage data
  return JSON.parse(sessionStorage.getItem("data"))
}

// latest data array
let output = null

// method to load preview
const loadPreview = data => {
  // set initial data as output
  output = data
  // check for string array
  const isStringArray = Object.values(data).some(item => (
    typeof item === "string"
  ))
  // get options table element
  const tableElement = qs(".preview-options")
  // check string array
  if (!isStringArray) {
    // keys array
    const keys = []
    // for each item in data
    for (let i = 0; i < data.length; i++) {
      // current item
      const item = data[i]
      // continue if not an object
      if (typeof item !== "object" && item !== null) { continue }
      // push to keys array
      keys.push(...Object.keys(item).filter(key => (
        !keys.includes(key)
      )))
    }
    // map into key options
    const keyOptions = keys.map(key => ({
      key, rename: "", include: true
    }))
    // if option count not exceeded
    if (keyOptions.length <= 10) {
      // get options table body element
      const optionsElement = qs("#options")
      // for each key option
      for (let i = 0; i < keyOptions.length; i++) {
        // current option
        const option = keyOptions[i]
        // clone table row template
        const row = qt("#options-row")
        // get row elements
        const keyElement = qs(".option-key-value", row)
        const includeElement = qs(".option-include-input", row)
        const renameElement = qs(".option-rename-input", row)
        // set original key value
        keyElement.innerHTML = option.key
        // include checkbox event listener
        includeElement.addEventListener("input", event => {
          // update include flag
          option.include = event.target.checked
          // update row status
          row.setAttribute("data-include", option.include)
          // update input disabled status
          renameElement.disabled = !option.include
          // update snippet
          updateSnippet(data, keyOptions)
        })
        // rename input event listener
        renameElement.addEventListener("input", event => {
          // update rename value
          option.rename = event.target.value
        })
        // rename keypress event listener
        renameElement.addEventListener("keypress", event => {
          // update snippet on enter key press
          if (event.key === "Enter") { updateSnippet(data, keyOptions) }
        })
        // rename blur event listener
        renameElement.addEventListener("blur", () => {
          // update snippet
          updateSnippet(data, keyOptions)
        })
        // append row on table body
        optionsElement.appendChild(row)
      }
      // show options table
      tableElement.style.display = "table"
    }
    // initial snippet update
    updateSnippet(data, keyOptions)
  } else {
    // initial snippet update
    updateSnippet(data)
  }
  // download button click event
  qs("#download").addEventListener("click", () => {
    // export latest data as file
    exportScratchData()
  })
}

// method to update preview snippet
const updateSnippet = (data, options) => {
  // check for options
  if (options) {
    // map data array to output
    output = data.map(item => (
      options.reduce((obj, option) => {
        // return same if key not available
        if (!option.key in item) { return obj }
        // return same if key not included
        if (!option.include) { return obj }
        // get object value
        const value = option.key in item
          ? item[option.key] : null
        // check rename option
        if (option.rename) {
          // return with rename key
          return ({ ...obj, [option.rename]: value })
        } else {
          // return with original key
          return ({ ...obj, [option.key]: value })
        }
      }, {})
    ))
  }
  // stringify content
  const text = JSON.stringify(output, null, 2)
  // syntax highlighting from prism
  const code = Prism.highlight(text, Prism.languages.json, "json")
  // set on preview element
  qs(".preview-code").innerHTML = code
}

// method to export output as a file
const exportScratchData = () => {
  // create data string
  const text = JSON.stringify(output, null, 2)
  // create blob
  const blob = new Blob([text], { type: "application/json" })
  // create download link
  const link = URL.createObjectURL(blob)
  // create anchor element
  const anchor = document.createElement("a")
  // set anchor attributes
  anchor.href = link
  anchor.download = `Scratch_${Date.now()}.json`
  anchor.style.display = "none"
  // append element and trigger download
  document.head.appendChild(anchor)
  anchor.click()
  // revoke link and remove element
  URL.revokeObjectURL(link)
  document.head.removeChild(anchor)
}

// get url search params
const params = new URLSearchParams(location.search)
// check id param
if (params.get("id")) {
  // set preview window mode
  document.body.classList.add("preview")
  // get scratched data
  const data = await getScratchedContent(params.get("id"))
  // load preview interface
  loadPreview(data)
} else {
  // set default popup mode
  document.body.classList.add("default")
}

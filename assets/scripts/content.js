// event listener for context menu event
document.addEventListener("contextmenu", event => {
  // store right clicked element globally
  window['_scratchTarget'] = event.target
})

// callback function to scratch from background
window['_scratchElements'] = function () {
  // get selector by target element
  const selector = getElementsSelector(window['_scratchTarget'])
  // get content by selector
  const content = getElementContents(selector)
  // send content to the background
  chrome.runtime.sendMessage({ action: "preview-scratch", data: content })
}

// method to get query selector for elements
const getElementsSelector = element => {
  // selector of elements
  let selector = null
  // get tag name
  const tagName = element.tagName.toLowerCase()
  // get class list
  const classList = element.classList
  // check class list length
  if (classList.length > 0) {
    // set elements selector
    selector = tagName + "." + Array.from(classList).join(".")
  } else {
    // reverse element selector path
    const path = [tagName]
    // current element
    let current = element
    // while maximum reverse length
    while (path.length < 10) {
      // get parent element
      const parent = current.parentElement
      // break if no parent element
      if (!parent) { break }
      // break if document element
      if (parent === document.documentElement) { break }
      // get tag name
      const tagName = parent.tagName.toLowerCase()
      // check selector attributes
      if (parent.getAttribute("class")) {
        // push parent class selector to path
        path.push(tagName + "." + Array.from(parent.classList).join("."))
        // break to continue
        break
      } else if (parent.getAttribute("id")) {
        // push parent id selector to path
        path.push(tagName + "#" + parent.getAttribute("id"))
        // break to continue
        break
      } else {
        // push tag name to path
        path.push(tagName)
        // update current element
        current = parent
      }
    }
    // join path into elements selector
    selector = path.reverse().join(" ")
  }
  // remove invalid selector parts
  selector = selector.split(".").filter(part => (
    ![":", "!", "[", "]"].some(char => part.includes(char))
  )).join(".")
  // return selector
  return selector
}

// collect data from all elements
const getElementContents = selector => {
  // get all elements by selector
  const elements = document.querySelectorAll(selector)
  // output array
  const output = []
  // for each element
  for (let i = 0; i < elements.length; i++) {
    // current element
    const element = elements[i]
    // get element content
    const content = getElementTreeContents(element)
    // push content to output array
    output.push(updateObjectNodes(content))
  }
  // return output
  return output
}

// blacklisted tags
const blacklistTags = [
  "svg",
  "path",
  "rect",
  "polygon",
  "circle",
  "g"
]

// blacklisted attributes
const blacklistAttributes = [
  "class",
  "style"
]

// parse text as object if possible
const tryParseText = (text = "") => {
  // return same text if not brackets on endings
  if (!text.startsWith("{") && !text.endsWith("}")) { return text }
  // try to parse
  try {
    // return parsed text
    return JSON.parse(text)
  } catch (err) {
    // return same text on error
    return text
  }
}

// get element props recursively
const getElementTreeContents = element => {
  // output object
  const object = {}
  // create node name for element
  const name = element => {
    // get tag name
    const tagName = element.tagName.toLowerCase()
    // get class list
    const classes = element.classList.length > 0
      ? "." + Array.from(element.classList).join(".")
      : ""
    // combine into unique path part
    return `${tagName}${classes}`
  }
  // recursive trough child elements
  const recursive = (element, path) => {
    // return if tag is blacklisted
    if (blacklistTags.includes(element.tagName.toLowerCase())) { return }
    // initiate path node on output
    if (!object[path]) { object[path] = {} }
    // get target attributes
    const attributes = element.attributes
    // for each attribute
    for (let a = 0; a < attributes.length; a++) {
      // current attribute
      const attr = attributes[a]
      // continue if blacklisted
      if (blacklistAttributes.includes(attr.name)) { continue }
      // initiate attribute node
      if (!object[path][attr.name]) { object[path][attr.name] = [] }
      // push attribute value
      object[path][attr.name].push(tryParseText(attr.value))
    }
    // get child nodes
    const children = element.childNodes
    // for each child node
    for (let c = 0; c < children.length; c++) {
      // current child node
      const node = children[c]
      // check for tag node
      if (node.tagName) {
        recursive(node, path + "/" + name(node))
      } else if (node.textContent) {
        // trim text content
        const text = node.textContent.trim()
        // check text content
        if (text) {
          // initiate text node
          if (!object[path]._text) { object[path]._text = [] }
          // push text content
          object[path]._text.push(tryParseText(text))
        }
      }
    }
  }
  // execute recursion
  recursive(element, name(element))
  // output object
  const output = {}
  // get object keys
  const keys = Object.keys(object)
  // for each key
  for (let i = 0; i < keys.length; i++) {
    // current key
    const key = keys[i]
    // current value array
    const value = object[key]
    // continue if no child keys
    if (Object.keys(value).length === 0) { continue }
    // reduce array levels
    const data = Object.keys(value).reduce((obj, key) => {
      // current key value
      const data = value[key]
      // check value
      if (!data || (Array.isArray(data) && data.length === 0)) {
        // skip empty string nodes and empty arrays
        return obj
      } else if (Array.isArray(data) && data.length === 1) {
        // convert single item array into parent item
        return { ...obj, [key]: data[0] }
      } else {
        // attach any other values
        return { ...obj, [key]: value[key] }
      }
    }, {})
    // reduce parent level
    output[key] = Object.keys(data).length === 1
      ? Object.values(data)[0] : data
  }
  // return output
  return Object.keys(output).length === 1
    ? Object.values(output)[0] : output
}

// previously remapped keys
const names = {}

// tag names to remove from object keys
const removableTags = ["a", "abbr", "acronym", "applet", "aside", "b", "base", "basefont", "bdi", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "center", "cite", "code", "col", "colgroup", "data", "dd", "del", "dfn", "dialog", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html", "i", "iframe", "img", "ins", "kbd", "li", "main", "mark", "marquee", "meta", "meter", "nav", "noframes", "noscript", "ol", "optgroup", "option", "p", "param", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "span", "strike", "strong", "style", "sub", "sup", "svg", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "tr", "tt", "u", "ul", "var", "wbr"]

// vowels to keep only pronounceable words in keys
const vowels = ["a", "e", "i", "o", "u", "A", "E", "I", "O", "U"]

const updateObjectNodes = object => {
  // return if not an object
  if (typeof object !== "object") { return object }
  // return if null
  if (object === null) { return null }
  // output object
  const output = {}
  // get object keys
  const keys = Object.keys(object)
  // for each key
  for (let i = 0; i < keys.length; i++) {
    // current key
    const key = keys[i]
    // node name
    let name = names[key]
    // check name availability
    if (!name) {
      name = key.split(/[^a-zA-Z]+/g).filter(part => (
        // filter tag names
        !removableTags.includes(part)
        &&
        vowels.some(vowel => part.includes(vowel))
      )).filter((item, index, array) => (
        array.indexOf(item) === index
      )).join("_")
      // store in names to reuse
      names[key] = name
    }
    // check name
    if (!name || name in output) {
      // replace all symbols
      name = key.split(/[^a-zA-Z]+/g).join("_")
    }
    // set node by name
    name in output
      ? output[key] = object[key]
      : output[name] = object[key]
  }
  // return output object
  return output
}

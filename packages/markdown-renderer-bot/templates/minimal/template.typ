#let title = "$title$"
#let authors = "$authors$"
#let abstract_text = "$abstract$"

// Simple page setup
#set page(
  paper: "us-letter",
  margin: 1.5in
)

// Simple typography
#set text(
  font: "Times New Roman",
  size: 11pt
)

#set par(justify: true)

// Title
#align(center)[
  #text(size: 14pt, weight: "bold", title)
  #v(0.5em)
  #if authors != "" [
    #text(size: 11pt, authors)
    #v(0.5em)
  ]
]

// Abstract
#if abstract_text != "" [
  #block(
    inset: (left: 1em, right: 1em),
    [*Abstract:* #abstract_text]
  )
  #v(1em)
]

// Content
$body$
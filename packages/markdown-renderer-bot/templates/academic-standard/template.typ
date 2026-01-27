#let title = "$title$"
#let authors = "$authors$"
#let abstract_text = "$abstract$"
#let submitted_date = "$submittedDate$"
#let render_date = "$renderDate$"
#let journal_name = "$journalName$"

// Page setup
#set page(
  paper: "us-letter",
  margin: (x: 1in, y: 1in),
  header: locate(loc => {
    if counter(page).at(loc).first() > 1 {
      align(right, text(size: 10pt, title))
    }
  }),
  footer: locate(loc => {
    align(center, text(size: 10pt, str(counter(page).at(loc).first())))
  })
)

// Typography
#set text(
  font: "Times New Roman",
  size: 12pt,
  lang: "en"
)

#set par(
  leading: 0.65em,
  justify: true,
  linebreaks: "optimized"
)

// Headings
#show heading.where(level: 1): it => [
  #set text(size: 14pt, weight: "bold")
  #block(spacing: 1.5em, it.body)
]

#show heading.where(level: 2): it => [
  #set text(size: 13pt, weight: "bold")
  #block(spacing: 1.2em, it.body)
]

#show heading.where(level: 3): it => [
  #set text(size: 12pt, weight: "bold")
  #block(spacing: 1em, it.body)
]

// Title
#align(center)[
  #block(text(size: 16pt, weight: "bold", title))
  #v(0.5em)
  #if authors != "" [
    #block(text(size: 12pt, authors))
    #v(0.3em)
  ]
  #if submitted_date != "" [
    #block(text(size: 10pt, style: "italic", [Submitted: #submitted_date]))
  ]
  #if journal_name != "" and journal_name != "Colloquium Journal" [
    #block(text(size: 10pt, style: "italic", journal_name))
  ]
]

#v(1em)

// Abstract
#if abstract_text != "" [
  #block(
    width: 90%,
    inset: 1em,
    stroke: (left: 3pt + rgb("#2c5aa0")),
    fill: rgb("#f9f9f9"),
    [
      #text(weight: "bold", fill: rgb("#2c5aa0"))[Abstract]
      #v(0.5em)
      #abstract_text
    ]
  )
  #v(1.5em)
]

// Main content
$body$

// Bibliography (if provided)
$if(bibliography)$
#bibliography("references.bib", title: "References", style: "apa")
$endif$


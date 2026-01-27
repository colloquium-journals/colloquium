#let title = "$title$"
#let authors = "$authors$"
#let abstract_text = "$abstract$"
#let keywords = "$keywords$"
#let submitted_date = "$submittedDate$"
#let accepted_date = "$acceptedDate$"
#let published_date = "$publishedDate$"
#let render_date = "$renderDate$"
#let journal_name = "$journalName$"
#let doi = "$doi$"

// Author list (structured)
#let author_list = (
$if(authorList)$
$for(authorList)$
  (
    name: "$it.name$",
    affiliation: "$it.affiliation$",
    orcid: "$it.orcid$",
    email: "$it.email$",
    isCorresponding: $if(it.isCorresponding)$true$else$false$endif$,
  ),
$endfor$
$endif$
)

// Colors - Colloquium branding
#let accent-blue = rgb("#2563eb")
#let text-dark = rgb("#1a202c")
#let text-primary = rgb("#2d3748")
#let text-secondary = rgb("#4a5568")
#let text-muted = rgb("#718096")
#let bg-light = rgb("#f7fafc")
#let bg-lighter = rgb("#edf2f7")
#let border-color = rgb("#e2e8f0")
#let success-green = rgb("#16a34a")

// Page setup
#set page(
  paper: "us-letter",
  margin: (x: 1in, y: 1in),
  header: locate(loc => {
    if counter(page).at(loc).first() > 1 {
      grid(
        columns: (1fr, 1fr),
        align: (left, right),
        text(size: 9pt, fill: text-muted, font: "Helvetica", journal_name),
        text(size: 9pt, fill: text-muted, title),
      )
    }
  }),
  footer: locate(loc => {
    align(center, text(size: 9pt, fill: text-muted, str(counter(page).at(loc).first())))
  })
)

// Typography
#set text(
  font: "Times New Roman",
  size: 11pt,
  lang: "en",
  fill: text-primary
)

#set par(
  leading: 0.7em,
  justify: true,
  linebreaks: "optimized"
)

// Headings
#show heading.where(level: 1): it => [
  #v(1.5em)
  #block[
    #set text(size: 14pt, weight: "bold", font: "Helvetica", fill: text-dark)
    #it.body
    #v(0.3em)
    #line(length: 100%, stroke: 1.5pt + border-color)
  ]
  #v(0.8em)
]

#show heading.where(level: 2): it => [
  #v(1.2em)
  #set text(size: 13pt, weight: "semibold", font: "Helvetica", fill: text-primary)
  #block(it.body)
  #v(0.5em)
]

#show heading.where(level: 3): it => [
  #v(1em)
  #set text(size: 12pt, weight: "semibold", font: "Helvetica", fill: text-secondary)
  #block(it.body)
  #v(0.3em)
]

// Header block
#align(center)[
  // Journal name
  #text(
    font: "Helvetica",
    size: 11pt,
    weight: "semibold",
    fill: accent-blue,
    tracking: 0.5pt,
    upper(journal_name)
  )

  #v(0.8em)

  // Title
  #block(text(
    size: 18pt,
    weight: "bold",
    font: "Helvetica",
    fill: text-dark,
    title
  ))

  #v(0.3em)
  #line(length: 60%, stroke: 2pt + accent-blue)
]

#v(1em)

// Authors
#if author_list.len() > 0 [
  #for author in author_list [
    #align(center)[
      #block[
        #text(size: 11pt, weight: "semibold", font: "Helvetica", author.name)
        #if author.isCorresponding [#super[#text(fill: accent-blue, weight: "bold", "*")]]

        #if author.affiliation != "" [
          #v(0.1em)
          #text(size: 10pt, style: "italic", fill: text-muted, author.affiliation)
        ]

        #if author.orcid != "" [
          #v(0.1em)
          #text(size: 9pt, fill: success-green)[ORCID: #link("https://orcid.org/" + author.orcid)[#author.orcid]]
        ]
      ]
    ]
    #v(0.4em)
  ]

  // Corresponding author note
  #let corresponding = author_list.filter(a => a.isCorresponding)
  #if corresponding.len() > 0 [
    #v(0.3em)
    #align(center)[
      #{
        let email_text = if corresponding.first().email != "" {
          ": " + corresponding.first().email
        } else { "" }
        text(size: 9pt, style: "italic", fill: text-muted)[#super[\*] Corresponding author#email_text]
      }
    ]
  ]
] else if authors != "" [
  #align(center)[
    #block(text(size: 11pt, weight: "semibold", font: "Helvetica", authors))
  ]
]

#v(0.5em)

// Metadata line
#align(center)[
  #set text(size: 9pt, fill: text-muted, font: "Helvetica")
  #if submitted_date != "" [Submitted: #submitted_date]
  #if accepted_date != "" [#if submitted_date != "" [ • ]Accepted: #accepted_date]
  #if published_date != "" [#if submitted_date != "" or accepted_date != "" [ • ]Published: #published_date]
  #if render_date != "" [#if submitted_date != "" or accepted_date != "" or published_date != "" [ • ]Rendered: #render_date]
]

// DOI
#if doi != "" [
  #v(0.2em)
  #align(center)[
    #text(size: 9pt, font: "Courier New")[DOI: #link("https://doi.org/" + doi)[#doi]]
  ]
]

#v(1em)

// Keywords
#if keywords != "" [
  #align(center)[
    #set text(size: 10pt, font: "Helvetica")
    #text(weight: "bold", fill: text-secondary)[Keywords: ]
    #text(fill: text-secondary, keywords)
  ]
  #v(0.8em)
]

// Abstract
#if abstract_text != "" [
  #block(
    width: 100%,
    inset: (left: 16pt, right: 12pt, top: 12pt, bottom: 12pt),
    stroke: (left: 4pt + accent-blue),
    fill: bg-light,
    radius: (right: 4pt),
  )[
    #set text(font: "Helvetica", size: 10pt)
    #text(weight: "bold", fill: accent-blue, upper[Abstract])
    #v(0.5em)
    #set text(font: "Times New Roman", size: 10pt)
    #abstract_text
  ]
  #v(1.5em)
]

// Main content
$body$

// Footer
#v(2em)
#line(length: 100%, stroke: 1.5pt + border-color)
#v(1em)

#align(center)[
  #set text(font: "Helvetica", size: 9pt, fill: text-muted)
  Generated by #text(fill: accent-blue, weight: "semibold")[Colloquium] Markdown Renderer
  #linebreak()
  Open Source Academic Publishing Platform
]

// Bibliography (if provided)
$if(bibliography)$
#v(1em)
#bibliography("references.bib", title: "References", style: "apa")
$endif$

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

// Author list (structured) - will be populated if available
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

// Title block
#align(center)[
  #block(text(size: 16pt, weight: "bold", title))
  #v(0.5em)

  // Structured author list
  #if author_list.len() > 0 [
    #for author in author_list [
      #block[
        #text(size: 12pt, author.name)
        #if author.isCorresponding [#super[#text(fill: rgb("#2c5aa0"), weight: "bold", "*")]]
        #if author.affiliation != "" [
          #v(0.1em)
          #text(size: 10pt, style: "italic", fill: rgb("#333"), author.affiliation)
        ]
        #if author.orcid != "" [
          #v(0.1em)
          #text(size: 9pt, fill: rgb("#16a34a"))[ORCID: #author.orcid]
        ]
      ]
      #v(0.3em)
    ]
    // Corresponding author note
    #let corresponding = author_list.filter(a => a.isCorresponding)
    #if corresponding.len() > 0 {
      v(0.3em)
      let email_suffix = if corresponding.first().email != "" { ": " + corresponding.first().email } else { "" }
      text(size: 9pt, style: "italic", fill: rgb("#555"))[#super[\*] Corresponding author#email_suffix]
    }
  ] else if authors != "" [
    #block(text(size: 12pt, authors))
  ]

  #v(0.3em)

  // Dates
  #if submitted_date != "" or accepted_date != "" or published_date != "" [
    #block(text(size: 10pt, style: "italic")[
      #if submitted_date != "" [Submitted: #submitted_date]
      #if accepted_date != "" [#if submitted_date != "" [ • ]Accepted: #accepted_date]
      #if published_date != "" [#if submitted_date != "" or accepted_date != "" [ • ]Published: #published_date]
    ])
  ]

  // DOI
  #if doi != "" [
    #v(0.2em)
    #text(size: 10pt)[#link("https://doi.org/" + doi)[https://doi.org/#doi]]
  ]

  // Journal name (if not default)
  #if journal_name != "" and journal_name != "Colloquium Journal" [
    #v(0.2em)
    #block(text(size: 10pt, style: "italic", journal_name))
  ]
]

#v(1em)

// Keywords
#if keywords != "" [
  #align(center)[
    #text(size: 10pt)[*Keywords:* #keywords]
  ]
  #v(0.5em)
]

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

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
#let license = "$license$"
#let article_type = "$articleType$"
#let version = "$version$"
#let version_note = "$versionNote$"
#let is_preprint = $if(isPreprint)$true$else$false$endif$

// Back matter content
#let data_availability_statement = "$dataAvailability.statement$"
#let data_availability_url = "$dataAvailability.url$"
#let data_availability_repository = "$dataAvailability.repository$"
#let code_availability_statement = "$codeAvailability.statement$"
#let code_availability_url = "$codeAvailability.url$"
#let code_availability_repository = "$codeAvailability.repository$"
#let author_contributions = "$authorContributions$"
#let acknowledgments = "$acknowledgments$"
#let competing_interests = "$competingInterests$"
#let ethics_approval = "$ethicsApproval$"

// Author list (structured)
#let author_list = (
$if(authorList)$
$for(authorList)$
  (
    name: "$it.name$",
    affiliation: "$it.affiliation$",
    orcid: "$it.orcid$",
    email: "$it.email$",
    roles: "$it.roles$",
    isCorresponding: $if(it.isCorresponding)$true$else$false$endif$,
  ),
$endfor$
$endif$
)

// Funding list
#let funding_list = (
$if(funding)$
$for(funding)$
  (
    funder: "$it.funder$",
    grantNumber: "$it.grantNumber$",
    recipient: "$it.recipient$",
  ),
$endfor$
$endif$
)

// Supplementary materials
#let supplementary_list = (
$if(supplementaryMaterials)$
$for(supplementaryMaterials)$
  (
    label: "$it.label$",
    description: "$it.description$",
    file: "$it.file$",
  ),
$endfor$
$endif$
)

// Colors
#let accent-blue = rgb("#2563eb")
#let accent-light = rgb("#60a5fa")
#let success-green = rgb("#16a34a")
#let warning-orange = rgb("#d97706")
#let text-muted = rgb("#64748b")
#let text-secondary = rgb("#475569")
#let bg-light = rgb("#f8fafc")
#let bg-accent = rgb("#eff6ff")
#let border-color = rgb("#e2e8f0")

// Page setup
#set page(
  paper: "us-letter",
  margin: (x: 1in, y: 1in),
  header: locate(loc => {
    if counter(page).at(loc).first() > 1 {
      grid(
        columns: (1fr, 1fr),
        align: (left, right),
        text(size: 9pt, fill: text-muted, if author_list.len() > 0 { author_list.first().name } else { authors }),
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
  lang: "en"
)

#set par(
  leading: 0.65em,
  justify: true,
  linebreaks: "optimized"
)

// Headings
#show heading.where(level: 1): it => [
  #v(1.5em)
  #block[
    #set text(size: 14pt, weight: "bold", font: "Helvetica")
    #it.body
    #v(0.3em)
    #line(length: 100%, stroke: 0.5pt + border-color)
  ]
  #v(0.8em)
]

#show heading.where(level: 2): it => [
  #v(1.2em)
  #set text(size: 12pt, weight: "bold", font: "Helvetica")
  #block(it.body)
  #v(0.5em)
]

#show heading.where(level: 3): it => [
  #v(1em)
  #set text(size: 11pt, weight: "bold", font: "Helvetica", fill: text-secondary)
  #block(it.body)
  #v(0.3em)
]

// Version/Preprint banner
#if is_preprint [
  #block(
    width: 100%,
    inset: 10pt,
    fill: rgb("#fffbeb"),
    stroke: 1pt + warning-orange,
    radius: 4pt,
  )[
    #set text(font: "Helvetica", size: 10pt)
    #box(
      fill: warning-orange,
      inset: (x: 6pt, y: 2pt),
      radius: 3pt,
      text(fill: white, weight: "bold", size: 9pt, "PREPRINT")
    )
    #h(8pt)
    This is a preprint and has not been peer reviewed.
  ]
  #v(1em)
] else if version != "" [
  #block(
    width: 100%,
    inset: 10pt,
    fill: rgb("#fffbeb"),
    stroke: 1pt + warning-orange,
    radius: 4pt,
  )[
    #set text(font: "Helvetica", size: 10pt)
    #box(
      fill: warning-orange,
      inset: (x: 6pt, y: 2pt),
      radius: 3pt,
      text(fill: white, weight: "bold", size: 9pt, "VERSION " + version)
    )
    #if version_note != "" [
      #h(8pt)
      #version_note
    ]
  ]
  #v(1em)
]

// Journal info and article type
#if journal_name != "" or article_type != "" [
  #align(center)[
    #set text(font: "Helvetica", size: 10pt)
    #if journal_name != "" [
      #text(fill: accent-blue, weight: "bold", upper(journal_name))
    ]
    #if article_type != "" [
      #h(12pt)
      #box(
        fill: bg-accent,
        inset: (x: 8pt, y: 3pt),
        radius: 3pt,
        text(fill: accent-blue, size: 9pt, article_type)
      )
    ]
  ]
  #v(0.8em)
]

// Title
#align(center)[
  #block(text(size: 18pt, weight: "bold", font: "Helvetica", title))
]
#v(1em)

// Authors
#if author_list.len() > 0 [
  #for author in author_list [
    #align(center)[
      #block[
        #text(size: 11pt, weight: "bold", font: "Helvetica", author.name)
        #if author.isCorresponding [#super[#text(fill: accent-blue, weight: "bold", "*")]]

        #if author.affiliation != "" [
          #v(0.1em)
          #text(size: 10pt, style: "italic", fill: text-secondary, author.affiliation)
        ]

        #set text(size: 9pt)
        #if author.orcid != "" or author.roles != "" [
          #v(0.1em)
          #if author.orcid != "" [
            #text(fill: success-green)[ORCID: #link("https://orcid.org/" + author.orcid)[#author.orcid]]
          ]
          #if author.roles != "" [
            #if author.orcid != "" [ #h(8pt) ]
            #box(
              fill: bg-light,
              inset: (x: 6pt, y: 2pt),
              radius: 3pt,
              text(fill: text-muted, size: 8pt, author.roles)
            )
          ]
        ]
      ]
    ]
    #v(0.4em)
  ]

  // Corresponding author note
  #let corresponding = author_list.filter(a => a.isCorresponding)
  #if corresponding.len() > 0 [
    #v(0.3em)
    align(center)[
      #{
        let email_text = if corresponding.first().email != "" {
          ": " + link("mailto:" + corresponding.first().email)[#corresponding.first().email]
        } else { "" }
        text(size: 9pt, style: "italic", fill: text-muted)[#super[\*] Corresponding author#email_text]
      }
    ]
  ]
] else if authors != "" [
  #align(center)[
    #block(text(size: 11pt, authors))
  ]
]

#v(0.8em)

// Dates
#align(center)[
  #set text(size: 9pt, fill: text-muted, font: "Helvetica")
  #if submitted_date != "" [Submitted: #submitted_date]
  #if accepted_date != "" [#if submitted_date != "" [ • ]Accepted: #accepted_date]
  #if published_date != "" [#if submitted_date != "" or accepted_date != "" [ • ]Published: #published_date]
]

// DOI
#if doi != "" [
  #v(0.3em)
  #align(center)[
    #text(size: 9pt, font: "Courier New")[DOI: #link("https://doi.org/" + doi)[#doi]]
  ]
]

// License
#if license != "" [
  #v(0.3em)
  #align(center)[
    #box(
      fill: rgb("#f0fdf4"),
      inset: (x: 8pt, y: 3pt),
      radius: 3pt,
      text(fill: success-green, size: 9pt, weight: "medium", font: "Helvetica", license)
    )
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
    fill: bg-accent,
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

// Back matter
#v(2em)
#line(length: 100%, stroke: 1pt + border-color)
#v(1em)

// Helper function for back matter sections
#let back-section(title-text, content) = {
  if content != "" [
    #set text(size: 10pt)
    #block[
      #text(font: "Helvetica", size: 10pt, weight: "bold", upper(title-text))
      #v(0.3em)
      #text(fill: text-secondary, content)
    ]
    #v(1em)
  ]
}

// Data Availability
#if data_availability_statement != "" [
  #set text(size: 10pt)
  #block[
    #text(font: "Helvetica", size: 10pt, weight: "bold", upper[Data Availability])
    #v(0.3em)
    #text(fill: text-secondary, data_availability_statement)
    #if data_availability_url != "" [
      #v(0.3em)
      #box(
        fill: bg-light,
        inset: (x: 10pt, y: 6pt),
        radius: 4pt,
        stroke: 0.5pt + border-color,
      )[
        #text(font: "Helvetica", size: 9pt)[
          #if data_availability_repository != "" [#data_availability_repository: ]
          #link(data_availability_url)[#data_availability_url]
        ]
      ]
    ]
  ]
  #v(1em)
]

// Code Availability
#if code_availability_statement != "" [
  #set text(size: 10pt)
  #block[
    #text(font: "Helvetica", size: 10pt, weight: "bold", upper[Code Availability])
    #v(0.3em)
    #text(fill: text-secondary, code_availability_statement)
    #if code_availability_url != "" [
      #v(0.3em)
      #box(
        fill: bg-light,
        inset: (x: 10pt, y: 6pt),
        radius: 4pt,
        stroke: 0.5pt + border-color,
      )[
        #text(font: "Helvetica", size: 9pt)[
          #if code_availability_repository != "" [#code_availability_repository: ]
          #link(code_availability_url)[#code_availability_url]
        ]
      ]
    ]
  ]
  #v(1em)
]

// Supplementary Materials
#if supplementary_list.len() > 0 [
  #set text(size: 10pt)
  #block[
    #text(font: "Helvetica", size: 10pt, weight: "bold", upper[Supplementary Materials])
    #v(0.3em)
    #for item in supplementary_list [
      #box(
        width: 100%,
        fill: bg-light,
        inset: 8pt,
        radius: 4pt,
      )[
        #text(font: "Helvetica", size: 9pt, weight: "medium", fill: accent-blue)[#item.label]
        #if item.description != "" [
          #h(8pt)
          #text(size: 9pt, fill: text-muted, item.description)
        ]
        #if item.file != "" [
          #linebreak()
          #text(size: 8pt, font: "Courier New", fill: text-muted, item.file)
        ]
      ]
      #v(0.3em)
    ]
  ]
  #v(1em)
]

// Author Contributions
#back-section("Author Contributions", author_contributions)

// Funding
#if funding_list.len() > 0 [
  #set text(size: 10pt)
  #block[
    #text(font: "Helvetica", size: 10pt, weight: "bold", upper[Funding])
    #v(0.3em)
    #for item in funding_list [
      #text(fill: text-secondary)[
        • #item.funder
        #if item.grantNumber != "" [(#item.grantNumber)]
        #if item.recipient != "" [ to #item.recipient]
      ]
      #linebreak()
    ]
  ]
  #v(1em)
]

// Acknowledgments
#back-section("Acknowledgments", acknowledgments)

// Competing Interests
#back-section("Competing Interests", competing_interests)

// Ethics Statement
#back-section("Ethics Statement", ethics_approval)

// Bibliography (if provided)
$if(bibliography)$
#v(1em)
#bibliography("references.bib", title: "References", style: "apa")
$endif$

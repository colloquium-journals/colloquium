These are notes on how I imagine submission process could work.

There should be flexibility across different journals.

My desired workflow would be to allow submission of a markdown document that can be rendered into the journal template via a bot. This is complicated because it requires managing assets like figures. 

There could also be bots for LaTeX, Quarto, and other formats. In all cases, the bot would need to be able to render the document into the journal's template.

To make this workflow possible, there needs to be an API endpoint that allows users to submit their documents, and to submit revised documents. The API should also allow users to upload assets like figures, and to link them to the document.

This should probably be a separate frontend component that is linked to the submission process. It should be editable throughout the process, and changes that are made should be noted in the conversation thread by the editorial bot. 

The bots that render the manuscript should be able to access the materials uploaded by the submission template and should be able to add a final rendered document to the submission thread.


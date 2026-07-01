$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$outputDir = "C:\Users\HP\Documents\CorpMind\docs\demo-video-english"
New-Item -ItemType Directory -Force $outputDir | Out-Null

$scenes = @(
  @{
    Name = "scene01"
    Text = "Welcome to CorpMind, an enterprise document question answering application built with a retrieval augmented generation pipeline. The application helps users upload business documents, ask natural language questions, and receive grounded answers with source citations."
  },
  @{
    Name = "scene02"
    Text = "The Document Center is where users manage their knowledge sources. CorpMind supports PDF, text, and Markdown files. After upload, the backend extracts document text, splits it into searchable chunks, creates embeddings, and stores them in a vector database for semantic retrieval."
  },
  @{
    Name = "scene03"
    Text = "Each document can be inspected through the Document Intelligence panel. It shows metadata such as pages, word count, reading time, key terms, risk terms, and a source preview. This makes the app feel like a real document analysis workspace, not just a chatbot."
  },
  @{
    Name = "scene04"
    Text = "The RAG question answering workspace allows users to ask questions across all sources or selected documents. Users can choose different analysis modes such as Answer, Risk, Brief, and Compare. The evidence depth control decides how many relevant chunks are retrieved."
  },
  @{
    Name = "scene05"
    Text = "When a question is submitted, CorpMind retrieves the most relevant document chunks and generates a grounded answer. The evidence panel shows ranked citations with filenames, source snippets, and relevance scores, so the user can verify where the answer came from."
  },
  @{
    Name = "scene06"
    Text = "The Activity section keeps recent questions, evidence, and analysis sessions organized. This project demonstrates a complete RAG workflow using FastAPI, React, LangChain style chunking, vector search, document intelligence, and a professional multi section user interface."
  }
)

foreach ($scene in $scenes) {
  $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $speaker.SelectVoice("Microsoft Zira Desktop")
  $speaker.Rate = 0
  $speaker.Volume = 100
  $path = Join-Path $outputDir "$($scene.Name).wav"
  $speaker.SetOutputToWaveFile($path)
  $speaker.Speak($scene.Text)
  $speaker.Dispose()
  Write-Host "Created $path"
}

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech

$outputDir = "C:\Users\HP\Documents\CorpMind\docs\demo-video"
New-Item -ItemType Directory -Force $outputDir | Out-Null

$scenes = @(
  @{
    Name = "scene01"
    Text = "Assalam o alaikum. Ye mera portfolio project CorpMind hai. Ye ek enterprise document Q and A assistant hai jahan user PDF, text, ya Markdown documents upload kar sakta hai, aur phir un documents se grounded answers citations ke sath le sakta hai."
  },
  @{
    Name = "scene02"
    Text = "Yahan source library me documents indexed hain. Backend document ko parse karta hai, chunks banata hai, embeddings generate karta hai, aur semantic search ke liye vector store me save karta hai."
  },
  @{
    Name = "scene03"
    Text = "Document Intelligence panel selected file ka quick analysis show karta hai: pages, word count, estimated read time, key terms, risk terms, aur source preview. Ye feature project ko sirf chatbot nahi, balkay document analysis workspace banata hai."
  },
  @{
    Name = "scene04"
    Text = "CorpMind me multiple analysis modes hain: normal answer, risk review, executive brief, aur source comparison. User evidence depth bhi control kar sakta hai, jis se retrieval results zyada ya kam detailed ho jate hain."
  },
  @{
    Name = "scene05"
    Text = "Question ask karne ke baad system grounded answer generate karta hai. Right side par ranked evidence cards, score, page metadata, aur citation preview show hota hai. User answer Markdown me export bhi kar sakta hai."
  },
  @{
    Name = "scene06"
    Text = "Is project ka stack FastAPI backend, React frontend, LangChain chunking, vector database storage, OpenAI ready synthesis, aur multi agent style retrieval plus synthesis workflow par based hai. Ye project RAG pipeline, API development, vector search, aur professional frontend skills clearly demonstrate karta hai."
  }
)

foreach ($scene in $scenes) {
  $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $speaker.Rate = 0
  $speaker.Volume = 100
  $path = Join-Path $outputDir "$($scene.Name).wav"
  $speaker.SetOutputToWaveFile($path)
  $speaker.Speak($scene.Text)
  $speaker.Dispose()
  Write-Host "Created $path"
}

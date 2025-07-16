export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">QA ChatCanvas Backend API</h1>
        <p className="text-lg text-gray-600">
          AI-powered backend for QA documentation generation and refinement
        </p>
        <div className="mt-8 space-y-2">
          <div className="text-sm text-gray-500">Available Endpoints:</div>
          <ul className="text-sm space-y-1">
            <li>POST /api/analyze-ticket - Initial ticket analysis</li>
            <li>POST /api/update-canvas - Conversational refinement</li>
            <li>POST /api/generate-suggestions - Generate QA suggestions</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
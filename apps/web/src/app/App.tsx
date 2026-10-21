export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16 text-slate-800">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
        CivicBridge AI
      </p>
      <h1 className="text-4xl font-bold tracking-tight">A clearer way to report local issues</h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-600">
        This project is a campus/neighbourhood prototype. The repository foundation and data models
        are in place; reporting and review features are being developed in later phases.
      </p>
      <p className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Reports made in this prototype are not automatically sent to a municipal authority. For
        immediate danger or emergencies, contact the relevant local service.
      </p>
    </main>
  );
}

export default App;

import { useEffect, useState } from 'react';
import axios from 'axios';

interface HealthStatus {
  api: { status: string } | null;
  ml: { status: string; model_ready: boolean; model_version: string | null } | null;
  apiError: string | null;
  mlError: string | null;
}

function HomePage() {
  const [health, setHealth] = useState<HealthStatus>({
    api: null,
    ml: null,
    apiError: null,
    mlError: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      setLoading(true);
      const result: HealthStatus = { api: null, ml: null, apiError: null, mlError: null };

      try {
        const apiRes = await axios.get('/api/health');
        result.api = apiRes.data;
      } catch (err) {
        result.apiError = 'API service is not reachable';
      }

      try {
        const mlRes = await axios.get('/api/ml-health');
        result.ml = mlRes.data;
      } catch (err) {
        result.mlError = 'ML service is not reachable';
      }

      setHealth(result);
      setLoading(false);
    }

    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            CivicBridge AI
          </h1>
          <span className="text-xs text-amber-400 border border-amber-400/30 rounded-full px-3 py-1">
            Prototype
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Report Local Issues,{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Track Progress
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Human-centred civic issue reporting and transparent triage, with ML-assisted
            category suggestions and nearby duplicate suggestions.
          </p>
        </section>

        {/* Prototype Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-12 text-center">
          <p className="text-amber-300 text-sm">
            <strong>Prototype:</strong> this report is not automatically sent to a municipal
            authority. For immediate danger or emergencies, contact the relevant local service.
          </p>
        </div>

        {/* Service Health */}
        <section className="mb-12">
          <h3 className="text-xl font-semibold mb-6 text-slate-300">Service Health</h3>
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              Checking services…
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* API Health */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      health.api ? 'bg-emerald-400 shadow-emerald-400/50 shadow-lg' : 'bg-red-400'
                    }`}
                  />
                  <h4 className="font-medium">Express API</h4>
                </div>
                <p className="text-sm text-slate-400">
                  {health.api
                    ? `Status: ${health.api.status}`
                    : health.apiError ?? 'Unknown error'}
                </p>
              </div>

              {/* ML Health */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      health.ml ? 'bg-emerald-400 shadow-emerald-400/50 shadow-lg' : 'bg-red-400'
                    }`}
                  />
                  <h4 className="font-medium">ML Service</h4>
                </div>
                <p className="text-sm text-slate-400">
                  {health.ml
                    ? `Status: ${health.ml.status} · Model ready: ${health.ml.model_ready} · Version: ${health.ml.model_version ?? 'none'}`
                    : health.mlError ?? 'Unknown error'}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
          CivicBridge AI · Campus/Neighbourhood Prototype · Not connected to municipal authorities
        </div>
      </footer>
    </div>
  );
}

export default HomePage;

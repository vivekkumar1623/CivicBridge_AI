import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import { PrototypeBanner } from '../components/PrototypeBanner';
import { Navbar } from '../components/Navbar';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { NewReportPage } from '../pages/NewReportPage';
import { MyReportsPage } from '../pages/MyReportsPage';
import { ReportDetailsPage } from '../pages/ReportDetailsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
          <PrototypeBanner />
          <Navbar />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reports/new" element={<NewReportPage />} />
              <Route path="/reports/mine" element={<MyReportsPage />} />
              <Route path="/reports/:id" element={<ReportDetailsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 space-y-1">
              <p>CivicBridge AI — Human-Centred Civic Issue Reporting & Triage</p>
              <p className="text-[11px] text-slate-400">
                Educational prototype. Reports are maintained locally and not automatically submitted to municipality authorities.
              </p>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

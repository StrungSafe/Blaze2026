import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Banner } from './components';
import './index.css';
import { Admin } from './pages/Admin';
import { Browse } from './pages/Browse';
import { Home } from './pages/Home';
import { TemplatePage } from './pages/Template';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <div className="min-h-screen bg-slate-50 text-slate-900">
                <Banner />
                <nav className="max-w-4xl mx-auto px-4 py-4 flex gap-4 items-center">
                    <Link to="/" className="font-bold text-lg">XOGrid</Link>
                    <Link to="/browse" className="text-slate-600 hover:underline">Browse</Link>
                    <Link to="/admin" className="text-slate-600 hover:underline ml-auto">Moderators</Link>
                </nav>
                <main className="max-w-4xl mx-auto px-4 pb-16">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/browse" element={<Browse />} />
                        <Route path="/t/:identifier" element={<TemplatePage />} />
                        <Route path="/admin" element={<Admin />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    </StrictMode>,
);

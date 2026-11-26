import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Tooltip } from './ui/primitives';
import AppShell, { RequireAuth } from './pages/AppShell';
import DesignPage from './pages/DesignPage';
import HomePage from './pages/HomePage';
import JoinPage from './pages/JoinPage';
import RoomPage from './pages/RoomPage';
import RoomSettingsPage from './pages/RoomSettingsPage';
import SignInPage from './pages/SignInPage';

function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-lg">Nothing here</h1>
      <Link to="/" className="text-sm text-focus underline">
        Go to your rooms
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Tooltip.Provider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/design" element={<DesignPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/join/:code" element={<JoinPage />} />
                <Route path="/r/:roomId" element={<RoomPage />} />
                <Route path="/r/:roomId/settings" element={<RoomSettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Tooltip.Provider>
    </AuthProvider>
  );
}

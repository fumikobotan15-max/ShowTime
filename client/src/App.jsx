import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import InteractionEffects from './components/InteractionEffects';
import Splash from './pages/Splash';
import { ForgotPassword, LocationPermission, Login, OAuthCallback, Signup } from './pages/AuthPages';
import Wizard from './pages/Wizard';
import Home from './pages/Home';
import Movie from './pages/Movie';
import Shows from './pages/Shows';
import Seats from './pages/Seats';
import Checkout from './pages/Checkout';
import Ticket from './pages/Ticket';
import Bookings from './pages/Bookings';
import AccountSettings from './pages/AccountSettings';

function Protected({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="center muted loading-state">Loading...</div>;
  return user ? children : <Navigate to="/login" state={{ from: loc.pathname }} replace />;
}
const P = ({ el }) => <Protected>{el}</Protected>;

export default function App() {
  const location = useLocation();
  return (<>
    <InteractionEffects />
    <div className="route-stage" key={location.pathname}>
      <Routes location={location}>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/location" element={<P el={<LocationPermission />} />} />
      <Route path="/preferences" element={<P el={<Wizard />} />} />
      <Route path="/home" element={<P el={<Home />} />} />
      <Route path="/movie/:id" element={<P el={<Movie />} />} />
      <Route path="/movie/:id/shows" element={<P el={<Shows />} />} />
      <Route path="/shows/:id/seats" element={<P el={<Seats />} />} />
      <Route path="/checkout" element={<P el={<Checkout />} />} />
      <Route path="/ticket/:id" element={<P el={<Ticket />} />} />
      <Route path="/bookings" element={<P el={<Bookings />} />} />
      <Route path="/account-settings" element={<P el={<AccountSettings />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  </>);
}

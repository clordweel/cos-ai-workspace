import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Space from './pages/Space';
import Logto from './pages/Logto';
import LogtoCallback from './pages/LogtoCallback';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/space" element={<Space />} />
      <Route path="/space/:id?" element={<Space />} />
      <Route path="/logto" element={<Logto />} />
      <Route path="/logto-callback" element={<LogtoCallback />} />
    </Routes>
  );
}

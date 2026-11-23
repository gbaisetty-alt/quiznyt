import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import CreateQuiz from './pages/CreateQuiz.jsx';
import HostGame from './pages/HostGame.jsx';
import Join from './pages/Join.jsx';
import PlayerGame from './pages/PlayerGame.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<CreateQuiz />} />
        <Route path="/host/:pin" element={<HostGame />} />
        <Route path="/join" element={<Join />} />
        <Route path="/play" element={<PlayerGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

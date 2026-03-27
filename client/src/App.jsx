import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HostHome from './pages/HostHome.jsx';
import HostBoard from './pages/HostBoard.jsx';
import HostClue from './pages/HostClue.jsx';
import PlayerPage from './pages/PlayerPage.jsx';
import EditorPage from './pages/EditorPage.jsx';
import JoinPage from './pages/JoinPage.jsx';
import LobbyCodeLanding from './pages/LobbyCodeLanding.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyCodeLanding />} />
      <Route path="/host" element={<HostHome />} />
      <Route path="/host/:sessionId" element={<HostBoard />} />
      <Route path="/host/:sessionId/clue" element={<HostClue />} />
      <Route path="/edit" element={<EditorPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/p/:sessionId/:playerId" element={<PlayerPage />} />
      <Route path="*" element={<Navigate to="/host" replace />} />
    </Routes>
  );
}


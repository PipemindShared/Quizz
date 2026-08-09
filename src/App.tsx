import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./Landing";
import AdminGate from "./admin/AdminGate";
import AdminHome from "./admin/AdminHome";
import TournamentBuilder from "./admin/TournamentBuilder";
import QuizBuilder from "./admin/QuizBuilder";
import HostScreen from "./host/HostScreen";
import PlayerApp from "./player/PlayerApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Builder screens — passphrase gated */}
      <Route
        path="/admin"
        element={
          <AdminGate>
            <AdminHome />
          </AdminGate>
        }
      />
      <Route
        path="/admin/t/:tournamentId"
        element={
          <AdminGate>
            <TournamentBuilder />
          </AdminGate>
        }
      />
      <Route
        path="/admin/quiz/:quizId"
        element={
          <AdminGate>
            <QuizBuilder />
          </AdminGate>
        }
      />

      {/* Host big screen */}
      <Route path="/host/:gameId" element={<HostScreen />} />

      {/* Player phone experience — reached by QR code */}
      <Route path="/play/:code" element={<PlayerApp />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import ScenarioSelect from "./ScenarioSelect";
import ScenarioPage from "./scenarios/shared/ScenarioPage";

function ScenarioRoute() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  if (!scenarioId) return <Navigate to="/" replace />;
  return <ScenarioPage scenarioId={scenarioId} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScenarioSelect />} />
        <Route path="/scenarios/:scenarioId" element={<ScenarioRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

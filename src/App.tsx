import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SimulationPage from '@/pages/SimulationPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SimulationPage />} />
      </Routes>
    </BrowserRouter>
  );
}
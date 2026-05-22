import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChickenReceiving from './pages/ChickenReceiving';
import ErpIntegrationHub from './pages/ErpIntegrationHub';
import DemandManagement from './pages/DemandManagement';
import ProductSpec from './pages/ProductSpec';
import WeightDistribution from './pages/WeightDistribution';
import MPSPlan from './pages/MPSPlan';
import DPSPlan from './pages/DPSPlan';
import ManualOperation from './pages/ManualOperation';
import MasterYield from './pages/MasterYield';
import MachineSetup from './pages/MachineSetup';
import BLPlan from './pages/BLPlan';
import ExternalRmInput from './pages/ExternalRmInput';
import MainLayout from './components/layout/MainLayout';
function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes wrapped in MainLayout */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chicken-receiving" element={<ChickenReceiving />} />
          <Route path="/erp-integration" element={<ErpIntegrationHub />} />
          <Route path="/demand-management" element={<DemandManagement />} />
          <Route path="/product-spec" element={<ProductSpec />} />
          <Route path="/weight-distribution" element={<WeightDistribution />} />
          <Route path="/:partId/mps" element={<MPSPlan />} />
          <Route path="/bil/bl-mps" element={<BLPlan />} />
          <Route path="/:partId/dps" element={<DPSPlan />} />
          <Route path="/:partId/manual-operation" element={<ManualOperation />} />
          <Route path="/master-yield" element={<MasterYield />} />
          <Route path="/machine-setup" element={<MachineSetup />} />
          <Route path="/external-rm" element={<ExternalRmInput />} />
        </Route>

        {/* Redirect empty path to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

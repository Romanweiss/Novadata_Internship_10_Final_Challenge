import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './app/AppLayout';
import { DataQualityPage } from './pages/DataQualityPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { ExportsPage } from './pages/ExportsPage';
import { FeatureMartPage } from './pages/FeatureMartPage';
import { OverviewPage } from './pages/OverviewPage';
import { PipelinesPage } from './pages/PipelinesPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/pipelines" element={<PipelinesPage />} />
        <Route path="/data-quality" element={<DataQualityPage />} />
        <Route path="/feature-mart" element={<FeatureMartPage />} />
        <Route path="/exports" element={<ExportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/documentation" element={<DocumentationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

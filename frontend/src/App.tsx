import { Route, Routes } from 'react-router';
import { PublicOnly, RequireAuth } from './auth/guards';
import { Layout } from './components/Layout';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { CompanyJobsPage } from './pages/company/CompanyJobsPage';
import { CreateJobPage } from './pages/company/CreateJobPage';
import { JobApplicantsPage } from './pages/company/JobApplicantsPage';
import { HomePage } from './pages/HomePage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobListPage } from './pages/JobListPage';
import { LoginPage } from './pages/LoginPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/jobs" element={<JobListPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/applications/:id" element={<ApplicationDetailPage />} />

          <Route element={<RequireAuth roles={['JOB_SEEKER']} />}>
            <Route path="/applications" element={<MyApplicationsPage />} />
          </Route>

          <Route element={<RequireAuth roles={['COMPANY']} />}>
            <Route path="/company/jobs" element={<CompanyJobsPage />} />
            <Route path="/company/jobs/new" element={<CreateJobPage />} />
            <Route path="/company/jobs/:id/applicants" element={<JobApplicantsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

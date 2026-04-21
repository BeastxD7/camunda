import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/layout/Navigation';
import { DashboardPage } from './pages/Dashboard';
import { ProcessList } from './pages/ProcessList';
import { ProcessDetail } from './pages/ProcessDetail';
import { ProcessToolTrace } from './pages/ProcessToolTrace';
import { TasklistPage } from './pages/Tasklist';
import { CustomerDataPage } from './pages/CustomerData';
import { CustomerTransactionsPage } from './pages/CustomerTransactions';

/**
 * Main App component with routing configuration
 */
export function App() {
  return (
    <Router>
      <Navigation />
      <div className="pt-16">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/processes" element={<ProcessList />} />
          <Route path="/tasks" element={<TasklistPage />} />
          <Route path="/customers" element={<CustomerDataPage />} />
          <Route path="/customers/:email/transactions" element={<CustomerTransactionsPage />} />
          <Route path="/process/:instanceKey" element={<ProcessDetail />} />
          <Route path="/process/:instanceKey/tools" element={<ProcessToolTrace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

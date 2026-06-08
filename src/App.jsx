import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import POS from '@/pages/POS';
import Purchases from '@/pages/Purchases';
import Transfers from '@/pages/Transfers';
import Customers from '@/pages/Customers';
import Suppliers from '@/pages/Suppliers';
import SalesHistory from '@/pages/SalesHistory';
import Reports from '@/pages/Reports';
import Alerts from '@/pages/Alerts';
import Settings from '@/pages/Settings';
import InventoryAnalytics from '@/pages/InventoryAnalytics';
import AIForecasting from '@/pages/AIForecasting';
import CycleCounting from '@/pages/CycleCounting';
import SupplierScorecard from '@/pages/SupplierScorecard';
import LoyaltyProgram from '@/pages/LoyaltyProgram';
import EnterpriseSettings from '@/pages/EnterpriseSettings';
import WarehouseExecution from '@/pages/WarehouseExecution';
import Manufacturing from '@/pages/Manufacturing';
import Financials from '@/pages/Financials';
import ApprovalWorkflow from '@/pages/ApprovalWorkflow';
import MobileWarehouse from '@/pages/MobileWarehouse';
import TransportationManagement from '@/pages/TransportationManagement';
import MultiChannel from '@/pages/MultiChannel';
import ThreePL from '@/pages/ThreePL';
import ExecutiveDashboard from '@/pages/ExecutiveDashboard';
import WorkflowAutomation from '@/pages/WorkflowAutomation';
import MasterData from '@/pages/MasterData';
import PricingEngine from '@/pages/PricingEngine';
import InventoryOptimization from '@/pages/InventoryOptimization';
import QualityManagement from '@/pages/QualityManagement';
import AssetManagement from '@/pages/AssetManagement';
import APIHub from '@/pages/APIHub';
import DocumentManagement from '@/pages/DocumentManagement';
import DataWarehouse from '@/pages/DataWarehouse';
import PlatformAdmin from '@/pages/PlatformAdmin';
import AuditCompliance from '@/pages/AuditCompliance';
import IAMPage from '@/pages/IAMPage';
import BusinessRulesEngine from '@/pages/BusinessRulesEngine';
import SchedulerEngine from '@/pages/SchedulerEngine';
import CommunicationHub from '@/pages/CommunicationHub';
import MonitoringDashboard from '@/pages/MonitoringDashboard';
import SupplierPortal from '@/pages/SupplierPortal';
import AICopilot from '@/pages/AICopilot';
import KnowledgeBase from '@/pages/KnowledgeBase';
import EventBus from '@/pages/EventBus';
import Observability from '@/pages/Observability';
import DevOps from '@/pages/DevOps';
import SecurityCenter from '@/pages/SecurityCenter';
import CustomerPortal from '@/pages/CustomerPortal';
import AppMarketplace from '@/pages/AppMarketplace';
import BillingPlatform from '@/pages/BillingPlatform';
import AIInsightHub from '@/pages/AIInsightHub';
import OnboardingCenter from '@/pages/OnboardingCenter';
import DataMigration from '@/pages/DataMigration';
import CustomerSuccess from '@/pages/CustomerSuccess';
import ReleaseManagement from '@/pages/ReleaseManagement';
import AIOps from '@/pages/AIOps';
import Benchmarking from '@/pages/Benchmarking';
import DemoEnvironment from '@/pages/DemoEnvironment';
import DemoScript from '@/pages/DemoScript';
import InvestorMetrics from '@/pages/InvestorMetrics';
import LaunchReadiness from '@/pages/LaunchReadiness';
import TestAutomation from '@/pages/TestAutomation';
import DocumentationPortal from '@/pages/DocumentationPortal';
import ImplementationToolkit from '@/pages/ImplementationToolkit';

import WhiteLabel from '@/pages/WhiteLabel';
import DeveloperPortal from '@/pages/DeveloperPortal';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading WMS Pro...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/sales" element={<SalesHistory />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<InventoryAnalytics />} />
          <Route path="/forecasting" element={<AIForecasting />} />
          <Route path="/cycle-counting" element={<CycleCounting />} />
          <Route path="/supplier-scorecard" element={<SupplierScorecard />} />
          <Route path="/loyalty" element={<LoyaltyProgram />} />
          <Route path="/enterprise-settings" element={<EnterpriseSettings />} />
          <Route path="/warehouse-execution" element={<WarehouseExecution />} />
          <Route path="/manufacturing" element={<Manufacturing />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/approvals" element={<ApprovalWorkflow />} />
          <Route path="/mobile-warehouse" element={<MobileWarehouse />} />
          <Route path="/transportation" element={<TransportationManagement />} />
          <Route path="/multi-channel" element={<MultiChannel />} />
          <Route path="/3pl" element={<ThreePL />} />
          <Route path="/executive" element={<ExecutiveDashboard />} />
          <Route path="/workflow" element={<WorkflowAutomation />} />
          <Route path="/master-data" element={<MasterData />} />
          <Route path="/pricing" element={<PricingEngine />} />
          <Route path="/optimization" element={<InventoryOptimization />} />
          <Route path="/quality" element={<QualityManagement />} />
          <Route path="/assets" element={<AssetManagement />} />
          <Route path="/api-hub" element={<APIHub />} />
          <Route path="/documents" element={<DocumentManagement />} />
          <Route path="/data-warehouse" element={<DataWarehouse />} />
          <Route path="/platform-admin" element={<PlatformAdmin />} />
          <Route path="/audit-compliance" element={<AuditCompliance />} />
          <Route path="/iam" element={<IAMPage />} />
          <Route path="/business-rules" element={<BusinessRulesEngine />} />
          <Route path="/scheduler" element={<SchedulerEngine />} />
          <Route path="/comms-hub" element={<CommunicationHub />} />
          <Route path="/monitoring" element={<MonitoringDashboard />} />
          <Route path="/supplier-portal" element={<SupplierPortal />} />
          <Route path="/ai-copilot" element={<AICopilot />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/event-bus" element={<EventBus />} />
          <Route path="/observability" element={<Observability />} />
          <Route path="/devops" element={<DevOps />} />
          <Route path="/security" element={<SecurityCenter />} />
          <Route path="/customer-portal" element={<CustomerPortal />} />
          <Route path="/marketplace" element={<AppMarketplace />} />
          <Route path="/billing" element={<BillingPlatform />} />
          <Route path="/white-label" element={<WhiteLabel />} />
          <Route path="/developer-portal" element={<DeveloperPortal />} />
          <Route path="/insights" element={<AIInsightHub />} />
          <Route path="/onboarding" element={<OnboardingCenter />} />
          <Route path="/data-migration" element={<DataMigration />} />
          <Route path="/customer-success" element={<CustomerSuccess />} />
          <Route path="/releases" element={<ReleaseManagement />} />
          <Route path="/aiops" element={<AIOps />} />
          <Route path="/benchmarking" element={<Benchmarking />} />
          <Route path="/demo-environment" element={<DemoEnvironment />} />
          <Route path="/demo-script" element={<DemoScript />} />
          <Route path="/investor-metrics" element={<InvestorMetrics />} />
          <Route path="/launch-readiness" element={<LaunchReadiness />} />
          <Route path="/test-automation" element={<TestAutomation />} />
          <Route path="/documentation" element={<DocumentationPortal />} />
          <Route path="/implementation-toolkit" element={<ImplementationToolkit />} />
        </Route>
        <Route path="/pos" element={<POS />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
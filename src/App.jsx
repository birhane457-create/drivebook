import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleGuard from '@/components/RoleGuard';
import PageLoader from '@/components/shared/PageLoader';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';

// Route-level code splitting — each page becomes its own chunk.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Products = lazy(() => import('@/pages/Products'));
const BarcodeLabels = lazy(() => import('@/pages/BarcodeLabels'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const POS = lazy(() => import('@/pages/POS'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Transfers = lazy(() => import('@/pages/Transfers'));
const Customers = lazy(() => import('@/pages/Customers'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const SalesHistory = lazy(() => import('@/pages/SalesHistory'));
const Reports = lazy(() => import('@/pages/Reports'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Settings = lazy(() => import('@/pages/Settings'));
const InventoryAnalytics = lazy(() => import('@/pages/InventoryAnalytics'));
const AIForecasting = lazy(() => import('@/pages/AIForecasting'));
const CycleCounting = lazy(() => import('@/pages/CycleCounting'));
const SupplierScorecard = lazy(() => import('@/pages/SupplierScorecard'));
const LoyaltyProgram = lazy(() => import('@/pages/LoyaltyProgram'));
const EnterpriseSettings = lazy(() => import('@/pages/EnterpriseSettings'));
const WarehouseExecution = lazy(() => import('@/pages/WarehouseExecution'));
const WarehouseModule = lazy(() => import('@/pages/WarehouseModule'));
const Manufacturing = lazy(() => import('@/pages/Manufacturing'));
const Financials = lazy(() => import('@/pages/Financials'));
const ApprovalWorkflow = lazy(() => import('@/pages/ApprovalWorkflow'));
const MobileWarehouse = lazy(() => import('@/pages/MobileWarehouse'));
const TransportationManagement = lazy(() => import('@/pages/TransportationManagement'));
const MultiChannel = lazy(() => import('@/pages/MultiChannel'));
const ThreePL = lazy(() => import('@/pages/ThreePL'));
const ExecutiveDashboard = lazy(() => import('@/pages/ExecutiveDashboard'));
const WorkflowAutomation = lazy(() => import('@/pages/WorkflowAutomation'));
const MasterData = lazy(() => import('@/pages/MasterData'));
const PricingEngine = lazy(() => import('@/pages/PricingEngine'));
const InventoryOptimization = lazy(() => import('@/pages/InventoryOptimization'));
const QualityManagement = lazy(() => import('@/pages/QualityManagement'));
const AssetManagement = lazy(() => import('@/pages/AssetManagement'));
const APIHub = lazy(() => import('@/pages/APIHub'));
const DocumentManagement = lazy(() => import('@/pages/DocumentManagement'));
const DataWarehouse = lazy(() => import('@/pages/DataWarehouse'));
const PlatformAdmin = lazy(() => import('@/pages/PlatformAdmin'));
const AuditCompliance = lazy(() => import('@/pages/AuditCompliance'));
const IAMPage = lazy(() => import('@/pages/IAMPage'));
const BusinessRulesEngine = lazy(() => import('@/pages/BusinessRulesEngine'));
const SchedulerEngine = lazy(() => import('@/pages/SchedulerEngine'));
const CommunicationHub = lazy(() => import('@/pages/CommunicationHub'));
const MonitoringDashboard = lazy(() => import('@/pages/MonitoringDashboard'));
const SupplierPortal = lazy(() => import('@/pages/SupplierPortal'));
const AICopilot = lazy(() => import('@/pages/AICopilot'));
const KnowledgeBase = lazy(() => import('@/pages/KnowledgeBase'));
const EventBus = lazy(() => import('@/pages/EventBus'));
const Observability = lazy(() => import('@/pages/Observability'));
const DevOps = lazy(() => import('@/pages/DevOps'));
const SecurityCenter = lazy(() => import('@/pages/SecurityCenter'));
const CustomerPortal = lazy(() => import('@/pages/CustomerPortal'));
const AppMarketplace = lazy(() => import('@/pages/AppMarketplace'));
const BillingPlatform = lazy(() => import('@/pages/BillingPlatform'));
const WhiteLabel = lazy(() => import('@/pages/WhiteLabel'));
const DeveloperPortal = lazy(() => import('@/pages/DeveloperPortal'));
const AIInsightHub = lazy(() => import('@/pages/AIInsightHub'));
const OnboardingCenter = lazy(() => import('@/pages/OnboardingCenter'));
const DataMigration = lazy(() => import('@/pages/DataMigration'));
const CustomerSuccess = lazy(() => import('@/pages/CustomerSuccess'));
const ReleaseManagement = lazy(() => import('@/pages/ReleaseManagement'));
const AIOps = lazy(() => import('@/pages/AIOps'));
const Benchmarking = lazy(() => import('@/pages/Benchmarking'));
const DemoEnvironment = lazy(() => import('@/pages/DemoEnvironment'));
const DemoScript = lazy(() => import('@/pages/DemoScript'));
const InvestorMetrics = lazy(() => import('@/pages/InvestorMetrics'));
const LaunchReadiness = lazy(() => import('@/pages/LaunchReadiness'));
const TestAutomation = lazy(() => import('@/pages/TestAutomation'));
const DocumentationPortal = lazy(() => import('@/pages/DocumentationPortal'));
const ImplementationToolkit = lazy(() => import('@/pages/ImplementationToolkit'));
const ReceivingWorkflow = lazy(() => import('@/pages/workflows/ReceivingWorkflow'));
const ShippingWorkflow = lazy(() => import('@/pages/workflows/ShippingWorkflow'));
const ReturnsWorkflow = lazy(() => import('@/pages/workflows/ReturnsWorkflow'));
const PickingWorkflow = lazy(() => import('@/pages/workflows/PickingWorkflow'));
const PackingWorkflow = lazy(() => import('@/pages/workflows/PackingWorkflow'));
const ManufacturingWorkflow = lazy(() => import('@/pages/workflows/ManufacturingWorkflow'));
const InspectionWorkflow = lazy(() => import('@/pages/workflows/InspectionWorkflow'));
const DataSeeder = lazy(() => import('@/pages/DataSeeder'));
const AppDocumentation = lazy(() => import('@/pages/AppDocumentation'));
const DesignSystem = lazy(() => import('@/pages/DesignSystem'));
const UXPatterns = lazy(() => import('@/pages/UXPatterns'));

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
    <Suspense fallback={<PageLoader fullscreen />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<RoleGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/barcode-labels" element={<BarcodeLabels />} />
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
          <Route path="/warehouse" element={<WarehouseModule />} />
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
          <Route path="/workflows/receiving" element={<ReceivingWorkflow />} />
          <Route path="/workflows/shipping" element={<ShippingWorkflow />} />
          <Route path="/workflows/returns" element={<ReturnsWorkflow />} />
          <Route path="/workflows/picking" element={<PickingWorkflow />} />
          <Route path="/workflows/packing" element={<PackingWorkflow />} />
          <Route path="/workflows/manufacturing" element={<ManufacturingWorkflow />} />
          <Route path="/workflows/inspection" element={<InspectionWorkflow />} />
          <Route path="/data-seeder" element={<DataSeeder />} />
          <Route path="/app-documentation" element={<AppDocumentation />} />
          <Route path="/design-system" element={<DesignSystem />} />
          <Route path="/ux-patterns" element={<UXPatterns />} />
        </Route>
        <Route path="/pos" element={<POS />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
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
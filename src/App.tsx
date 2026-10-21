/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DBProvider, useDB } from './db/store';
import { Navbar } from './components/nav/Navbar';
import { SidebarDock } from './components/nav/SidebarDock';
import { CommandPalette } from './components/nav/CommandPalette';
import { GuidedTour } from './components/nav/GuidedTour';
import { FloatingAIChat } from './components/nav/FloatingAIChat';
import { ClayToastContainer } from './components/clay/ClayToastContainer';

// Pages lazy loaded for fast initial startup and split bundles
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ItemsPage = React.lazy(() => import('./pages/ItemsPage').then(m => ({ default: m.ItemsPage })));
const StockPage = React.lazy(() => import('./pages/StockPage').then(m => ({ default: m.StockPage })));
const PurchasesPage = React.lazy(() => import('./pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const IssuesPage = React.lazy(() => import('./pages/IssuesPage').then(m => ({ default: m.IssuesPage })));
const SearchPage = React.lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const SuppliersPage = React.lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const DatabaseLabPage = React.lazy(() => import('./pages/DatabaseLabPage').then(m => ({ default: m.DatabaseLabPage })));
const AIAssistantPage = React.lazy(() => import('./pages/AIAssistantPage').then(m => ({ default: m.AIAssistantPage })));

import { ErrorBoundary } from './components/ErrorBoundary';

const PageLoadingFallback = () => (
  <div className="w-full min-h-[50vh] flex items-center justify-center p-8">
    <div className="clay-card p-8 flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-indigo-400 border-t-transparent animate-spin" />
      <span className="text-sm font-display font-semibold text-clay-text-muted">Loading module...</span>
    </div>
  </div>
);

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Cross-page state helpers (e.g. Restock shortcut from Dashboard to Purchases)
  const [purchasePrefill, setPurchasePrefill] = useState<{
    itemId: string;
    quantity?: number;
    supplierId?: string;
  }>({ itemId: '' });

  const [issuePrefillItemId, setIssuePrefillItemId] = useState('');
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  // Check if first-run tour has been shown
  useEffect(() => {
    try {
      const hasSeenTour = localStorage.getItem('claystock_has_seen_tour');
      if (!hasSeenTour) {
        setIsTourOpen(true);
        localStorage.setItem('claystock_has_seen_tour', 'true');
      }
    } catch {
      // storage blocked
    }
  }, []);

  const handleOpenPurchaseWithItem = (itemId: string, suggestedQty?: number, supplierId?: string) => {
    setPurchasePrefill({ itemId, quantity: suggestedQty, supplierId });
    setActiveTab('purchases');
  };

  const handleOpenIssueWithItem = (itemId: string) => {
    setIssuePrefillItemId(itemId);
    setActiveTab('issues');
  };

  const handleInspectItem = (itemId: string) => {
    setInspectItemId(itemId);
    setActiveTab('items');
  };

  const handleTriggerAction = (action: string) => {
    if (action === 'NEW_ITEM') {
      setActiveTab('items');
    } else if (action === 'NEW_PURCHASE') {
      setPurchasePrefill({ itemId: '' });
      setActiveTab('purchases');
    } else if (action === 'NEW_ISSUE') {
      setIssuePrefillItemId('');
      setActiveTab('issues');
    } else if (action.startsWith('VIEW_ITEM_')) {
      const itemId = action.replace('VIEW_ITEM_', '');
      handleInspectItem(itemId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-clay-bg text-clay-text relative selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAIAssistant={() => setActiveTab('ai-assistant')}
        onStartTour={() => setIsTourOpen(true)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6 relative">
        {/* Floating Sidebar Dock */}
        <SidebarDock activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Page Area */}
        <main className="flex-1 min-w-0 lg:pl-36 pb-20 lg:pb-12">
          <React.Suspense fallback={<PageLoadingFallback />}>
            {activeTab === 'dashboard' && (
              <ErrorBoundary name="Dashboard Page">
                <DashboardPage
                  setActiveTab={setActiveTab}
                  onOpenPurchaseFormWithItem={handleOpenPurchaseWithItem}
                  onOpenNewItemModal={() => setActiveTab('items')}
                  onOpenNewIssueModal={() => setActiveTab('issues')}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'items' && (
              <ErrorBoundary name="Items Management">
                <ItemsPage
                  selectedItemId={inspectItemId}
                  onClearSelectedItem={() => setInspectItemId(null)}
                  onOpenPurchaseWithItem={handleOpenPurchaseWithItem}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'stock' && (
              <ErrorBoundary name="Stock Management">
                <StockPage
                  onOpenPurchaseWithItem={handleOpenPurchaseWithItem}
                  onOpenIssueWithItem={handleOpenIssueWithItem}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'purchases' && (
              <ErrorBoundary name="Purchase Management">
                <PurchasesPage
                  initialItemId={purchasePrefill.itemId}
                  initialQuantity={purchasePrefill.quantity}
                  initialSupplierId={purchasePrefill.supplierId}
                  onClearInitial={() => setPurchasePrefill({ itemId: '' })}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'issues' && (
              <ErrorBoundary name="Issue Management">
                <IssuesPage
                  initialItemId={issuePrefillItemId}
                  onOpenPurchaseWithItem={handleOpenPurchaseWithItem}
                  onClearInitial={() => setIssuePrefillItemId('')}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'search' && (
              <ErrorBoundary name="Search Module">
                <SearchPage
                  onInspectItem={handleInspectItem}
                  onOpenPurchaseWithItem={handleOpenPurchaseWithItem}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'suppliers' && (
              <ErrorBoundary name="Suppliers & Departments">
                <SuppliersPage />
              </ErrorBoundary>
            )}

            {activeTab === 'database-lab' && (
              <ErrorBoundary name="Database Lab">
                <DatabaseLabPage />
              </ErrorBoundary>
            )}

            {activeTab === 'ai-assistant' && (
              <ErrorBoundary name="AI Assistant">
                <AIAssistantPage />
              </ErrorBoundary>
            )}
          </React.Suspense>
        </main>
      </div>

      {/* Floating AI Chat Bubble (Quick Access from Any Page) */}
      <FloatingAIChat />

      {/* Global Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        onTriggerAction={handleTriggerAction}
      />

      {/* 5-Step Guided Tour */}
      <GuidedTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        setActiveTab={setActiveTab}
      />

      {/* Clay Bubble Toast Notifications */}
      <ClayToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <DBProvider>
      <AppContent />
    </DBProvider>
  );
}

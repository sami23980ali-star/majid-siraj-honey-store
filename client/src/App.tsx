import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import About from "./pages/About";
import Cart from "./pages/Cart";
import Contact from "./pages/Contact";
import Favorites from "./pages/Favorites";
import Home from "./pages/Home";
import Knowledge from "./pages/Knowledge";
import KnowledgeArticle from "./pages/KnowledgeArticle";
import Product from "./pages/Product";
import OrderTracking from "./pages/OrderTracking";
import Shop from "./pages/Shop";

// لوحة الإدارة لا يفتحها الزبون، فلا مبرر لتحميل شيفرتها مع الصفحة الرئيسية.
const Admin = lazy(() => import("./pages/Admin"));

function AdminRoute() {
  return <Suspense fallback={<div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#fffaf0] text-[#76501f]">يتم تحميل لوحة الإدارة…</div>}><Admin /></Suspense>;
}

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/shop" component={Shop} />
    <Route path="/products/:slug" component={Product} />
    <Route path="/cart" component={Cart} />
    <Route path="/about" component={About} />
    <Route path="/contact" component={Contact} />
    <Route path="/favorites" component={Favorites} />
    <Route path="/track-order" component={OrderTracking} />
    <Route path="/knowledge" component={Knowledge} />
    <Route path="/knowledge/:slug" component={KnowledgeArticle} />
    <Route path="/admin" component={AdminRoute} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><FavoritesProvider><CartProvider><Router /><Toaster richColors position="top-center" /></CartProvider></FavoritesProvider></ThemeProvider></ErrorBoundary>;
}

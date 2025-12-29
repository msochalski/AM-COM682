import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import RecipeDetail from "./pages/RecipeDetail";
import CreateRecipe from "./pages/CreateRecipe";
import EditRecipe from "./pages/EditRecipe";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="site-header">
          <div className="brand">
            <span className="brand-mark">RC</span>
            <div>
              <h1>Recipe Cloud</h1>
              <p>Azure-powered recipes & media processing</p>
            </div>
          </div>
          <nav className="nav-links">
            <Link to="/">Feed</Link>
            <Link to="/create">Create</Link>
          </nav>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateRecipe />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/recipes/:id/edit" element={<EditRecipe />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
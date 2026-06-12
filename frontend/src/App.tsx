import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Tool from "./pages/Tool";
import Result from "./pages/Result";
import Examples from "./pages/Examples";
import History from "./pages/History";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import "./App.css";

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        Documantic
      </Link>
      <div className="nav-links">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/tool">Generate</Link>
            <Link to="/examples">Examples</Link>
            <Link to="/profile" className="nav-user">{user?.name}</Link>
            <button className="nav-logout" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/examples">Examples</Link>
            <Link to="/login">Sign In</Link>
            <Link to="/signup" className="btn btn-primary btn-nav">
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/tool" element={<Tool />} />
              <Route path="/result/:jobId" element={<Result />} />
              <Route path="/examples" element={<Examples />} />
              <Route path="/history" element={<History />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </main>

          <footer className="footer">
            <p>Documantic — AI-Powered Code Documentation Generator</p>
            <p className="footer-sub">CSCI5409 Cloud Computing Final Project</p>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

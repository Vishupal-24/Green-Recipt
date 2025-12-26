// import React from "react";
// import { Navigate } from "react-router-dom";

// const ProtectedRoute = ({ children, role }) => {
//   const token = localStorage.getItem("token");
//   const userRole = localStorage.getItem("role");

//   if (!token || (role && userRole !== role)) {
//     return <Navigate to={userRole === "merchant" ? "/merchant-login" : "/customer-login"} replace />;
//   }

//   return children;
// };

// export default ProtectedRoute;

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import * as api from "../services/api";

const ProtectedRoute = ({ children, role }) => {
  const location = useLocation();
  
  // Use the new API functions to check authentication
  const isAuth = api.isAuthenticated();
  const userRole = api.getStoredRole();

  // 1. CASE: User is NOT logged in at all
  if (!isAuth) {
    // Redirect to login based on the route they were trying to access
    const loginPath = location.pathname.includes('/merchant') ? '/merchant-login' : '/customer-login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // 2. CASE: User IS logged in, but has the WRONG role
  // (e.g., A Customer trying to access the Merchant Dashboard)
  if (role && userRole !== role) {
    // Redirect them to THEIR correct home page based on who they actually are
    if (userRole === "merchant") {
      return <Navigate to="/merchant/overview" replace />;
    } else {
      return <Navigate to="/customer-dashboard" replace />;
    }
  }

  // 3. CASE: Access Granted - Let MerchantDashboard handle onboarding logic
  return children;
};

export default ProtectedRoute;
